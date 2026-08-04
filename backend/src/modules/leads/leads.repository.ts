import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { prisma } from '@config/prisma';
import type { AuthUser } from '@/types';
import type { ListLeadsQuery } from './leads.validator';

async function scopeWhere(user: AuthUser): Promise<Prisma.LeadWhereInput> {
  if (user.level <= 2) return {};
  if (user.level === 3) {
    const team = await prisma.user.findMany({
      where: { OR: [{ managerId: user.id }, { teamId: user.teamId ?? undefined }] },
      select: { id: true },
    });
    const ids = [user.id, ...team.map((t) => t.id)];
    return { assignedUserId: { in: ids } };
  }
  return { assignedUserId: user.id };
}

function filterWhere(q: ListLeadsQuery): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (q.status?.length) where.status = { in: q.status };
  if (q.eventName) where.eventName = q.eventName;
  if (q.country) where.country = q.country;
  if (q.sourceChannel) where.sourceChannel = q.sourceChannel;
  if (q.source) where.source = q.source;
  if (q.unassigned) where.assignedUserId = null;
  else if (q.assignedUserId) where.assignedUserId = q.assignedUserId;
  else if (q.assigned) where.assignedUserId = { not: null };
  if (q.dateFrom || q.dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (q.dateFrom) range.gte = startOfDay(q.dateFrom);
    if (q.dateTo) range.lte = endOfDay(q.dateTo);
    if (q.assigned) where.assignedAt = range;
    else where.createDate = range;
  }
  if (q.q) {
    where.OR = [
      { company: { contains: q.q, mode: 'insensitive' } },
      { email: { contains: q.q, mode: 'insensitive' } },
      { firstName: { contains: q.q, mode: 'insensitive' } },
      { lastName: { contains: q.q, mode: 'insensitive' } },
      { mobile: { contains: q.q } },
      { phone: { contains: q.q } },
    ];
  }
  return where;
}

const RELATION_SORTS: Record<string, (dir: Prisma.SortOrder) => Prisma.LeadOrderByWithRelationInput> = {
  assignedUser: (dir) => ({ assignedUser: { firstName: dir } }),
};
const NULLABLE_SORTS = new Set(['createDate', 'company', 'firstName', 'email', 'mobile', 'country', 'sourceChannel', 'shellSpace', 'industry']);

function orderByOf(q: ListLeadsQuery): Prisma.LeadOrderByWithRelationInput[] {
  const relation = RELATION_SORTS[q.sortBy];
  const primary = (relation
    ? relation(q.sortDir)
    : NULLABLE_SORTS.has(q.sortBy)
      ? { [q.sortBy]: { sort: q.sortDir, nulls: 'last' } }
      : { [q.sortBy]: q.sortDir }) as Prisma.LeadOrderByWithRelationInput;
  return [primary, { id: q.sortDir }];
}

export const leadsRepository = {
  async list(user: AuthUser, q: ListLeadsQuery) {
    const scope = await scopeWhere(user);
    const filters = filterWhere(q);
    const where: Prisma.LeadWhereInput = { AND: [scope, filters] };

    const orderBy = orderByOf(q);

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { assignedUser: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      items,
      meta: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) },
    };
  },

  async exportRows(user: AuthUser, q: ListLeadsQuery) {
    const scope = await scopeWhere(user);
    const filters = filterWhere(q);
    const where: Prisma.LeadWhereInput = { AND: [scope, filters] };
    return prisma.lead.findMany({
      where,
      orderBy: orderByOf(q),
      take: 50000,
      include: { assignedUser: { select: { firstName: true, lastName: true } } },
    });
  },

  async findById(id: string) {
    return prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 50, include: { changedBy: { select: { firstName: true, lastName: true } } } },
        assignments: { orderBy: { createdAt: 'desc' }, take: 50, include: { assignedTo: { select: { firstName: true, lastName: true } }, assignedBy: { select: { firstName: true, lastName: true } } } },
        notes: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { author: { select: { firstName: true, lastName: true } } } },
        followups: { orderBy: { followupDate: 'asc' } },
        attachments: { where: { deletedAt: null } },
      },
    });
  },
};
