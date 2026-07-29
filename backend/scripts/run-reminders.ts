/**
 * Force one follow-up reminder scan right now (instead of waiting for the 5-min
 * tick). Processes every due follow-up in the reminder window and sends/logs it.
 *
 *   npx tsx scripts/run-reminders.ts
 *
 * Respects the same window rules and the reminderSentAt guard. To re-test the
 * same follow-up, clear its guard first:
 *   UPDATE lead_followups SET reminder_sent_at = NULL WHERE id = '<id>';
 */
import 'dotenv/config';
import { runFollowupRemindersNow } from '../src/jobs/followupReminder.scheduler';
import { prisma } from '../src/config/prisma';

async function main() {
  const res = await runFollowupRemindersNow('manual');
  console.log('reminder run:', res);
}

main().finally(() => prisma.$disconnect());
