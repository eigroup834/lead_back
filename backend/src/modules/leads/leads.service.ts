import { Prisma } from '@prisma/client';
import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { cache } from '@services/cache.service';
import { AppError } from '@utils/AppError';
import type { AuthUser } from '@/types';
import { leadsRepository } from './leads.repository';
import { bulkImportRow } from './leads.validator';
import type {
  BulkImportInput, BulkImportRow, CreateLeadInput, HistoricalMatchInput, ListLeadsQuery, UpdateLeadInput,
} from './leads.validator';

// One lead's company and the archived records it resembles.
export interface HistoricalMatch {
  leadId: string;
  company: string;
  matches: Array<{ id: string; company: string | null; eventYear: number | null; assignedTo: string | null; score: number }>;
}
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

  // Bulk import from a spreadsheet. Every row is validated on its own so a single
  // bad line reports back with its spreadsheet row number instead of failing the
  // whole file. Imported leads are always exhibitor leads and start as New.
  async bulkImport(userId: string, input: BulkImportInput) {
    const valid: BulkImportRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    input.rows.forEach((raw, i) => {
      const parsed = bulkImportRow.safeParse(raw);
      // Fall back to the array position when the row number itself is unusable.
      const rowNo = parsed.success ? parsed.data.row : Number((raw as { row?: unknown })?.row) || i + 2;
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ row: rowNo, message: `${issue.path.filter((p) => p !== 'row').join('.') || 'row'}: ${issue.message}` });
        return;
      }
      const r = parsed.data;
      if (!(r.company || r.email || r.firstName || r.mobile)) {
        errors.push({ row: rowNo, message: 'Needs at least a company, name, email or mobile' });
        return;
      }
      if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
        errors.push({ row: rowNo, message: `Invalid email "${r.email}"` });
        return;
      }
      valid.push(r);
    });

    // Duplicates: first against rows earlier in this same file, then against
    // leads already in the system. Matching is on email or mobile.
    const toCreate: BulkImportRow[] = [];
    if (input.skipDuplicates) {
      const emails = valid.map((r) => r.email?.toLowerCase()).filter(Boolean) as string[];
      const mobiles = valid.map((r) => r.mobile).filter(Boolean) as string[];
      const existing = await prisma.lead.findMany({
        where: {
          deletedAt: null,
          OR: [
            ...(emails.length ? [{ email: { in: emails, mode: 'insensitive' as const } }] : []),
            ...(mobiles.length ? [{ mobile: { in: mobiles } }] : []),
          ],
        },
        select: { email: true, mobile: true },
      });
      const seenEmail = new Set(existing.map((l) => l.email?.toLowerCase()).filter(Boolean) as string[]);
      const seenMobile = new Set(existing.map((l) => l.mobile).filter(Boolean) as string[]);

      for (const r of valid) {
        const email = r.email?.toLowerCase();
        const dupEmail = email && seenEmail.has(email);
        const dupMobile = r.mobile && seenMobile.has(r.mobile);
        if (dupEmail || dupMobile) {
          errors.push({ row: r.row, message: `Skipped — ${dupEmail ? `email "${r.email}"` : `mobile "${r.mobile}"`} already exists` });
          continue;
        }
        if (email) seenEmail.add(email);
        if (r.mobile) seenMobile.add(r.mobile);
        toCreate.push(r);
      }
    } else {
      toCreate.push(...valid);
    }

    let created = 0;
    for (const r of toCreate) {
      const { row, email, source, ...rest } = r;
      try {
        await prisma.$transaction(async (tx) => {
          const lead = await tx.lead.create({
            data: {
              ...rest,
              email: email || null,
              source: source ?? 'MANUAL',
              leadType: 'EXHIBITION',
              status: input.assignToId ? 'ASSIGNED' : 'NEW',
              assignedUserId: input.assignToId ?? null,
              assignedAt: input.assignToId ? new Date() : null,
            },
          });
          if (input.assignToId) {
            await tx.leadAssignment.create({
              data: { leadId: lead.id, assignedToId: input.assignToId, assignedById: userId, type: 'BULK' },
            });
          }
        });
        created += 1;
      } catch {
        errors.push({ row, message: 'Could not be saved' });
      }
    }

    if (created > 0) await bustDashboard();
    // Errors are row-ordered so the UI can show them against the spreadsheet.
    errors.sort((a, b) => a.row - b.row);
    return { created, failed: errors.length, total: input.rows.length, errors };
  },

  // Which of these leads already appear in Historical Data, by company name?
  // Trigram similarity (pg_trgm) at or above HISTORICAL_MATCH_THRESHOLD — an
  // equality check would miss "Acme Exhibits Ltd" vs "Acme Exhibits Ltd.".
  // Only leads with at least one match come back.
  async historicalMatches(input: HistoricalMatchInput) {
    const leads = await prisma.lead.findMany({
      where: { id: { in: input.leadIds }, deletedAt: null, NOT: { company: null } },
      select: { id: true, company: true },
    });
    const named = leads.filter((l) => (l.company ?? '').trim().length >= 3);
    if (!named.length) return { threshold: env.HISTORICAL_MATCH_THRESHOLD, matches: [] };

    // One batched query rather than one per lead: bulk assigns can carry hundreds
    // of leads, and a per-lead round trip would take seconds on the assign dialog.
    //
    // The join must use the `%` operator, not `similarity(...) >= x`: only `%`
    // can use the GIN trigram index, and it reads its cutoff from the session's
    // pg_trgm.similarity_threshold. The function form falls back to a sequential
    // scan per lead (measured ~46x slower over this archive).
    const pairs = Prisma.join(named.map((l) => Prisma.sql`(${l.id}::uuid, ${l.company as string})`));
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_limit(${env.HISTORICAL_MATCH_THRESHOLD}::real)`;
      return tx.$queryRaw<Array<{
        leadId: string; id: string; company: string | null;
        eventYear: number | null; assignedTo: string | null; score: number;
      }>>`
        SELECT x."lead_id" AS "leadId",
               h."id",
               h."company",
               h."event_year"  AS "eventYear",
               h."assigned_to" AS "assignedTo",
               similarity(h."company", x."company") AS "score"
        FROM (VALUES ${pairs}) AS x("lead_id", "company")
        JOIN "historical_leads" h ON h."company" % x."company"
        ORDER BY x."lead_id", "score" DESC
        LIMIT 2000
      `;
    });

    // Group by lead, keeping the closest few matches each.
    const byLead = new Map<string, HistoricalMatch>();
    for (const r of rows) {
      const lead = named.find((l) => l.id === r.leadId);
      if (!lead) continue;
      const entry = byLead.get(r.leadId)
        ?? { leadId: r.leadId, company: lead.company as string, matches: [] };
      if (entry.matches.length < 5) {
        entry.matches.push({
          id: r.id, company: r.company, eventYear: r.eventYear,
          assignedTo: r.assignedTo, score: Number(r.score),
        });
      }
      byLead.set(r.leadId, entry);
    }
    return { threshold: env.HISTORICAL_MATCH_THRESHOLD, matches: [...byLead.values()] };
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
