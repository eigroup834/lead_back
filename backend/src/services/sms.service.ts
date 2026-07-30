import { env } from '@config/env';
import { logger } from '@config/logger';

export interface SmsResult {
  ok: boolean;
  dryRun?: boolean;
  providerId?: string;
  error?: string;
}

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `${env.SMS_DEFAULT_COUNTRY_CODE}${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

function isConfigured(): boolean {
  return Boolean(env.SMS_ENABLED && env.SMS_API_URL && env.SMS_USERNAME && env.SMS_PASSWORD);
}

async function dispatch(to: string, text: string): Promise<SmsResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.SMS_TIMEOUT_MS);
  try {
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
