import type { Job } from 'bullmq';
import { startOfDay } from 'date-fns';
import { prisma } from '@config/prisma';
import { notificationQueue } from '@queues/index';
import { logger } from '@config/logger';

export async function followupSweepProcessor(_job: Job): Promise<unknown> {
  const cutoff = startOfDay(new Date());

  const due = await prisma.leadFollowup.findMany({
    where: { status: 'PENDING', followupDate: { lt: cutoff } },
    select: { id: true, assigneeId: true, leadId: true },
    take: 1000,
  });
  if (due.length === 0) return { overdue: 0 };

  await prisma.leadFollowup.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { status: 'OVERDUE' },
  });

  const byUser = new Map<string, number>();
  due.forEach((d) => byUser.set(d.assigneeId, (byUser.get(d.assigneeId) ?? 0) + 1));
  for (const [userId, count] of byUser) {
    await notificationQueue.add('followup-overdue', {
      userId, title: 'Overdue follow-ups', body: `You have ${count} follow-up(s) now overdue.`,
    });
  }

  logger.info(`[followup-sweep] marked ${due.length} overdue across ${byUser.size} users`);
  return { overdue: due.length, users: byUser.size };
}
