import { prisma } from '@config/prisma';
import { cache } from '@services/cache.service';
import { assertAssignableUser } from '@services/user.guard';
import { AppError } from '@utils/AppError';
import type { AuthUser } from '@/types';
import type {
  CreateHistoricalLeadInput,
  ListHistoricalLeadsQuery,
  RestoreHistoricalInput,
  UpdateHistoricalLeadInput,
} from './historical.validator';
import type { Prisma } from '@prisma/client';

async function bustDashboard() {
  await cache.delPattern('dash:*');
}

function historicalScope(user: AuthUser): Prisma.HistoricalLeadWhereInput {
  return user.level === 1 ? {} : { assignedUserId: user.id };
}

export function carryOverRemarks(r: Prisma.HistoricalLeadGetPayload<object>): string | null {
  const parts: string[] = [];
  if (r.remark?.trim()) parts.push(r.remark.trim());
  if (r.specialRemarks?.trim()) parts.push(`Special remarks: ${r.specialRemarks.trim()}`);

  const extras: Array<[string, unknown]> = [
    ['Event year', r.eventYear],
    ['Branch office', r.branchOffice],
    ['Historical code', r.histCode],
    ['Last contact (meet)', r.lastContactMeet],
    ['Last contact (email)', r.lastContactEmail],
    ['Last contact (mobile)', r.lastContactMobile],
    ['Date of confirmation', r.dateOfConfirmation ? r.dateOfConfirmation.toISOString().slice(0, 10) : null],
  ];
  const listed = extras
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${String(v).trim()}`);
  if (listed.length) parts.push(listed.join(' | '));

  const history = Array.isArray(r.exhHistory) ? (r.exhHistory as Array<{ year?: unknown; sqm_spo?: unknown }>) : [];
  const historyText = history
    .filter((h) => h && (h.year || h.sqm_spo))
    .map((h) => `${h.year ?? '?'}: ${h.sqm_spo ?? '—'}`)
    .join(', ');
  if (historyText) parts.push(`Exhibition history — ${historyText}`);

  return parts.length ? parts.join('\n') : null;
}

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'eng', 'engr', 'sir', 'madam', 'mx']);

export function splitName(full: string | null): { title: string | null; firstName: string | null; lastName: string | null } {
  const trimmed = full?.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { title: null, firstName: null, lastName: null };

  const words = trimmed.split(' ');
  let title: string | null = null;
  if (words.length > 1 && HONORIFICS.has(words[0].replace(/\.$/, '').toLowerCase())) {
    title = words.shift() ?? null;
  }
  if (!words.length) return { title, firstName: null, lastName: null };
  const firstName = words.shift() ?? null;
  return { title, firstName, lastName: words.join(' ') || null };
}

async function assertEditable(user: AuthUser, id: string) {
  const record = await prisma.historicalLead.findFirst({ where: { id, deletedAt: null } });
  if (!record) throw AppError.notFound('Historical lead not found');
  if (user.level !== 1 && record.assignedUserId !== user.id) {
    throw AppError.forbidden('You can only change historical leads assigned to you');
  }
  return record;
}

const AUDITED_FIELDS = {
  company: 'Company', name: 'Contact name', designation: 'Designation', email: 'Email',
  mobile: 'Mobile', altEmail: 'Alternate email', altMobile: 'Alternate mobile',
  city: 'City', country: 'Country', eventName: 'Event name',
  eventYear: 'Event year', industry: 'Industry', branchOffice: 'Branch office',
  remark: 'Remark', specialRemarks: 'Special remarks', spaceSqm: 'Space (sqm)',
  lastContactMeet: 'Last contact — meeting', lastContactEmail: 'Last contact — email',
  lastContactMobile: 'Last contact — mobile',
} as const;

export interface HistoricalEditChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

const asText = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v);

const HISTORICAL_RELATION_SORTS: Record<string, (dir: Prisma.SortOrder) => Prisma.HistoricalLeadOrderByWithRelationInput> = {
  assignedUser: (dir) => ({ assignedUser: { firstName: dir } }),
};

function historicalOrderBy(q: ListHistoricalLeadsQuery): Prisma.HistoricalLeadOrderByWithRelationInput[] {
  const relation = HISTORICAL_RELATION_SORTS[q.sortBy];
  const primary = (relation
    ? relation(q.sortDir)
    : q.sortBy === 'archivedAt'
      ? { archivedAt: q.sortDir }
      : { [q.sortBy]: { sort: q.sortDir, nulls: 'last' } }) as Prisma.HistoricalLeadOrderByWithRelationInput;
  return q.sortBy === 'archivedAt'
    ? [primary, { id: q.sortDir }]
    : [primary, { archivedAt: 'desc' }, { id: 'desc' }];
}





export const historicalService = {








  async listLeads(user: AuthUser, q: ListHistoricalLeadsQuery) {
    const where: Prisma.HistoricalLeadWhereInput = {
      restoredLeadId: null,
      deletedAt: q.includeInactive ? { not: null } : null,
      ...historicalScope(user),
    };
    if (user.level === 1 && q.assigneeId) where.assignedUserId = q.assigneeId;
    if (q.year) where.eventYear = q.year;
    if (q.noIndustry) where.industry = null;
    else if (q.industry) where.industry = q.industry;
    if (q.dateFrom || q.dateTo) {
      where.archivedAt = {};
      if (q.dateFrom) (where.archivedAt as Prisma.DateTimeFilter).gte = q.dateFrom;
      if (q.dateTo) (where.archivedAt as Prisma.DateTimeFilter).lte = q.dateTo;
    }
    if (q.q) {
      where.OR = [
        { company: { contains: q.q, mode: 'insensitive' } },
        { name: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await prisma.$transaction([
      prisma.historicalLead.count({ where }),
      prisma.historicalLead.findMany({
        where,
        orderBy: historicalOrderBy(q),
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { assignedUser: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { items, meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
  },

  async years() {
    const groups = await prisma.historicalLead.groupBy({
      by: ['eventYear'],
      where: { eventYear: { not: null }, deletedAt: null },
      _count: { _all: true },
      orderBy: { eventYear: 'desc' },
    });
    return groups.map((g) => ({ year: g.eventYear as number, count: g._count._all }));
  },

  async industries(user: AuthUser) {
    const groups = await prisma.historicalLead.groupBy({
      by: ['industry'],
      where: { restoredLeadId: null, deletedAt: null, ...historicalScope(user) },
      _count: { _all: true },
      orderBy: { industry: 'asc' },
    });
    return groups.map((g) => ({ industry: g.industry, count: g._count._all }));
  },

  async leadHistory(user: AuthUser, id: string) {
    await assertEditable(user, id);
    return prisma.historicalLeadEdit.findMany({
      where: { historicalLeadId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { editedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async restore(user: AuthUser, input: RestoreHistoricalInput) {
    const userId = user.id;
    const records = await prisma.historicalLead.findMany({
      where: { id: { in: input.ids }, ...historicalScope(user) },
    });

    let restored = 0;
    let skipped = input.ids.length - records.length;
    for (const r of records) {
      if (!(r.company || r.email || r.name || r.mobile)) { skipped += 1; continue; }
      const assignedTo = r.assignedUserId;
      await prisma.$transaction(async (tx) => {
        const { title, firstName, lastName } = splitName(r.name);
        const lead = await tx.lead.create({
          data: {
            company: r.company,
            title,
            firstName,
            lastName,
            designation: r.designation,
            email: r.email,
            mobile: r.mobile,
            altEmail: r.altEmail,
            altMobile: r.altMobile,
            city: r.city,
            country: r.country,
            industry: r.industry,
            shellSpace: r.spaceSqm,
            remarks: carryOverRemarks(r),
            eventName: r.eventName,
            createDate: r.dateOfConfirmation,
            source: 'HISTORICAL',
            sourceChannel: 'HISTORICAL',
            leadType: 'EXHIBITION',
            status: assignedTo ? 'ASSIGNED' : 'NEW',
            assignedUserId: assignedTo,
            assignedAt: assignedTo ? new Date() : null,
          },
        });
        if (assignedTo) {
          await tx.leadAssignment.create({
            data: { leadId: lead.id, assignedToId: assignedTo, assignedById: userId, type: 'SINGLE' },
          });
        }
        await tx.historicalLead.update({ where: { id: r.id }, data: { restoredLeadId: lead.id } });
      });
      restored += 1;
    }
    if (restored > 0) await bustDashboard();
    return { restored, skipped, total: input.ids.length };
  },

  async removeLead(user: AuthUser, id: string) {
    await assertEditable(user, id);
    await prisma.historicalLead.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  },

  async restoreRemovedLead(user: AuthUser, id: string) {
    const record = await prisma.historicalLead.findUnique({ where: { id } });
    if (!record) throw AppError.notFound('Historical lead not found');
    if (user.level !== 1 && record.assignedUserId !== user.id) {
      throw AppError.forbidden('You can only change historical leads assigned to you');
    }
    await prisma.historicalLead.update({ where: { id }, data: { deletedAt: null } });
    return { restored: true };
  },

  async createLead(input: CreateHistoricalLeadInput) {
    let assignedTo: string | null = null;
    if (input.assignedUserId) {
      await assertAssignableUser(input.assignedUserId);
      const u = await prisma.user.findUnique({
        where: { id: input.assignedUserId },
        select: { firstName: true, lastName: true },
      });
      assignedTo = u ? `${u.firstName} ${u.lastName}` : null;
    }
    return prisma.historicalLead.create({
      data: {
        company: input.company ?? null,
        name: input.name ?? null,
        designation: input.designation ?? null,
        email: input.email || null,
        mobile: input.mobile ?? null,
        altEmail: input.altEmail || null,
        altMobile: input.altMobile ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        industry: input.industry || null,
        eventName: input.eventName ?? null,
        eventYear: input.eventYear ?? null,
        assignedUserId: input.assignedUserId ?? null,
        assignedTo,
      },
    });
  },

  async updateLead(user: AuthUser, id: string, input: UpdateHistoricalLeadInput) {
    const existing = await assertEditable(user, id);

    const data: Prisma.HistoricalLeadUncheckedUpdateInput = {};
    const changes: HistoricalEditChange[] = [];

    for (const [k, label] of Object.entries(AUDITED_FIELDS) as [keyof typeof AUDITED_FIELDS, string][]) {
      const next = input[k];
      if (next === undefined) continue;
      (data as Record<string, unknown>)[k] = next;
      const from = asText(existing[k]);
      const to = asText(next);
      if (from !== to) changes.push({ field: k, label, from, to });
    }

    if (input.exhHistory !== undefined) {
      data.exhHistory = input.exhHistory as unknown as Prisma.InputJsonValue;
      const from = JSON.stringify(existing.exhHistory ?? []);
      const to = JSON.stringify(input.exhHistory);
      if (from !== to) {
        const summarise = (v: unknown) =>
          (Array.isArray(v) ? v : [])
            .map((h) => `${(h as { year: number }).year}: ${(h as { sqm_spo: string }).sqm_spo}`)
            .join(', ') || null;
        changes.push({
          field: 'exhHistory', label: 'Participation history',
          from: summarise(existing.exhHistory), to: summarise(input.exhHistory),
        });
      }
    }

    if (input.assignedUserId !== undefined) {
      data.assignedUserId = input.assignedUserId;
      let assignedTo: string | null = null;
      if (input.assignedUserId) {
        await assertAssignableUser(input.assignedUserId);
        const u = await prisma.user.findUnique({ where: { id: input.assignedUserId }, select: { firstName: true, lastName: true } });
        assignedTo = u ? `${u.firstName} ${u.lastName}` : null;
      }
      data.assignedTo = assignedTo;
      if (existing.assignedUserId !== input.assignedUserId) {
        changes.push({ field: 'assignedUserId', label: 'Assigned to', from: existing.assignedTo, to: assignedTo });
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.historicalLead.update({
        where: { id },
        data,
        include: { assignedUser: { select: { id: true, firstName: true, lastName: true } } },
      });
      if (changes.length) {
        await tx.historicalLeadEdit.create({
          data: {
            historicalLeadId: id,
            editedById: user.id,
            changes: changes as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return updated;
    });
  },
};
