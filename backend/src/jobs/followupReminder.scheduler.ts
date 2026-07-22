import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { smsService } from '@services/sms.service';
import { istDateTimeToUtc, formatIst } from '@utils/ist';

// In-process follow-up SMS reminder scheduler. Mirrors sync.scheduler.ts: no
// Redis, no BullMQ, no separate worker — the API server scans on an interval.
//
// A reminder fires once per follow-up, LEAD_MINUTES before its IST due time, to
// the assigned rep's phone (users.phone). `reminderSentAt` is the idempotency
// guard; rescheduling a follow-up clears it so the new time re-arms a reminder.

let running = false;
let timer: NodeJS.Timeout | null = null;

const MS_PER_MINUTE = 60_000;
const MAX_PER_RUN = 500;

function buildMessage(params: {
  repFirstName: string;
  leadLabel: string;
  dueAt: Date;
  note: string | null;
}): string {
  const { repFirstName, leadLabel, dueAt, note } = params;
  const tail = note ? ` Note: ${note.slice(0, 80)}` : '';
  return `Hi ${repFirstName}, reminder: follow-up with ${leadLabel} at ${formatIst(dueAt)} IST.${tail}`;
}

/** Scan for due follow-ups and send their reminders. Skips if a run is in progress. */
export async function runFollowupRemindersNow(
  trigger: 'startup' | 'interval' | 'manual',
): Promise<{ sent: number; skipped: number; failed: number }> {
  if (running) {
    logger.info(`[followup-reminder] ${trigger} trigger skipped — a run is already in progress`);
    return { sent: 0, skipped: 0, failed: 0 };
  }
  running = true;

  try {
    const now = new Date();
    // Widen the DB scan by a day either side of "now" so timezone/lead-time maths
    // is done precisely in JS rather than in the date-only SQL predicate.
    const from = new Date(now.getTime() - 24 * 60 * MS_PER_MINUTE);
    const to = new Date(now.getTime() + 48 * 60 * MS_PER_MINUTE);

    const candidates = await prisma.leadFollowup.findMany({
      where: {
        status: 'PENDING',
        reminderSentAt: null,
        followupDate: { gte: from, lte: to },
      },
      take: MAX_PER_RUN,
      orderBy: { followupDate: 'asc' },
      include: {
        assignee: { select: { id: true, firstName: true, phone: true } },
        lead: { select: { company: true, firstName: true, lastName: true } },
      },
    });

    const windowMs = env.FOLLOWUP_REMINDER_LEAD_MINUTES * MS_PER_MINUTE;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const fu of candidates) {
      const dueAt = istDateTimeToUtc(fu.followupDate, fu.followupTime ?? env.FOLLOWUP_REMINDER_DEFAULT_TIME);

      // Not yet inside the reminder window.
      if (dueAt.getTime() - now.getTime() > windowMs) continue;
      // Far past (>12h late) — the overdue sweep owns these; don't spam.
      if (now.getTime() - dueAt.getTime() > 12 * 60 * MS_PER_MINUTE) continue;

      if (!fu.assignee?.phone) {
        skipped += 1;
        logger.warn(`[followup-reminder] no phone for assignee ${fu.assigneeId} (follow-up ${fu.id})`);
        continue;
      }

      const leadLabel =
        fu.lead?.company || [fu.lead?.firstName, fu.lead?.lastName].filter(Boolean).join(' ') || 'your lead';

      const result = await smsService.send(
        fu.assignee.phone,
        buildMessage({ repFirstName: fu.assignee.firstName, leadLabel, dueAt, note: fu.note }),
      );

      if (result.ok) {
        // Dry runs mark as sent too, so the pipeline is verifiable before go-live.
        await prisma.leadFollowup.update({ where: { id: fu.id }, data: { reminderSentAt: new Date() } });
        sent += 1;
      } else {
        failed += 1;
        logger.warn(`[followup-reminder] send failed for follow-up ${fu.id}: ${result.error}`);
      }
    }

    if (sent || failed || skipped) {
      logger.info(
        `[followup-reminder] ${trigger}: sent ${sent}, skipped ${skipped} (no phone), failed ${failed}` +
          `${smsService.configured ? '' : ' [dry-run: SMS not configured]'}`,
      );
    }
    return { sent, skipped, failed };
  } catch (err) {
    logger.error('[followup-reminder] run failed', { error: err instanceof Error ? err.message : String(err) });
    return { sent: 0, skipped: 0, failed: 0 };
  } finally {
    running = false;
  }
}

/** Start the recurring in-process reminder scheduler. Idempotent. */
export function startFollowupReminderScheduler(): void {
  if (!env.FOLLOWUP_REMINDER_ENABLED) {
    logger.info('[followup-reminder] scheduler disabled (FOLLOWUP_REMINDER_ENABLED=false)');
    return;
  }
  if (timer) return;

  setTimeout(() => void runFollowupRemindersNow('startup'), 10_000);
  timer = setInterval(() => void runFollowupRemindersNow('interval'), env.FOLLOWUP_REMINDER_INTERVAL_MS);
  timer.unref?.();

  logger.info(
    `⏰ Follow-up SMS reminder scheduler started — every ${Math.round(env.FOLLOWUP_REMINDER_INTERVAL_MS / 1000)}s, ` +
      `${env.FOLLOWUP_REMINDER_LEAD_MINUTES}min before due (IST)` +
      `${smsService.configured ? '' : ' [dry-run: set SMS_* env to go live]'}`,
  );
}

/** Stop the recurring scheduler (used on shutdown). */
export function stopFollowupReminderScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
