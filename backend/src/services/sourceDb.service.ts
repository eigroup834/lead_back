import sql from 'mssql';
import { env } from '@config/env';
import { logger } from '@config/logger';

// Lazy, pooled, read-only connection to the source website DB (SQL Server).
let pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool({
    server: env.SOURCE_DB_HOST,
    port: env.SOURCE_DB_PORT,
    database: env.SOURCE_DB_NAME,
    user: env.SOURCE_DB_USER,
    password: env.SOURCE_DB_PASSWORD,
    options: { encrypt: env.SOURCE_DB_ENCRYPT, trustServerCertificate: env.SOURCE_DB_TRUST_CERT },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
  }).connect();
  logger.info('✅ Source DB (SQL Server) connected');
  return pool;
}

export interface SourceRow {
  id: number;
  title: string | null;
  company: string | null;
  fname: string | null;
  lname: string | null;
  designation: string | null;
  shell_space: string | null;
  raw_space: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  mobile: string | null;
  website: string | null;
  learn_about: string | null;
  remarks: string | null;
  ip_address: string | null;
  create_date: Date | null;
  event_name: string | null;
  status: string | null;
}

// Post-show download registrations (dbo.download_reg). Independent id sequence
// and a different shape from exhi_reg. Loosely typed because we SELECT * to keep
// any extra source columns for the ExternalLead raw payload.
export interface DownloadSourceRow {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  designation: string | null;
  company: string | null;
  industry: string | null;
  business_interest: string | null;
  event_name: string | null;
  ip_address: string | null;
  // download_reg carries its timestamp in `date`; its `create_date` column
  // exists but is always null. Read `date` first — see downloadCreateDate().
  date: Date | null;
  create_date: Date | null;
  [key: string]: unknown;
}

/** The registration timestamp of a post-show row, whichever column holds it. */
export const downloadCreateDate = (r: DownloadSourceRow): Date | null =>
  r.date ?? r.create_date ?? null;

export const sourceDb = {
  // Incremental fetch: only rows with id greater than the cursor, capped to batchSize.
  async fetchNewLeads(lastSyncedId: number, batchSize: number): Promise<SourceRow[]> {
    const p = await getPool();
    const result = await p
      .request()
      .input('lastId', sql.Int, lastSyncedId)
      .input('batch', sql.Int, batchSize)
      .query<SourceRow>(`
        SELECT TOP (@batch)
          id, title, company, fname, lname, designation, shell_space, raw_space,
          address, city, state, zip_code, country, phone, email, mobile, website,
          learn_about, remarks, ip_address, create_date, event_name, status
        FROM dbo.exhi_reg
        WHERE id > @lastId
        ORDER BY id ASC
      `);
    return result.recordset;
  },

  // Incremental fetch of post-show download registrations (own cursor).
  async fetchNewDownloadLeads(lastSyncedId: number, batchSize: number): Promise<DownloadSourceRow[]> {
    const p = await getPool();
    const result = await p
      .request()
      .input('lastId', sql.Int, lastSyncedId)
      .input('batch', sql.Int, batchSize)
      .query<DownloadSourceRow>(`
        SELECT TOP (@batch) *
        FROM dbo.download_reg
        WHERE id > @lastId
        ORDER BY id ASC
      `);
    return result.recordset;
  },

  async close(): Promise<void> {
    if (pool) await pool.close();
    pool = null;
  },
};
