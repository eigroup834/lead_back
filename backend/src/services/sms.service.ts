import { env } from '@config/env';
import { logger } from '@config/logger';

// Provider-agnostic SMS sender.
//
// ⚠️ ADAPT HERE when the SMS panel credentials arrive: `dispatch()` below is the
// only function that talks to the provider. Most Indian panels take either a GET
// with query params or a POST with JSON — set SMS_API_URL and adjust the payload
// keys to match the panel's documented contract. Everything else stays as-is.
//
// While SMS_ENABLED=false (or the URL/key is missing) sending is a dry run: the
// message is logged, nothing leaves the server, and callers still get ok:true so
// reminder bookkeeping can be exercised end-to-end before go-live.

export interface SmsResult {
  ok: boolean;
  dryRun?: boolean;
  providerId?: string;
  error?: string;
}

/**
 * Normalize a phone number to bare digits with a country code.
 * "+91 98765-43210" / "09876543210" / "9876543210" -> "919876543210".
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // strip a single leading 0 (local trunk prefix)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `${env.SMS_DEFAULT_COUNTRY_CODE}${digits}`;
  // 10-digit local + CC, or an already-prefixed international number
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

function isConfigured(): boolean {
  return Boolean(env.SMS_ENABLED && env.SMS_API_URL && env.SMS_API_KEY);
}

async function dispatch(to: string, message: string): Promise<SmsResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.SMS_TIMEOUT_MS);
  try {
    const res = await fetch(env.SMS_API_URL!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      // Payload keys follow the common Indian-panel shape. Rename to match the
      // provider's docs when the credentials land.
      body: JSON.stringify({
        apikey: env.SMS_API_KEY,
        secret: env.SMS_API_SECRET,
        sender: env.SMS_SENDER_ID,
        entity_id: env.SMS_ENTITY_ID,
        template_id: env.SMS_TEMPLATE_ID,
        to,
        message,
      }),
    });

    const text = await res.text();
    if (!res.ok) return { ok: false, error: `provider ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true, providerId: text.slice(0, 120) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

export const smsService = {
  get configured(): boolean {
    return isConfigured();
  },

  /** Send one SMS. Never throws — always resolves to a result the caller can log. */
  async send(rawPhone: string | null | undefined, message: string): Promise<SmsResult> {
    if (!rawPhone) return { ok: false, error: 'no phone number on record' };

    const to = normalizePhone(rawPhone);
    if (!to) return { ok: false, error: `unusable phone number "${rawPhone}"` };

    if (!isConfigured()) {
      logger.info(`[sms:dry-run] -> ${to}: ${message}`);
      return { ok: true, dryRun: true };
    }

    const result = await dispatch(to, message);
    if (result.ok) logger.info(`[sms] sent to ${to}`);
    else logger.warn(`[sms] failed for ${to}: ${result.error}`);
    return result;
  },
};
