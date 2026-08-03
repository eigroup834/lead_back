import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envBool = (def: boolean) =>
  z.string().optional().transform((v) => {
    if (v === undefined || v.trim() === '') return def;
    return !/^(false|0|no|off)$/i.test(v.trim());
  });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('Lead CRM'),

  DATABASE_URL: z.string().url(),

  SOURCE_MODE: z.enum(['mssql', 'api']).default('mssql'),

  SOURCE_DB_TYPE: z.string().default('mssql'),
  SOURCE_DB_HOST: z.string().default('localhost'),
  SOURCE_DB_PORT: z.coerce.number().default(1433),
  SOURCE_DB_NAME: z.string().default('website_db'),
  SOURCE_DB_USER: z.string().default('sa'),
  SOURCE_DB_PASSWORD: z.string().default(''),
  SOURCE_DB_ENCRYPT: envBool(true),
  SOURCE_DB_TRUST_CERT: envBool(true),

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
  PASSWORD_ENC_SECRET: z.string().default('CHANGE_ME_password_reveal_secret_key'),

  SYNC_ENABLED: envBool(true),
  SYNC_INTERVAL_MS: z.coerce.number().default(300_000),
  SYNC_CRON: z.string().default('*/5 * * * *'),
  SYNC_BATCH_SIZE: z.coerce.number().default(500),

  SMS_ENABLED: envBool(false),
  SMS_API_URL: z.string().url().default('https://pgapi.sparc.smartping.io/fe/api/v1/send'),
  SMS_USERNAME: z.string().default(''),
  SMS_PASSWORD: z.string().default(''),
  SMS_SENDER_ID: z.string().default('EXHIGR'),
  SMS_DLT_CONTENT_ID: z.string().default('1777178462705937936'),
  SMS_DLT_ENTITY_ID: z.string().default('1301161355478774851'),
  SMS_TIMEOUT_MS: z.coerce.number().default(15_000),
  SMS_DEFAULT_COUNTRY_CODE: z.string().default('91'),

  MAIL_ENABLED: envBool(false),
  MAIL_HOST: z.string().default(''),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_SECURE: envBool(false),
  MAIL_USER: z.string().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().default('Lead CRM <no-reply@exhibitor.local>'),
  MAIL_TIMEOUT_MS: z.coerce.number().default(15_000),
  APP_BASE_URL: z.string().default('http://localhost:5173'),

  HISTORICAL_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.9),

  FOLLOWUP_REMINDER_ENABLED: envBool(true),
  FOLLOWUP_REMINDER_INTERVAL_MS: z.coerce.number().default(300_000),
  FOLLOWUP_REMINDER_LEAD_MINUTES: z.coerce.number().default(10),
  FOLLOWUP_DAY_REMINDER_TIME: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
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
