/**
 * Send one test SMS to verify the SmartPing integration end-to-end.
 *
 *   npx tsx scripts/test-sms.ts 9891080275
 *
 * Uses the same config/service the reminder job uses. With SMS_ENABLED=false it
 * only logs (dry-run); set SMS_ENABLED=true + SMS_USERNAME/PASSWORD to really send.
 */
import 'dotenv/config';
import { smsService } from '../src/services/sms.service';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npx tsx scripts/test-sms.ts <mobile>');
    process.exit(1);
  }
  const text =
    'Dear Team Member ,You have a follow-up scheduled today at 13:09 with Test Contact from Test Company Log in to the lead crm portal for more details. @Exhibitions India';

  console.log(`configured: ${smsService.configured} · sending to ${to} …`);
  const res = await smsService.send(to, text);
  console.log(res);
}

main().finally(() => process.exit(0));
