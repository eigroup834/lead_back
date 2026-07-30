import { env } from '@config/env';
import type { SourceRow, DownloadSourceRow } from '@services/sourceDb.service';

interface AllLeadsResponse {
  status?: string;
  message?: string;
  exhibitor?: { count: number; last_id: number; data: unknown[] } | null;
  download?: { count: number; last_id: number; data: unknown[] } | null;
}

export const sourceApi = {
  async fetchNewLeads(lastSyncedId: number, batchSize: number): Promise<SourceRow[]> {
    if (!env.SOURCE_API_URL) throw new Error('SOURCE_API_URL is not configured (SOURCE_MODE=api)');

    const url = new URL(env.SOURCE_API_URL);
    url.searchParams.set('source', 'exhi');
    url.searchParams.set('since_exhi', String(lastSyncedId));
    url.searchParams.set('top', String(batchSize));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.SOURCE_API_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'X-Api-Key': env.SOURCE_API_KEY, Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Source API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
      }

      const payload = (await res.json()) as AllLeadsResponse;
      if (payload.status !== 'success') {
        throw new Error(`Source API error: ${payload.message ?? 'unexpected response'}`);
      }

      const rows = payload.exhibitor?.data;
      if (!Array.isArray(rows)) throw new Error('Source API returned no exhibitor array');

      return rows.map(normalizeRow);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Source API timed out after ${env.SOURCE_API_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  async fetchNewDownloadLeads(lastSyncedId: number, batchSize: number): Promise<DownloadSourceRow[]> {
    if (!env.SOURCE_API_URL) throw new Error('SOURCE_API_URL is not configured (SOURCE_MODE=api)');

    const url = new URL(env.SOURCE_API_URL);
    url.searchParams.set('source', 'download');
    url.searchParams.set('since_download', String(lastSyncedId));
    url.searchParams.set('top', String(batchSize));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.SOURCE_API_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { 'X-Api-Key': env.SOURCE_API_KEY, Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Source API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
      }

      const payload = (await res.json()) as AllLeadsResponse;
      if (payload.status !== 'success') {
        throw new Error(`Source API error: ${payload.message ?? 'unexpected response'}`);
      }

      const rows = payload.download?.data;
      if (!Array.isArray(rows)) throw new Error('Source API returned no download array');

      return rows.map(normalizeDownloadRow);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Source API timed out after ${env.SOURCE_API_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  async close(): Promise<void> {
  },
};

function normalizeRow(raw: unknown): SourceRow {
  const r = raw as Record<string, unknown>;
  return {
    ...(r as object),
    id: Number(r.id),
    create_date: r.create_date ? new Date(r.create_date as string) : null,
    status: r.status == null ? null : String(r.status),
  } as SourceRow;
}

function normalizeDownloadRow(raw: unknown): DownloadSourceRow {
  const r = raw as Record<string, unknown>;
  const toDate = (v: unknown) => (v ? new Date(v as string) : null);
  return {
    ...(r as object),
    id: Number(r.id),
    date: toDate(r.date),
    create_date: toDate(r.create_date),
  } as DownloadSourceRow;
}
