import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('Lead CRM'),

  DATABASE_URL: z.string().url(),

  // Where the sync job reads leads from:
  //   'mssql' = direct SQL Server connection (SOURCE_DB_* below)
  //   'api'   = on-prem HTTP exporter (SOURCE_API_* below), for when the DB
  //             refuses outside connections.
  SOURCE_MODE: z.enum(['mssql', 'api']).default('mssql'),

  // External source DB (SQL Server) — used when SOURCE_MODE=mssql
  SOURCE_DB_TYPE: z.string().default('mssql'),
  SOURCE_DB_HOST: z.string().default('localhost'),
  SOURCE_DB_PORT: z.coerce.number().default(1433),
  SOURCE_DB_NAME: z.string().default('website_db'),
  SOURCE_DB_USER: z.string().default('sa'),
  SOURCE_DB_PASSWORD: z.string().default(''),
  SOURCE_DB_ENCRYPT: z.coerce.boolean().default(true),
  SOURCE_DB_TRUST_CERT: z.coerce.boolean().default(true),

  // On-prem exporter API (ExhiRegExport.ashx) — used when SOURCE_MODE=api
  SOURCE_API_URL: z.string().url().optional(),
  SOURCE_API_KEY: z.string().default(''),
  SOURCE_API_TIMEOUT_MS: z.coerce.number().default(20_000),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  COOKIE_SECRET: z.string().default('dev-cookie-secret'),
  // key material for the reversible password-reveal feature (SUPER_ADMIN only)
  PASSWORD_ENC_SECRET: z.string().default('CHANGE_ME_password_reveal_secret_key'),

  SYNC_ENABLED: z.coerce.boolean().default(true),
  // In-process sync scheduler cadence (ms). No Redis/worker needed — the API
  // server runs the sync directly on this interval. Default 5 minutes.
  SYNC_INTERVAL_MS: z.coerce.number().default(300_000),
  SYNC_CRON: z.string().default('*/5 * * * *'), // legacy (BullMQ); unused by the in-process scheduler
  SYNC_BATCH_SIZE: z.coerce.number().default(500),

  // ---- SMS (SmartPing / SPARC — follow-up reminders to the assigned rep) ----
  // Set SMS_USERNAME + SMS_PASSWORD in .env and SMS_ENABLED=true to go live.
  // While SMS_ENABLED=false the reminder job still runs and logs a dry-run.
  SMS_ENABLED: z.coerce.boolean().default(false),
  SMS_API_URL: z.string().url().default('https://pgapi.sparc.smartping.io/fe/api/v1/send'),
  SMS_USERNAME: z.string().default(''),      // e.g. eitra01.trans
  SMS_PASSWORD: z.string().default(''),       // panel password (secret — .env only)
  SMS_SENDER_ID: z.string().default('EXHIGR'), // approved header/from
  // DLT (TRAI) compliance ids tied to the approved template.
  SMS_DLT_CONTENT_ID: z.string().default('1777178462705937936'),
  SMS_DLT_ENTITY_ID: z.string().default('1301161355478774851'),
  SMS_TIMEOUT_MS: z.coerce.number().default(15_000),
  // Default country code applied to 10-digit local numbers.
  SMS_DEFAULT_COUNTRY_CODE: z.string().default('91'),

  // ---- Email (assignment notifications) ----
  // Set MAIL_HOST/MAIL_USER/MAIL_PASSWORD and MAIL_ENABLED=true to go live.
  // While MAIL_ENABLED=false the app still composes each message and logs a
  // dry-run, so the flow can be exercised before SMTP credentials exist.
  MAIL_ENABLED: z.coerce.boolean().default(false),
  MAIL_HOST: z.string().default(''),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_SECURE: z.coerce.boolean().default(false), // true for port 465 (implicit TLS)
  MAIL_USER: z.string().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().default('Lead CRM <no-reply@exhibitor.local>'),
  MAIL_TIMEOUT_MS: z.coerce.number().default(15_000),
  // Base URL used to build "open the lead" links inside emails.
  APP_BASE_URL: z.string().default('http://localhost:5173'),

  // ---- Duplicate check against the historical archive ----
  // Trigram similarity (0-1) at or above which an assigned lead's company is
  // flagged as already present in Historical Data.
  HISTORICAL_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.9),

  // ---- Follow-up reminders ----
  FOLLOWUP_REMINDER_ENABLED: z.coerce.boolean().default(true),
  // How often the in-process scheduler scans for due reminders (ms).
  FOLLOWUP_REMINDER_INTERVAL_MS: z.coerce.number().default(300_000), // 5 min
  // The "just before" reminder fires this many minutes before the follow-up time (IST).
  FOLLOWUP_REMINDER_LEAD_MINUTES: z.coerce.number().default(10),
  // The day-of reminder fires at this IST time on the follow-up date.
  FOLLOWUP_DAY_REMINDER_TIME: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  // Time (IST, HH:mm) assumed when a follow-up has a date but no time.
  FOLLOWUP_REMINDER_DEFAULT_TIME: z.string().regex(/^\d{2}:\d{2}$/).default('10:00'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./storage'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@exhibitor.local'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@12345'),
}).superRefine((val, ctx) => {
  if (val.SOURCE_MODE === 'api') {
    if (!val.SOURCE_API_URL)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SOURCE_API_URL'], message: 'Required when SOURCE_MODE=api' });
    if (!val.SOURCE_API_KEY)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SOURCE_API_KEY'], message: 'Required when SOURCE_MODE=api' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
