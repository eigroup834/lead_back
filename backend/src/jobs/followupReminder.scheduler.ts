import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { smsService } from '@services/sms.service';
import { istDateTimeToUtc } from '@utils/ist';

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

// Must match the DLT-approved template exactly, with only the blanks filled:
//   "Dear Team Member ,You have a follow-up scheduled today at {time} with
//    {person} from {company} Log in to the lead crm portal for more details.
//    @Exhibitions India"
function buildMessage(params: { time: string; person: string; company: string }): string {
  const { time, person, company } = params;
  return `Dear Team Member ,You have a follow-up scheduled today at ${time} with ${person} from ${company} Log in to the lead crm portal for more details. @Exhibitions India`;
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
        followupDate: { gte: from, lte: to },
        reminderDaySentAt: null,
        // Don't remind for leads that are already closed (converted/lost/etc).
        lead: { deletedAt: null, status: { notIn: ['CONVERTED', 'LOST', 'INVALID', 'NOT_INTERESTED'] as never } },
      },
      take: MAX_PER_RUN,
      orderBy: { followupDate: 'asc' },
      include: {
        assignee: { select: { id: true, firstName: true, phone: true } },
        lead: { select: { company: true, firstName: true, lastName: true } },
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const fu of candidates) {
      const dueAt = istDateTimeToUtc(fu.followupDate, fu.followupTime ?? env.FOLLOWUP_REMINDER_DEFAULT_TIME);
      const dayAt = istDateTimeToUtc(fu.followupDate, env.FOLLOWUP_DAY_REMINDER_TIME);

      // Day-of reminder only: fires from the day-reminder time until the follow-up
      // time. (The "just before" reminder is intentionally disabled for now.)
      const dayDue = !fu.reminderDaySentAt && now.getTime() >= dayAt.getTime() && now.getTime() < dueAt.getTime();
      if (!dayDue) continue;

      if (!fu.assignee?.phone) {
        skipped += 1;
        logger.warn(`[followup-reminder] no phone for assignee ${fu.assigneeId} (follow-up ${fu.id})`);
        continue;
      }

      const person = [fu.lead?.firstName, fu.lead?.lastName].filter(Boolean).join(' ') || 'your contact';
      const company = fu.lead?.company || 'the company';
      const time = fu.followupTime ?? env.FOLLOWUP_REMINDER_DEFAULT_TIME;

      // Recipient mobile = the assigned user's phone (from the users table).
      const result = await smsService.send(fu.assignee.phone, buildMessage({ time, person, company }));
      if (result.ok) {
        await prisma.leadFollowup.update({ where: { id: fu.id }, data: { reminderDaySentAt: new Date() } });
        sent += 1;
      } else {
        failed += 1;
        logger.warn(`[followup-reminder] day send failed for follow-up ${fu.id}: ${result.error}`);
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
