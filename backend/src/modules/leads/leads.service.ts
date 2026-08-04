import { Prisma } from '@prisma/client';
import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { cache } from '@services/cache.service';
import { AppError } from '@utils/AppError';
import { assertAssignableUser } from '@services/user.guard';
import type { AuthUser } from '@/types';
import { leadsRepository } from './leads.repository';
import { bulkImportRow } from './leads.validator';
import type {
  BulkImportInput, BulkImportRow, CreateLeadInput, HistoricalMatchInput, ListLeadsQuery, UpdateLeadInput,
} from './leads.validator';

export interface HistoricalMatch {
  leadId: string;
  company: string;
  matches: Array<{
    id: string;
    company: string | null;
    name: string | null;
    email: string | null;
    mobile: string | null;
    eventYear: number | null;
    assignedTo: string | null;
    score: number;
  }>;
}
import type { LeadStatus, ExternalLeadCategory } from '@prisma/client';

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
          businessInterest: leadType,
          source: 'MANUAL',
          sourceChannel: null,
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

  async bulkImport(userId: string, input: BulkImportInput) {
    // Imported leads belong to whoever ran the import unless told otherwise.
    const assignToId = input.assignToId ?? userId;
    if (assignToId) await assertAssignableUser(assignToId);
    const valid: BulkImportRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    input.rows.forEach((raw, i) => {
      const parsed = bulkImportRow.safeParse(raw);
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
              status: assignToId ? 'ASSIGNED' : 'NEW',
              assignedUserId: assignToId ?? null,
              assignedAt: assignToId ? new Date() : null,
            },
          });
          if (assignToId) {
            await tx.leadAssignment.create({
              data: { leadId: lead.id, assignedToId: assignToId, assignedById: userId, type: 'BULK' },
            });
          }
        });
        created += 1;
      } catch {
        errors.push({ row, message: 'Could not be saved' });
      }
    }

    if (created > 0) await bustDashboard();
    errors.sort((a, b) => a.row - b.row);
    return { created, failed: errors.length, total: input.rows.length, errors };
  },

  async historicalMatches(input: HistoricalMatchInput) {
    const leads = await prisma.lead.findMany({
      where: { id: { in: input.leadIds }, deletedAt: null, NOT: { company: null } },
      select: { id: true, company: true },
    });
    const named = leads.filter((l) => (l.company ?? '').trim().length >= 3);
    if (!named.length) return { threshold: env.HISTORICAL_MATCH_THRESHOLD, matches: [] };

    const pairs = Prisma.join(named.map((l) => Prisma.sql`(${l.id}::uuid, ${l.company as string})`));
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_limit(${env.HISTORICAL_MATCH_THRESHOLD}::real)`;
      return tx.$queryRaw<Array<{
        leadId: string; id: string; company: string | null;
        name: string | null; email: string | null; mobile: string | null;
        eventYear: number | null; assignedTo: string | null; score: number;
      }>>`
        SELECT x."lead_id" AS "leadId",
               h."id",
               h."company",
               h."name",
               h."email",
               h."mobile",
               h."event_year" AS "eventYear",
               COALESCE(
                 NULLIF(BTRIM(CONCAT_WS(' ', u."first_name", u."last_name")), ''),
                 CASE WHEN h."assigned_to" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                      THEN NULL ELSE h."assigned_to" END
               ) AS "assignedTo",
               similarity(h."company", x."company") AS "score"
        FROM (VALUES ${pairs}) AS x("lead_id", "company")
        JOIN "historical_leads" h ON h."company" % x."company"
        LEFT JOIN "users" u ON u."id" = h."assigned_user_id"
        WHERE h."deleted_at" IS NULL
        ORDER BY x."lead_id", "score" DESC
        LIMIT 2000
      `;
    }, { timeout: 30_000, maxWait: 15_000 });

    const byLead = new Map<string, HistoricalMatch>();
    for (const r of rows) {
      const lead = named.find((l) => l.id === r.leadId);
      if (!lead) continue;
      const entry = byLead.get(r.leadId)
        ?? { leadId: r.leadId, company: lead.company as string, matches: [] };
      if (entry.matches.length < 5) {
        entry.matches.push({
          id: r.id, company: r.company, name: r.name, email: r.email, mobile: r.mobile,
          eventYear: r.eventYear, assignedTo: r.assignedTo, score: Number(r.score),
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
          syncStatus: 'PENDING',
          raw: JSON.parse(JSON.stringify(lead)) as object,
        },
      });
      await tx.lead.update({ where: { id }, data: { deletedAt: new Date() } });
      return record;
    });
    await bustDashboard();
    return external;
  },

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
