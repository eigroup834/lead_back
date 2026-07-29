import { Router } from 'express';
import { z } from 'zod';
import { startOfDay, endOfDay } from 'date-fns';
import { Prisma, type LeadStatus } from '@prisma/client';
import { prisma } from '@config/prisma';
import { AppError } from '@utils/AppError';
import { ok, created } from '@utils/response';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import type { AuthUser } from '@/types';

const createSchema = z.object({
  followupDate: z.coerce.date(),
  followupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  note: z.string().max(1000).optional(),
  assigneeId: z.string().uuid().optional(),
});
const updateSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'CANCELLED']).optional(),
  followupDate: z.coerce.date().optional(),
  followupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  note: z.string().max(1000).optional(),
});
const listQuery = z.object({
  scope: z.enum(['mine', 'overdue', 'upcoming', 'today', 'all']).default('mine'),
  days: z.coerce.number().int().min(1).max(365).default(7),
  // Managers/admins only: narrow to a single teammate's follow-ups.
  assigneeId: z.string().uuid().optional(),
});

// Executives (level >= 4) are scoped to their own follow-ups and cannot filter by
// assignee. Managers/admins see everyone by default and may narrow to one teammate.
function assigneeScope(user: AuthUser, assigneeId?: string): Prisma.LeadFollowupWhereInput {
  if (user.level >= 4) return { assigneeId: user.id };
  if (assigneeId) return { assigneeId };
  return {};
}

// A lead in one of these states is closed — its pending follow-ups drop off the list.
const CLOSED_LEAD_STATUSES = ['CONVERTED', 'LOST', 'INVALID', 'NOT_INTERESTED'] as const;
const OPEN_LEAD: Prisma.LeadFollowupWhereInput = {
  lead: { deletedAt: null, status: { notIn: CLOSED_LEAD_STATUSES as unknown as LeadStatus[] } },
};

const LEAD_INCLUDE = {
  lead: {
    select: {
      id: true, company: true, firstName: true, lastName: true, email: true, mobile: true,
      phone: true, designation: true, country: true, city: true, eventName: true,
      status: true, priority: true,
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  assignee: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LeadFollowupInclude;

export const followupsService = {
  async create(leadId: string, user: AuthUser, input: z.infer<typeof createSchema>) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
    if (!lead) throw AppError.notFound('Lead not found');
    return prisma.leadFollowup.create({
      data: { leadId, assigneeId: input.assigneeId ?? user.id, followupDate: input.followupDate, followupTime: input.followupTime, priority: input.priority, note: input.note },
    });
  },

  list(user: AuthUser, q: z.infer<typeof listQuery>) {
    const now = new Date();
    const base = assigneeScope(user, q.assigneeId);
    // 'all'/'mine' = every pending follow-up regardless of date. The dated scopes
    // narrow by followupDate; 'upcoming' is everything after today (no upper cap),
    // so a follow-up several weeks out still shows up.
    let where: Prisma.LeadFollowupWhereInput = { ...base, ...OPEN_LEAD, status: 'PENDING' };
    if (q.scope === 'overdue') where.followupDate = { lt: startOfDay(now) };
    else if (q.scope === 'today') where.followupDate = { gte: startOfDay(now), lte: endOfDay(now) };
    else if (q.scope === 'upcoming') where.followupDate = { gt: endOfDay(now) };
    else if (q.scope === 'all') where = { ...base, ...OPEN_LEAD, status: 'PENDING' };
    return prisma.leadFollowup.findMany({
      where,
      orderBy: [{ followupDate: 'asc' }, { priority: 'desc' }],
      take: 500,
      include: LEAD_INCLUDE,
    });
  },

  // Counts per scope for the tab badges (same assignee scope as the list).
  async counts(user: AuthUser, assigneeId?: string) {
    const now = new Date();
    const base: Prisma.LeadFollowupWhereInput = { ...assigneeScope(user, assigneeId), ...OPEN_LEAD, status: 'PENDING' };
    const [overdue, today, upcoming, all] = await prisma.$transaction([
      prisma.leadFollowup.count({ where: { ...base, followupDate: { lt: startOfDay(now) } } }),
      prisma.leadFollowup.count({ where: { ...base, followupDate: { gte: startOfDay(now), lte: endOfDay(now) } } }),
      prisma.leadFollowup.count({ where: { ...base, followupDate: { gt: endOfDay(now) } } }),
      prisma.leadFollowup.count({ where: base }),
    ]);
    return { overdue, today, upcoming, all };
  },

  async update(id: string, user: AuthUser, input: z.infer<typeof updateSchema>) {
    const fu = await prisma.leadFollowup.findUnique({ where: { id } });
    if (!fu) throw AppError.notFound('Follow-up not found');
    if (user.level >= 4 && fu.assigneeId !== user.id) throw AppError.forbidden();
    const data: Prisma.LeadFollowupUpdateInput = { ...input };
    if (input.status === 'DONE') data.completedAt = new Date();
    // Rescheduling re-arms both SMS reminders for the new date/time.
    if (input.followupDate !== undefined || input.followupTime !== undefined) {
      data.reminderSentAt = null;
      data.reminderDaySentAt = null;
    }
    return prisma.leadFollowup.update({ where: { id }, data });
  },
};

const router = Router();
router.use(authenticate);

router.get('/followups', requirePermission('lead.view'), validate({ query: listQuery }), asyncHandler(async (req, res) => ok(res, await followupsService.list(req.user!, req.query as never))));
router.get('/followups/counts', requirePermission('lead.view'), asyncHandler(async (req, res) => ok(res, await followupsService.counts(req.user!, req.query.assigneeId as string | undefined))));
router.post('/leads/:id/followups', requirePermission('lead.followup'), validate({ params: z.object({ id: z.string().uuid() }), body: createSchema }), asyncHandler(async (req, res) => created(res, await followupsService.create(req.params.id, req.user!, req.body))));
router.patch('/followups/:id', requirePermission('lead.followup'), validate({ params: z.object({ id: z.string().uuid() }), body: updateSchema }), asyncHandler(async (req, res) => ok(res, await followupsService.update(req.params.id, req.user!, req.body))));

export default router;
