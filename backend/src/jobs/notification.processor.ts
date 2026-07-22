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

// Future-ready dispatcher: persists an in-app notification now; EMAIL/WHATSAPP/
// SMS/PUSH adapters plug in here per channel.
export async function notificationProcessor(job: Job<NotificationJobData>): Promise<unknown> {
  const { userId, title, body, channel = 'IN_APP', data } = job.data;

  const record = await prisma.notification.create({
    data: { userId, title, body, channel, data: (data ?? undefined) as never, status: channel === 'IN_APP' ? 'SENT' : 'PENDING', sentAt: channel === 'IN_APP' ? new Date() : null },
  });

  if (channel !== 'IN_APP') {
    // TODO: dispatch via provider adapter (SES/Twilio/FCM); mark SENT/FAILED.
    logger.info(`[notification] ${channel} channel queued (adapter pending) for ${userId}`);
  }
  return { id: record.id };
}
