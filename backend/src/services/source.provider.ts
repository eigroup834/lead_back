import { env } from '@config/env';
import { sourceDb } from '@services/sourceDb.service';
import { sourceApi } from '@services/sourceApi.service';

export type { SourceRow, DownloadSourceRow } from '@services/sourceDb.service';

// Single entry point for the sync job. Switches between a direct SQL Server
// connection (SOURCE_MODE=mssql) and the on-prem HTTP exporter (SOURCE_MODE=api)
// based on config. Both expose the same fetchNewLeads/close contract.
export const source = env.SOURCE_MODE === 'api' ? sourceApi : sourceDb;
