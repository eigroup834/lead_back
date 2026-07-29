import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { prisma } from '@config/prisma';
import type { AuthUser } from '@/types';
import type { ListLeadsQuery } from './leads.validator';

// Row-level scope: who can a given user see?
// level 1/2 (Super Admin / Head): all leads
// level 3 (Team Leader): leads assigned to themselves or to their team members
// level 4 (Sales Executive): only own assigned leads
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
    // On the Assigned Leads page, filter by assignment date; otherwise by the
    // lead's registration date.
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

export const leadsRepository = {
  // Offset pagination + total count → drives a proper pager (page numbers,
  // page size, "X–Y of N"). Indexed filters keep this fast at scale.
  async list(user: AuthUser, q: ListLeadsQuery) {
    const scope = await scopeWhere(user);
    const filters = filterWhere(q);
    const where: Prisma.LeadWhereInput = { AND: [scope, filters] };

    const orderBy = [{ [q.sortBy]: q.sortDir }, { id: q.sortDir }] as Prisma.LeadOrderByWithRelationInput[];

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

  // All matching rows (no pagination) for export — same scope + filters as list.
  async exportRows(user: AuthUser, q: ListLeadsQuery) {
    const scope = await scopeWhere(user);
    const filters = filterWhere(q);
    const where: Prisma.LeadWhereInput = { AND: [scope, filters] };
    return prisma.lead.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 50000, // safety cap
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
