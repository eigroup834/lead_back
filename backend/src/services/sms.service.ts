import { env } from '@config/env';
import { logger } from '@config/logger';

// SMS sender for SmartPing / SPARC (pgapi.sparc.smartping.io).
//
// It's a GET with query params: username, password, from (DLT header), text,
// to (10-digit), and the DLT content/entity ids. `dispatch()` is the only
// function that talks to the provider.
//
// While SMS_ENABLED=false (or username/password missing) sending is a dry run:
// the message is logged, nothing leaves the server, and callers still get
// ok:true so reminder bookkeeping can be exercised end-to-end before go-live.

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
  return Boolean(env.SMS_ENABLED && env.SMS_API_URL && env.SMS_USERNAME && env.SMS_PASSWORD);
}

async function dispatch(to: string, text: string): Promise<SmsResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.SMS_TIMEOUT_MS);
  try {
    // SmartPing expects the bare 10-digit number. Build the query with
    // encodeURIComponent so spaces are %20 (not '+') — matching the panel's curl.
    const query = Object.entries({
      username: env.SMS_USERNAME,
      password: env.SMS_PASSWORD,
      unicode: 'false',
      from: env.SMS_SENDER_ID,
      text,
      to: to.slice(-10),
      dltContentId: env.SMS_DLT_CONTENT_ID,
      dltPrincipalEntityId: env.SMS_DLT_ENTITY_ID,
    })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const res = await fetch(`${env.SMS_API_URL}?${query}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    const body = await res.text();
    if (!res.ok) return { ok: false, error: `provider ${res.status}: ${body.slice(0, 200)}` };
    return { ok: true, providerId: body.slice(0, 160) };
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
