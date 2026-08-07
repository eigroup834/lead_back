import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { smsService } from '@services/sms.service';
import { mailService } from '@services/mail.service';
import { istDateTimeToUtc } from '@utils/ist';
import { emailShell, MAIL } from '@services/emailLayout';

let running = false;
let timer: NodeJS.Timeout | null = null;

const MS_PER_MINUTE = 60_000;
const MAX_PER_RUN = 500;
const NEWLINE = String.fromCharCode(10);

function buildMessage(params: { time: string; person: string; company: string }): string {
  const { time, person, company } = params;
  return `Dear Team Member ,You have a follow-up scheduled today at ${time} with ${person} from ${company} Log in to the lead crm portal for more details. @Exhibitions India`;
}

function buildEmail(params: { time: string; person: string; company: string; assignee: string; leadId?: string; note?: string | null }) {
  const { time, person, company, assignee, leadId, note } = params;
  const url = leadId ? `${env.APP_BASE_URL.replace(/\/$/, '')}/leads/${leadId}` : '';
  const rows: Array<[string, string]> = [
    ['Company', company],
    ['Contact', person],
    ['Scheduled for', `Today at ${time} (IST)`],
  ];
  if (note) rows.push(['Note', note]);

  const text = [
    `${assignee}, you have a follow-up scheduled today at ${time} with ${person} from ${company}.`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(url ? ['', `Open the lead: ${url}`] : []),
  ].join(NEWLINE);

  const html = emailShell({
    // Amber rather than indigo: this one is time-critical, and the colour says so
    // before the words do.
    accent: MAIL.amber,
    eyebrow: 'Follow-up due today',
    title: company,
    intro: `Hi ${assignee} — you have a follow-up scheduled with ${person} today.`,
    preheader: `Today at ${time} (IST) — ${person} at ${company}`,
    highlight: { label: 'Scheduled for', value: `Today at ${time} IST` },
    rows,
    cta: url ? { label: 'Open the lead', url } : undefined,
  });

  return { subject: `Follow-up today at ${time} — ${company}`, text, html };
}

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
    const from = new Date(now.getTime() - 24 * 60 * MS_PER_MINUTE);
    const to = new Date(now.getTime() + 48 * 60 * MS_PER_MINUTE);

    const candidates = await prisma.leadFollowup.findMany({
      where: {
        status: 'PENDING',
        followupDate: { gte: from, lte: to },
        reminderDaySentAt: null,
        lead: { deletedAt: null, status: { notIn: ['CONVERTED', 'LOST', 'INVALID', 'NOT_INTERESTED'] as never } },
      },
      take: MAX_PER_RUN,
      orderBy: { followupDate: 'asc' },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        lead: { select: { id: true, company: true, firstName: true, lastName: true } },
      },
    });

    if (!mailService.isConfigured()) {
      const waiting = candidates.length;
      if (waiting) {
        logger.warn(
          `[followup-reminder] ${trigger}: mail not configured — ${waiting} reminder(s) waiting, nothing sent or marked. ` +
            'Set MAIL_ENABLED=true and MAIL_HOST/USER/PASSWORD to deliver them.',
        );
      }
      return { sent: 0, skipped: waiting, failed: 0 };
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const fu of candidates) {
      const dueAt = istDateTimeToUtc(fu.followupDate, fu.followupTime ?? env.FOLLOWUP_REMINDER_DEFAULT_TIME);
      const dayAt = istDateTimeToUtc(fu.followupDate, env.FOLLOWUP_DAY_REMINDER_TIME);

      const dayDue = !fu.reminderDaySentAt && now.getTime() >= dayAt.getTime() && now.getTime() < dueAt.getTime();
      if (!dayDue) continue;

      if (!fu.assignee?.email) {
        skipped += 1;
        logger.warn(`[followup-reminder] no email for assignee ${fu.assigneeId} (follow-up ${fu.id})`);
        continue;
      }

      const person = [fu.lead?.firstName, fu.lead?.lastName].filter(Boolean).join(' ') || 'your contact';
      const company = fu.lead?.company || 'the company';
      const time = fu.followupTime ?? env.FOLLOWUP_REMINDER_DEFAULT_TIME;
      const assigneeName = `${fu.assignee.firstName} ${fu.assignee.lastName ?? ''}`.trim();

      const mail = buildEmail({ time, person, company, assignee: assigneeName, leadId: fu.lead?.id, note: fu.note });
      const result = await mailService.send({
        to: fu.assignee.email, ...mail,
        kind: 'FOLLOWUP_REMINDER', entityId: fu.id,
      });

      if (smsService.configured && fu.assignee.phone) {
        await smsService.send(fu.assignee.phone, buildMessage({ time, person, company }));
      }

      if (result.ok && !result.dryRun) {
        await prisma.leadFollowup.update({ where: { id: fu.id }, data: { reminderDaySentAt: new Date() } });
        sent += 1;
      } else if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        logger.warn(`[followup-reminder] day send failed for follow-up ${fu.id}: ${result.error}`);
      }
    }

    if (sent || failed || skipped) {
      logger.info(
        `[followup-reminder] ${trigger}: sent ${sent}, skipped ${skipped} (no email), failed ${failed}` +
          `${mailService.isConfigured() ? '' : ' [dry-run: MAIL_* not configured]'}`,
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
    `⏰ Follow-up email reminder scheduler started — every ${Math.round(env.FOLLOWUP_REMINDER_INTERVAL_MS / 1000)}s ` +
      `(IST day reminder at ${env.FOLLOWUP_DAY_REMINDER_TIME})` +
      `${mailService.isConfigured() ? '' : ' [dry-run: set MAIL_* env to go live]'}` +
      `${smsService.configured ? ' + SMS enabled' : ''}`,
  );
}

export function stopFollowupReminderScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
