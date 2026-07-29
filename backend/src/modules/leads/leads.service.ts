import { prisma } from '@config/prisma';
import { cache } from '@services/cache.service';
import { AppError } from '@utils/AppError';
import type { AuthUser } from '@/types';
import { leadsRepository } from './leads.repository';
import type { CreateLeadInput, ListLeadsQuery, UpdateLeadInput } from './leads.validator';
import type { LeadStatus, ExternalLeadCategory } from '@prisma/client';

// Lead types that are NOT exhibitor leads — routed to the ExternalLead table.
const EXTERNAL_LEAD_TYPES = new Set(['VISITOR', 'DELEGATE', 'SPEAKER']);

async function bustDashboard() {
  await cache.delPattern('dash:*');
}

export const leadsService = {
  list(user: AuthUser, q: ListLeadsQuery) {
    return leadsRepository.list(user, q);
  },

  exportRows(user: AuthUser, q: ListLeadsQuery) {
    return leadsRepository.exportRows(user, q);
  },

  // Manually add a lead. Exhibition leads live in the exhibitor CRM (Lead table).
  // Visitor/Delegate/Speaker leads belong to the local CRM, so they are stored in
  // the ExternalLead staging table instead — same routing as post-show sync.
  async create(input: CreateLeadInput) {
    const { email, leadType, ...rest } = input;

    if (leadType && EXTERNAL_LEAD_TYPES.has(leadType)) {
      const record = await prisma.externalLead.create({
        data: {
          category: leadType as ExternalLeadCategory,
          name: [rest.firstName, rest.lastName].filter(Boolean).join(' ') || null,
          firstName: rest.firstName ?? null,
          lastName: rest.lastName ?? null,
          email: email || null,
          mobile: rest.mobile ?? null,
          designation: rest.designation ?? null,
          company: rest.company ?? null,
          eventName: rest.eventName ?? null,
          businessInterest: leadType, // the chosen type doubles as the interest
          source: 'MANUAL',
          sourceChannel: null, // manual entry — not a website channel
          raw: JSON.parse(JSON.stringify(input)) as object,
        },
      });
      await bustDashboard();
      return { external: true as const, record };
    }

    const lead = await prisma.lead.create({
      data: { ...rest, email: email || null, leadType },
    });
    await bustDashboard();
    return { external: false as const, record: lead };
  },

  async get(id: string) {
    const lead = await leadsRepository.findById(id);
    if (!lead) throw AppError.notFound('Lead not found');
    return lead;
  },

  async update(id: string, input: UpdateLeadInput) {
    await this.get(id);
    const lead = await prisma.lead.update({ where: { id }, data: input });
    await bustDashboard();
    return lead;
  },

  // Status is NEVER overwritten destructively: we append to lead_status_history
  // in the same transaction that updates the denormalized current status.
  async changeStatus(id: string, toStatus: LeadStatus, userId: string, reason?: string, sqmSpace?: string) {
    const lead = await this.get(id);
    if (lead.status === toStatus && sqmSpace === undefined) return lead;

    const [updated] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: { status: toStatus, ...(sqmSpace !== undefined ? { sqmSpace } : {}) },
      }),
      prisma.leadStatusHistory.create({
        data: { leadId: id, fromStatus: lead.status, toStatus, changedById: userId, reason },
      }),
    ]);
    await bustDashboard();
    return updated;
  },

  async softDelete(id: string) {
    await this.get(id);
    await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    await bustDashboard();
  },

  async addNote(leadId: string, authorId: string, body: string) {
    await this.get(leadId);
    return prisma.leadNote.create({ data: { leadId, authorId, body } });
  },

  // Reclassify an exhibitor lead as Visitor/Delegate/Speaker: copy it into the
  // ExternalLead (local-CRM) list with the chosen category, then soft-delete the
  // original Lead so it leaves the exhibitor pipeline. Done atomically.
  async convertToExternal(id: string, type: ExternalLeadCategory) {
    const lead = await this.get(id);
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || null;

    const external = await prisma.$transaction(async (tx) => {
      const record = await tx.externalLead.create({
        data: {
          category: type,
          name,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          mobile: lead.mobile,
          designation: lead.designation,
          company: lead.company,
          eventName: lead.eventName,
          businessInterest: type,
          ipAddress: lead.ipAddress,
          createDate: lead.createDate,
          source: lead.source,
          sourceChannel: null,
          raw: JSON.parse(JSON.stringify(lead)) as object,
        },
      });
      await tx.lead.update({ where: { id }, data: { deletedAt: new Date() } });
      return record;
    });
    await bustDashboard();
    return external;
  },

  // Archive converted leads into the year-tagged Historical store and remove them
  // from active Lead Management. Only CONVERTED, not-yet-deleted leads are archived;
  // anything else in the selection is skipped (reported back to the caller).
  async archiveToHistorical(userId: string, leadIds: string[], eventYear: number) {
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, status: 'CONVERTED', deletedAt: null },
    });

    let archived = 0;
    for (const lead of leads) {
      await prisma.$transaction(async (tx) => {
        await tx.historicalLead.create({
          data: {
            eventYear,
            eventName: lead.eventName,
            company: lead.company,
            name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || null,
            designation: lead.designation,
            email: lead.email,
            mobile: lead.mobile,
            city: lead.city,
            country: lead.country,
            status: lead.status,
            sourceLeadId: lead.id,
            archivedById: userId,
          },
        });
        await tx.lead.update({ where: { id: lead.id }, data: { deletedAt: new Date() } });
      });
      archived += 1;
    }
    if (archived > 0) await bustDashboard();
    return { archived, skipped: leadIds.length - archived, total: leadIds.length };
  },
};
