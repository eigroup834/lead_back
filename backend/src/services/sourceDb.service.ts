import sql from 'mssql';
import { env } from '@config/env';
import { logger } from '@config/logger';

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
  date: Date | null;
  create_date: Date | null;
  [key: string]: unknown;
}

export const downloadCreateDate = (r: DownloadSourceRow): Date | null =>
  r.date ?? r.create_date ?? null;

export const sourceDb = {
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
