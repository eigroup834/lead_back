import { startOfDay, endOfDay, subDays, startOfMonth, subMonths } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '@config/prisma';
import { cache } from '@services/cache.service';

const TTL = 60; // dashboards tolerate 60s staleness

export interface DashFilter {
  dateFrom?: Date;
  dateTo?: Date;
  eventName?: string;
  country?: string;
  teamId?: string;
  userId?: string; // individual salesperson (assignee)
}

const keyOf = (f: DashFilter) =>
  `${f.dateFrom?.toISOString().slice(0, 10) ?? ''}_${f.dateTo?.toISOString().slice(0, 10) ?? ''}_${f.eventName ?? ''}_${f.country ?? ''}_${f.teamId ?? ''}_${f.userId ?? ''}`;

// Cache only the unfiltered (default) views; filtered queries compute fresh.
const isDefault = (f: DashFilter) =>
  !f.dateFrom && !f.dateTo && !f.eventName && !f.country && !f.teamId && !f.userId;

async function teamMemberIds(teamId?: string): Promise<string[] | null> {
  if (!teamId) return null;
  const members = await prisma.user.findMany({ where: { teamId }, select: { id: true } });
  return members.map((m) => m.id);
}

async function leadWhere(f: DashFilter): Promise<Prisma.LeadWhereInput> {
  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (f.dateFrom || f.dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (f.dateFrom) range.gte = startOfDay(f.dateFrom);
    if (f.dateTo) range.lte = endOfDay(f.dateTo);
    where.createdAt = range;
  }
  if (f.eventName) where.eventName = f.eventName;
  if (f.country) where.country = f.country;
  // individual takes precedence over team
  if (f.userId) {
    where.assignedUserId = f.userId;
  } else {
    const ids = await teamMemberIds(f.teamId);
    if (ids) where.assignedUserId = { in: ids };
  }
  return where;
}

async function remember<T>(name: string, f: DashFilter, fn: () => Promise<T>): Promise<T> {
  if (!isDefault(f)) return fn();
  return cache.remember(`dash:${name}:${keyOf(f)}`, TTL, fn);
}

export const dashboardService = {
  // Reference data for filter dropdowns.
  filters() {
    return cache.remember('dash:filters', 300, async () => {
      const [events, countries, teams, members] = await Promise.all([
        prisma.lead.groupBy({ by: ['eventName'], where: { deletedAt: null, eventName: { not: null } }, _count: { _all: true }, orderBy: { _count: { id: 'desc' } } }),
        prisma.lead.groupBy({ by: ['country'], where: { deletedAt: null, country: { not: null } }, _count: { _all: true }, orderBy: { _count: { id: 'desc' } } }),
        prisma.team.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({
          where: { deletedAt: null }, // all members, incl. Super Admin & Head
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ firstName: 'asc' }],
        }),
      ]);
      return {
        events: events.map((e) => e.eventName).filter(Boolean),
        countries: countries.map((c) => c.country).filter(Boolean),
        teams,
        members: members.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` })),
      };
    });
  },

  summary(f: DashFilter) {
    return remember('summary', f, async () => {
      const base = await leadWhere(f);
      const now = new Date();
      const and = (extra: Prisma.LeadWhereInput) => ({ AND: [base, extra] });
      const [total, today, assigned, unassigned, converted, lost] = await Promise.all([
        prisma.lead.count({ where: base }),
        prisma.lead.count({ where: and({ createdAt: { gte: startOfDay(now), lte: endOfDay(now) } }) }),
        prisma.lead.count({ where: and({ assignedUserId: { not: null } }) }),
        prisma.lead.count({ where: and({ assignedUserId: null }) }),
        prisma.lead.count({ where: and({ status: 'CONVERTED' }) }),
        prisma.lead.count({ where: and({ status: 'LOST' }) }),
      ]);
      const conversionRate = total ? Number(((converted / total) * 100).toFixed(2)) : 0;
      return { total, today, assigned, unassigned, converted, lost, conversionRate };
    });
  },

  funnel(f: DashFilter) {
    return remember('funnel', f, async () => {
      const where = await leadWhere(f);
      const grouped = await prisma.lead.groupBy({ by: ['status'], where, _count: { _all: true } });
      return grouped.map((g) => ({ status: g.status, count: g._count._all }));
    });
  },

  byEvent(f: DashFilter) {
    return remember('byEvent', f, async () => {
      const where = await leadWhere(f);
      const grouped = await prisma.lead.groupBy({ by: ['eventName'], where, _count: { _all: true }, orderBy: { _count: { id: 'desc' } }, take: 15 });
      return grouped.map((g) => ({ label: g.eventName ?? 'Unknown', count: g._count._all }));
    });
  },

  bySource(f: DashFilter) {
    return remember('bySource', f, async () => {
      const where = await leadWhere(f);
      const grouped = await prisma.lead.groupBy({ by: ['learnAbout'], where, _count: { _all: true }, orderBy: { _count: { id: 'desc' } }, take: 15 });
      return grouped.map((g) => ({ label: g.learnAbout ?? 'Unknown', count: g._count._all }));
    });
  },

  byCountry(f: DashFilter) {
    return remember('byCountry', f, async () => {
      const where = await leadWhere(f);
      const grouped = await prisma.lead.groupBy({ by: ['country'], where, _count: { _all: true }, orderBy: { _count: { id: 'desc' } }, take: 15 });
      return grouped.map((g) => ({ label: g.country ?? 'Unknown', count: g._count._all }));
    });
  },

  dailyTrend(f: DashFilter, days = 30) {
    return remember('daily', f, async () => {
      const from = f.dateFrom ? startOfDay(f.dateFrom) : subDays(startOfDay(new Date()), days);
      const conds = [Prisma.sql`deleted_at IS NULL`, Prisma.sql`created_at >= ${from}`];
      if (f.dateTo) conds.push(Prisma.sql`created_at <= ${endOfDay(f.dateTo)}`);
      if (f.eventName) conds.push(Prisma.sql`event_name = ${f.eventName}`);
      const ids = await teamMemberIds(f.teamId);
      if (ids?.length) conds.push(Prisma.sql`assigned_user_id IN (${Prisma.join(ids.map((i) => Prisma.sql`${i}::uuid`))})`);
      const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, count(*)::bigint AS count
        FROM leads WHERE ${Prisma.join(conds, ' AND ')}
        GROUP BY 1 ORDER BY 1`;
      return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
    });
  },

  monthlyTrend(f: DashFilter, months = 12) {
    return remember('monthly', f, async () => {
      const from = f.dateFrom ? startOfMonth(f.dateFrom) : startOfMonth(subMonths(new Date(), months));
      const conds = [Prisma.sql`deleted_at IS NULL`, Prisma.sql`created_at >= ${from}`];
      if (f.dateTo) conds.push(Prisma.sql`created_at <= ${endOfDay(f.dateTo)}`);
      if (f.eventName) conds.push(Prisma.sql`event_name = ${f.eventName}`);
      const ids = await teamMemberIds(f.teamId);
      if (ids?.length) conds.push(Prisma.sql`assigned_user_id IN (${Prisma.join(ids.map((i) => Prisma.sql`${i}::uuid`))})`);
      const rows = await prisma.$queryRaw<{ month: Date; count: bigint; converted: bigint }[]>`
        SELECT date_trunc('month', created_at) AS month,
               count(*)::bigint AS count,
               count(*) FILTER (WHERE status = 'CONVERTED')::bigint AS converted
        FROM leads WHERE ${Prisma.join(conds, ' AND ')}
        GROUP BY 1 ORDER BY 1`;
      return rows.map((r) => ({ month: r.month, count: Number(r.count), converted: Number(r.converted) }));
    });
  },

  // Team performance via groupBy (filter-friendly, no raw SQL).
  teamPerformance(f: DashFilter) {
    return remember('team', f, async () => {
      const leadBase = await leadWhere(f);
      const actWhere: Prisma.LeadActivityWhereInput = {};
      const fuWhere: Prisma.LeadFollowupWhereInput = { status: 'DONE' };
      if (f.dateFrom || f.dateTo) {
        const range: Prisma.DateTimeFilter = {};
        if (f.dateFrom) range.gte = startOfDay(f.dateFrom);
        if (f.dateTo) range.lte = endOfDay(f.dateTo);
        actWhere.activityDate = range;
      }

      const users = await prisma.user.findMany({
        where: {
          deletedAt: null,
          ...(f.userId ? { id: f.userId } : f.teamId ? { teamId: f.teamId } : {}),
          // all members, incl. Super Admin & Head
        },
        select: { id: true, firstName: true, lastName: true },
      });

      const [assignedG, convG, callsG, fuG] = await Promise.all([
        prisma.lead.groupBy({ by: ['assignedUserId'], where: { AND: [leadBase, { assignedUserId: { not: null } }] }, _count: { _all: true } }),
        prisma.lead.groupBy({ by: ['assignedUserId'], where: { AND: [leadBase, { status: 'CONVERTED' }] }, _count: { _all: true } }),
        prisma.leadActivity.groupBy({ by: ['userId'], where: { ...actWhere, type: 'CALL' }, _count: { _all: true } }),
        prisma.leadFollowup.groupBy({ by: ['assigneeId'], where: fuWhere, _count: { _all: true } }),
      ]);

      const m = (g: { _count: { _all: number } }[], key: string) =>
        new Map(g.map((x) => [(x as Record<string, unknown>)[key] as string, x._count._all]));
      const assignedM = m(assignedG, 'assignedUserId');
      const convM = m(convG, 'assignedUserId');
      const callsM = m(callsG, 'userId');
      const fuM = m(fuG, 'assigneeId');

      return users
        .map((u) => {
          const assigned = assignedM.get(u.id) ?? 0;
          const converted = convM.get(u.id) ?? 0;
          return {
            userId: u.id, name: `${u.firstName} ${u.lastName}`,
            assigned, converted, calls: callsM.get(u.id) ?? 0, followupsDone: fuM.get(u.id) ?? 0,
            conversionRate: assigned ? Number(((converted / assigned) * 100).toFixed(2)) : 0,
          };
        })
        .sort((a, b) => b.converted - a.converted || b.assigned - a.assigned);
    });
  },
};
