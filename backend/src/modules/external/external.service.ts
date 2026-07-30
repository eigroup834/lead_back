import { Prisma } from '@prisma/client';
import { prisma } from '@config/prisma';
import { cache } from '@services/cache.service';
import { AppError } from '@utils/AppError';
import type { AuthUser } from '@/types';
import { assertAssignableUser } from '@services/user.guard';
import type { ListExternalQuery } from './external.validator';

async function bustDashboard() {
  await cache.delPattern('dash:*');
}

const ASSIGNEE_SELECT = { id: true, firstName: true, lastName: true };

function scopeWhere(user: AuthUser): Prisma.ExternalLeadWhereInput {
  return user.level === 1 ? {} : { assignedUserId: user.id };
}

const EXTERNAL_RELATION_SORTS: Record<string, (dir: Prisma.SortOrder) => Prisma.ExternalLeadOrderByWithRelationInput> = {
  assignedUser: (dir) => ({ assignedUser: { firstName: dir } }),
};
const EXTERNAL_NULLABLE_SORTS = new Set(['createDate', 'company', 'email', 'mobile', 'designation', 'eventName']);

function externalOrderBy(q: ListExternalQuery): Prisma.ExternalLeadOrderByWithRelationInput[] {
  const relation = EXTERNAL_RELATION_SORTS[q.sortBy];
  const primary = (relation
    ? relation(q.sortDir)
    : EXTERNAL_NULLABLE_SORTS.has(q.sortBy)
      ? { [q.sortBy]: { sort: q.sortDir, nulls: 'last' } }
      : { [q.sortBy]: q.sortDir }) as Prisma.ExternalLeadOrderByWithRelationInput;
  return [primary, { id: q.sortDir }];
}

export const externalService = {
  async list(user: AuthUser, q: ListExternalQuery) {
    const where: Prisma.ExternalLeadWhereInput = { deletedAt: null, syncStatus: null, ...scopeWhere(user) };
    if (q.category) where.category = q.category;
    if (q.q) {
      where.OR = [
        { company: { contains: q.q, mode: 'insensitive' } },
        { name: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q, mode: 'insensitive' } },
        { mobile: { contains: q.q } },
        { eventName: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const orderBy = externalOrderBy(q);
    const [items, total] = await Promise.all([
      prisma.externalLead.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { assignedUser: { select: ASSIGNEE_SELECT } },
      }),
      prisma.externalLead.count({ where }),
    ]);
    return { items, meta: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) } };
  },

  async counts(user: AuthUser) {
    const grouped = await prisma.externalLead.groupBy({
      by: ['category'],
      where: { deletedAt: null, syncStatus: null, ...scopeWhere(user) },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const g of grouped) out[g.category] = g._count._all;
    return out;
  },

  async assign(ids: string[], assignToId: string) {
    await assertAssignableUser(assignToId);
    const res = await prisma.externalLead.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { assignedUserId: assignToId },
    });
    return { assigned: res.count, total: ids.length };
  },

  async sync(ids: string[]) {
    const res = await prisma.externalLead.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { syncStatus: 'PENDING' },
    });
    return { queued: res.count, total: ids.length };
  },

  async convertOne(tx: Prisma.TransactionClient, ext: Prisma.ExternalLeadGetPayload<object>) {
    const created = await tx.lead.create({
      data: {
        company: ext.company,
        firstName: ext.firstName,
        lastName: ext.lastName,
        email: ext.email,
        mobile: ext.mobile,
        designation: ext.designation,
        eventName: ext.eventName,
        ipAddress: ext.ipAddress,
        createDate: ext.createDate,
        source: ext.source,
        sourceChannel: ext.sourceChannel,
        leadType: 'EXHIBITION',
        status: 'NEW',
      },
    });
    await tx.externalLead.update({ where: { id: ext.id }, data: { deletedAt: new Date() } });
    return created;
  },

  async reclassify(id: string, category: Prisma.ExternalLeadCreateInput['category']) {
    const ext = await prisma.externalLead.findFirst({ where: { id, deletedAt: null } });
    if (!ext) throw AppError.notFound('External lead not found');
    const updated = await prisma.externalLead.update({ where: { id }, data: { category } });
    await bustDashboard();
    return updated;
  },

  async convertToExhibitor(id: string) {
    const ext = await prisma.externalLead.findFirst({ where: { id, deletedAt: null } });
    if (!ext) throw AppError.notFound('External lead not found');
    const lead = await prisma.$transaction((tx) => this.convertOne(tx, ext));
    await bustDashboard();
    return lead;
  },

  async bulkConvertToExhibitor(ids: string[]) {
    const rows = await prisma.externalLead.findMany({ where: { id: { in: ids }, deletedAt: null } });
    let converted = 0;
    for (const ext of rows) {
      await prisma.$transaction((tx) => this.convertOne(tx, ext));
      converted += 1;
    }
    if (converted > 0) await bustDashboard();
    return { converted, skipped: ids.length - converted, total: ids.length };
  },
};
