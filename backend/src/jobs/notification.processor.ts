import type { Job } from 'bullmq';
import { prisma } from '@config/prisma';
import { logger } from '@config/logger';

export interface NotificationJobData {
  userId: string;
  title: string;
  body?: string;
  channel?: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH';
  data?: Record<string, unknown>;
}

export async function notificationProcessor(job: Job<NotificationJobData>): Promise<unknown> {
  const { userId, title, body, channel = 'IN_APP', data } = job.data;

  const record = await prisma.notification.create({
    data: { userId, title, body, channel, data: (data ?? undefined) as never, status: channel === 'IN_APP' ? 'SENT' : 'PENDING', sentAt: channel === 'IN_APP' ? new Date() : null },
  });

  if (channel !== 'IN_APP') {
    logger.info(`[notification] ${channel} channel queued (adapter pending) for ${userId}`);
  }
  return { id: record.id };
}
