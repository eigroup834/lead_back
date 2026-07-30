import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@config/logger';

export interface MailResult {
  ok: boolean;
  dryRun?: boolean;
  messageId?: string;
  error?: string;
}

export interface MailMessage {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
}

function isConfigured(): boolean {
  return Boolean(env.MAIL_ENABLED && env.MAIL_HOST && env.MAIL_USER && env.MAIL_PASSWORD);
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD },
      connectionTimeout: env.MAIL_TIMEOUT_MS,
      greetingTimeout: env.MAIL_TIMEOUT_MS,
      socketTimeout: env.MAIL_TIMEOUT_MS,
    });
  }
  return transporter;
}

export const mailService = {
  isConfigured,

  async send(msg: MailMessage): Promise<MailResult> {
    const cc = msg.cc?.filter((a) => a && a !== msg.to) ?? [];

    if (!isConfigured()) {
      logger.info(
        `[mail] DRY RUN to=${msg.to} cc=${cc.length} subject="${msg.subject}" (set MAIL_ENABLED=true and MAIL_HOST/USER/PASSWORD to send)`,
      );
      return { ok: true, dryRun: true };
    }

    try {
      const info = await getTransporter().sendMail({
        from: env.MAIL_FROM,
        to: msg.to,
        cc: cc.length ? cc : undefined,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(`[mail] send failed to=${msg.to}: ${error}`);
      return { ok: false, error };
    }
  },
};
