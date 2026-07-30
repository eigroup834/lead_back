import { Prisma } from '@prisma/client';
import { prisma } from '@config/prisma';
import { redis } from '@config/redis';
import { cache } from '@services/cache.service';
import { AppError } from '@utils/AppError';
import { assertAssignableUser, filterAssignableUsers } from '@services/user.guard';
import { notifyAssignments } from './assignment.mailer';
import type { AssignBulkInput, AssignSingleInput, AutoAssignInput } from './assignment.validator';

async function nextRoundRobinIndex(poolKey: string, poolSize: number): Promise<number> {
  const n = await redis.incr(`rr:${poolKey}`);
  return (n - 1) % poolSize;
}

async function assignOne(
  tx: Prisma.TransactionClient,
  leadId: string,
  assignToId: string,
  assignedById: string,
  type: 'SINGLE' | 'BULK' | 'AUTO' | 'REASSIGN',
  strategy: 'MANUAL' | 'ROUND_ROBIN',
  note?: string,
) {
  const existing = await tx.lead.findUnique({ where: { id: leadId }, select: { status: true, assignedUserId: true } });
  if (!existing) return false;
  const realType = existing.assignedUserId && existing.assignedUserId !== assignToId ? 'REASSIGN' : type;

  await tx.lead.update({
    where: { id: leadId },
    data: { assignedUserId: assignToId, assignedAt: new Date(), status: existing.status === 'NEW' ? 'ASSIGNED' : existing.status },
  });
  await tx.leadAssignment.create({
    data: { leadId, assignedToId: assignToId, assignedById, type: realType, strategy, note },
  });
  if (existing.status === 'NEW') {
    await tx.leadStatusHistory.create({
      data: { leadId, fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: assignedById },
    });
  }
  return true;
}

async function bustDashboard() {
  await cache.delPattern('dash:*');
}

export const assignmentService = {
  async single(input: AssignSingleInput, byId: string) {
    await assertAssignableUser(input.assignToId);
    await prisma.$transaction((tx) => assignOne(tx, input.leadId, input.assignToId, byId, 'SINGLE', 'MANUAL', input.note));
    await bustDashboard();
    notifyAssignments([input.leadId], input.assignToId, byId);
    return { leadId: input.leadId, assignedTo: input.assignToId };
  },

  async bulk(input: AssignBulkInput, byId: string) {
    await assertAssignableUser(input.assignToId);
    await prisma.$transaction(async (tx) => {
      for (const leadId of input.leadIds) {
        await assignOne(tx, leadId, input.assignToId, byId, 'BULK', 'MANUAL', input.note);
      }
    });
    await bustDashboard();
    notifyAssignments(input.leadIds, input.assignToId, byId);
    return { count: input.leadIds.length, assignedTo: input.assignToId };
  },

  async auto(input: AutoAssignInput, byId: string) {
    let pool = input.poolUserIds ? await filterAssignableUsers(input.poolUserIds) : undefined;
    if (!pool) {
      const where: Prisma.UserWhereInput = {
        deletedAt: null,
        status: 'ACTIVE',
        roles: { some: { role: { name: 'SALES_EXECUTIVE' } } },
        ...(input.teamId ? { teamId: input.teamId } : {}),
      };
      const users = await prisma.user.findMany({ where, select: { id: true } });
      pool = users.map((u) => u.id);
    }
    if (!pool.length) throw AppError.badRequest('No eligible users in assignment pool');

    const poolKey = input.teamId ?? 'global';
    const result: Record<string, number> = {};
    const perAssignee = new Map<string, string[]>();

    await prisma.$transaction(async (tx) => {
      for (const leadId of input.leadIds) {
        const idx = await nextRoundRobinIndex(poolKey, pool!.length);
        const assignTo = pool![idx];
        const okAssigned = await assignOne(tx, leadId, assignTo, byId, 'AUTO', 'ROUND_ROBIN');
        if (okAssigned) {
          result[assignTo] = (result[assignTo] ?? 0) + 1;
          perAssignee.set(assignTo, [...(perAssignee.get(assignTo) ?? []), leadId]);
        }
      }
    });
    await bustDashboard();
    for (const [assignTo, ids] of perAssignee) notifyAssignments(ids, assignTo, byId);
    return { strategy: input.strategy, distribution: result, total: input.leadIds.length };
  },
};
