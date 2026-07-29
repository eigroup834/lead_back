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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Mapping = Partial<Record<MappableLeadField, string>>;
type RowData = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

// Build a Lead payload from a row using the upload's column→field mapping, then
// layer any manual overrides on top. Returns null if nothing usable is present.
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
  // overrides win over mapped values
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k === 'priority') continue;
    const s = str(v);
    if (s !== undefined) out[k] = s;
    else delete out[k]; // explicit empty override clears the field
  }

  // Email must be valid to satisfy the Lead contract; keep an invalid one in remarks
  // so the rep never silently loses it.
  if (out.email && !EMAIL_RE.test(out.email)) {
    out.remarks = [out.remarks, `Email (unverified): ${out.email}`].filter(Boolean).join(' | ');
    delete out.email;
  }

  // A lead needs at least one identifying field.
  if (!(out.company || out.email || out.firstName || out.mobile)) return null;

  const { createDate, priority, ...rest } = out as Record<string, string> & { createDate?: string };
  const lead: Prisma.LeadUncheckedCreateInput = {
    ...rest,
    source: 'MANUAL',
    leadType: 'EXHIBITION', // historical follow-ups are exhibitor leads
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

  // Convert a single row into a Lead. Idempotent-ish: a row already converted is
  // rejected so we never create duplicate leads from the same row.
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

  // Bulk convert: explicit rowIds, or every not-yet-converted row when omitted.
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

  // -------- Historical leads (year-tagged archive) --------

  async listLeads(user: AuthUser, q: ListHistoricalLeadsQuery) {
    // Once moved to Lead Management, a record drops out of this list (data kept).
    const where: Prisma.HistoricalLeadWhereInput = { restoredLeadId: null };
    // Only Super Admin (level 1) sees all and may filter by team member;
    // everyone else sees only their own assigned historical leads.
    if (user.level === 1) {
      if (q.assigneeId) where.assignedUserId = q.assigneeId;
    } else {
      where.assignedUserId = user.id;
    }
    if (q.year) where.eventYear = q.year;
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
        orderBy: [{ eventYear: 'desc' }, { archivedAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { assignedUser: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { items, meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
  },

  // Distinct event years present in the archive, with counts.
  async years() {
    const groups = await prisma.historicalLead.groupBy({
      by: ['eventYear'],
      where: { eventYear: { not: null } },
      _count: { _all: true },
      orderBy: { eventYear: 'desc' },
    });
    return groups.map((g) => ({ year: g.eventYear as number, count: g._count._all }));
  },

  // Move historical lead(s) back into Lead Management as fresh leads (status NEW).
  // The historical record is kept as the permanent archive; restoredLeadId is
  // updated to point at the most recent lead created from it.
  async restore(userId: string, input: RestoreHistoricalInput) {
    const records = await prisma.historicalLead.findMany({ where: { id: { in: input.ids } } });

    let restored = 0;
    let skipped = 0;
    for (const r of records) {
      if (!(r.company || r.email || r.name || r.mobile)) { skipped += 1; continue; }
      // Restore to the same member it was assigned to. If resolved, the lead is
      // created already ASSIGNED so it lands in the Assigned Leads tab.
      const assignedTo = r.assignedUserId;
      await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            company: r.company,
            firstName: r.name, // historical stores a single name field
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

  async removeLead(id: string) {
    const record = await prisma.historicalLead.findUnique({ where: { id } });
    if (!record) throw AppError.notFound('Historical lead not found');
    await prisma.historicalLead.delete({ where: { id } });
    return { deleted: true };
  },

  // Manually add a historical lead. Resolves the assigned member's name for display.
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

  // Edit a historical lead. Only the fields present in `input` are changed.
  async updateLead(id: string, input: UpdateHistoricalLeadInput) {
    const existing = await prisma.historicalLead.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Historical lead not found');

    const data: Prisma.HistoricalLeadUncheckedUpdateInput = {};
    const scalarKeys = [
      'company', 'name', 'designation', 'email', 'mobile', 'city', 'country',
      'eventName', 'eventYear', 'industry', 'branchOffice', 'remark', 'specialRemarks', 'spaceSqm',
    ] as const;
    for (const k of scalarKeys) {
      if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k];
    }
    if (input.exhHistory !== undefined) data.exhHistory = input.exhHistory as unknown as Prisma.InputJsonValue;
    if (input.assignedUserId !== undefined) {
      data.assignedUserId = input.assignedUserId;
      if (input.assignedUserId) {
        const u = await prisma.user.findUnique({ where: { id: input.assignedUserId }, select: { firstName: true, lastName: true } });
        data.assignedTo = u ? `${u.firstName} ${u.lastName}` : null;
      } else {
        data.assignedTo = null;
      }
    }

    return prisma.historicalLead.update({
      where: { id },
      data,
      include: { assignedUser: { select: { id: true, firstName: true, lastName: true } } },
    });
  },
};
