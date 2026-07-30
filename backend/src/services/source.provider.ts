import { env } from '@config/env';
import { sourceDb } from '@services/sourceDb.service';
import { sourceApi } from '@services/sourceApi.service';

export type { SourceRow, DownloadSourceRow } from '@services/sourceDb.service';

export const source = env.SOURCE_MODE === 'api' ? sourceApi : sourceDb;
