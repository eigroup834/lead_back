import { prisma } from '@config/prisma';
import { cache } from '@services/cache.service';
import { AppError } from '@utils/AppError';
import type { AuthUser } from '@/types';
import { MAPPABLE_LEAD_FIELDS } from './historical.validator';
import type {
  ConvertBulkInput,
  ConvertRowInput,
  CreateUploadInput,
  CreateHistoricalLeadInput,
  ListHistoricalLeadsQuery,
  ListRowsQuery,
  MappableLeadField,
  RestoreHistoricalInput,
  UpdateHistoricalLeadInput,
  UpdateUploadInput,
} from './historical.validator';
import type { Prisma } from '@prisma/client';

async function bustDashboard() {
  await cache.delPattern('dash:*');
}

function historicalScope(user: AuthUser): Prisma.HistoricalLeadWhereInput {
  return user.level === 1 ? {} : { assignedUserId: user.id };
}

async function assertEditable(user: AuthUser, id: string) {
  const record = await prisma.historicalLead.findUnique({ where: { id } });
  if (!record) throw AppError.notFound('Historical lead not found');
  if (user.level !== 1 && record.assignedUserId !== user.id) {
    throw AppError.forbidden('You can only change historical leads assigned to you');
  }
  return record;
}

const AUDITED_FIELDS = {
  company: 'Company', name: 'Contact name', designation: 'Designation', email: 'Email',
  mobile: 'Mobile', city: 'City', country: 'Country', eventName: 'Event name',
  eventYear: 'Event year', industry: 'Industry', branchOffice: 'Branch office',
  remark: 'Remark', specialRemarks: 'Special remarks', spaceSqm: 'Space (sqm)',
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Mapping = Partial<Record<MappableLeadField, string>>;
type RowData = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function mapRowToLead(
  mapping: Mapping,
  data: RowData,
  overrides: ConvertRowInput['overrides'] & { priority?: string } = {},
): Prisma.LeadUncheckedCreateInput | null {
  const out: Record<string, string> = {};
  for (const field of MAPPABLE_LEAD_FIELDS) {
    const col = mapping[field];
    const val = col ? str(data[col]) : undefined;
    if (val !== undefined) out[field] = val;
  }
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k === 'priority') continue;
    const s = str(v);
    if (s !== undefined) out[k] = s;
    else delete out[k];
  }

  if (out.email && !EMAIL_RE.test(out.email)) {
    out.remarks = [out.remarks, `Email (unverified): ${out.email}`].filter(Boolean).join(' | ');
    delete out.email;
  }

  if (!(out.company || out.email || out.firstName || out.mobile)) return null;

  const { createDate, priority, ...rest } = out as Record<string, string> & { createDate?: string };
  const lead: Prisma.LeadUncheckedCreateInput = {
    ...rest,
    source: 'MANUAL',
    leadType: 'EXHIBITION',
    status: 'NEW',
    priority: (overrides?.priority as Prisma.LeadUncheckedCreateInput['priority']) ?? 'MEDIUM',
  };
  if (createDate) {
    const d = new Date(createDate);
    if (!Number.isNaN(d.getTime())) lead.createDate = d;
  }
  return lead;
}

async function ownUploadOrThrow(id: string, userId: string) {
  const upload = await prisma.historicalUpload.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
  if (!upload) throw AppError.notFound('Historical upload not found');
  return upload;
}

export const historicalService = {
  async create(user: AuthUser, input: CreateUploadInput) {
    const upload = await prisma.historicalUpload.create({
      data: {
        ownerId: user.id,
        fileName: input.fileName,
        sheetName: input.sheetName ?? null,
        columns: input.columns,
        mapping: (input.mapping ?? {}) as Prisma.InputJsonValue,
        rowCount: input.rows.length,
        rows: {
          create: input.rows.map((data, i) => ({ rowIndex: i, data: data as Prisma.InputJsonValue })),
        },
      },
    });
    return upload;
  },

  listUploads(user: AuthUser) {
    return prisma.historicalUpload.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, fileName: true, sheetName: true, columns: true, mapping: true,
        rowCount: true, convertedCount: true, createdAt: true, updatedAt: true,
      },
    });
  },

  async getUpload(user: AuthUser, id: string) {
    const upload = await ownUploadOrThrow(id, user.id);
    return upload;
  },

  async listRows(user: AuthUser, id: string, q: ListRowsQuery) {
    await ownUploadOrThrow(id, user.id);
    const where: Prisma.HistoricalRowWhereInput = { uploadId: id };
    if (q.converted === 'true') where.convertedLeadId = { not: null };
    if (q.converted === 'false') where.convertedLeadId = null;

    const [total, items] = await prisma.$transaction([
      prisma.historicalRow.count({ where }),
      prisma.historicalRow.findMany({
        where,
        orderBy: { rowIndex: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items, meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
  },

  async update(user: AuthUser, id: string, input: UpdateUploadInput) {
    await ownUploadOrThrow(id, user.id);
    const data: Prisma.HistoricalUploadUpdateInput = {};
    if (input.fileName !== undefined) data.fileName = input.fileName;
    if (input.mapping !== undefined) data.mapping = input.mapping as Prisma.InputJsonValue;
    return prisma.historicalUpload.update({ where: { id }, data });
  },

  async remove(user: AuthUser, id: string) {
    await ownUploadOrThrow(id, user.id);
    await prisma.historicalUpload.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async convertRow(user: AuthUser, id: string, rowId: string, input: ConvertRowInput) {
    const upload = await ownUploadOrThrow(id, user.id);
    const row = await prisma.historicalRow.findFirst({ where: { id: rowId, uploadId: id } });
    if (!row) throw AppError.notFound('Row not found');
    if (row.convertedLeadId) throw AppError.conflict('Row already converted to a lead');

    const leadData = mapRowToLead((upload.mapping ?? {}) as Mapping, row.data as RowData, input.overrides);
    if (!leadData) {
      throw AppError.badRequest('Row has no company, name, email, or mobile to build a lead from. Set a column mapping first.');
    }

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({ data: leadData });
      await tx.historicalRow.update({
        where: { id: rowId },
        data: { convertedLeadId: created.id, convertedAt: new Date() },
      });
      await tx.historicalUpload.update({ where: { id }, data: { convertedCount: { increment: 1 } } });
      return created;
    });
    await bustDashboard();
    return lead;
  },

  async convertBulk(user: AuthUser, id: string, input: ConvertBulkInput) {
    const upload = await ownUploadOrThrow(id, user.id);
    const where: Prisma.HistoricalRowWhereInput = { uploadId: id, convertedLeadId: null };
    if (input.rowIds?.length) where.id = { in: input.rowIds };
    const rows = await prisma.historicalRow.findMany({ where, orderBy: { rowIndex: 'asc' } });

    const mapping = (upload.mapping ?? {}) as Mapping;
    let converted = 0;
    let skipped = 0;

    for (const row of rows) {
      const leadData = mapRowToLead(mapping, row.data as RowData, { priority: input.priority });
      if (!leadData) { skipped += 1; continue; }
      await prisma.$transaction(async (tx) => {
        const created = await tx.lead.create({ data: leadData });
        await tx.historicalRow.update({
          where: { id: row.id },
          data: { convertedLeadId: created.id, convertedAt: new Date() },
        });
      });
      converted += 1;
    }
    if (converted > 0) {
      await prisma.historicalUpload.update({ where: { id }, data: { convertedCount: { increment: converted } } });
      await bustDashboard();
    }
    return { converted, skipped, total: rows.length };
  },

  async listLeads(user: AuthUser, q: ListHistoricalLeadsQuery) {
    const where: Prisma.HistoricalLeadWhereInput = { restoredLeadId: null, ...historicalScope(user) };
    if (user.level === 1 && q.assigneeId) where.assignedUserId = q.assigneeId;
    if (q.year) where.eventYear = q.year;
    if (q.noEventName) where.eventName = null;
    else if (q.eventName) where.eventName = q.eventName;
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
      where: { eventYear: { not: null } },
      _count: { _all: true },
      orderBy: { eventYear: 'desc' },
    });
    return groups.map((g) => ({ year: g.eventYear as number, count: g._count._all }));
  },

  async events(user: AuthUser) {
    const groups = await prisma.historicalLead.groupBy({
      by: ['eventName'],
      where: { restoredLeadId: null, ...historicalScope(user) },
      _count: { _all: true },
      orderBy: { eventName: 'asc' },
    });
    return groups.map((g) => ({ event: g.eventName, count: g._count._all }));
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
        const lead = await tx.lead.create({
          data: {
            company: r.company,
            firstName: r.name,
            designation: r.designation,
            email: r.email,
            mobile: r.mobile,
            city: r.city,
            country: r.country,
            eventName: r.eventName,
            source: 'HISTORICAL',
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
    await prisma.historicalLead.delete({ where: { id } });
    return { deleted: true };
  },

  async createLead(input: CreateHistoricalLeadInput) {
    let assignedTo: string | null = null;
    if (input.assignedUserId) {
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
        city: input.city ?? null,
        country: input.country ?? null,
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
