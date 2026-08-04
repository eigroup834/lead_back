import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { cache } from '@services/cache.service';
import { source, type SourceRow, type DownloadSourceRow } from '@services/source.provider';
import { downloadCreateDate } from '@services/sourceDb.service';

function mapRow(r: SourceRow) {
  return {
    sourceId: Number(r.id),
    title: r.title,
    company: r.company,
    firstName: r.fname,
    lastName: r.lname,
    designation: r.designation,
    shellSpace: r.shell_space,
    rawSpace: r.raw_space,
    address: r.address,
    city: r.city,
    state: r.state,
    zipCode: r.zip_code,
    country: r.country,
    phone: r.phone,
    email: r.email,
    mobile: r.mobile,
    website: r.website,
    learnAbout: r.learn_about,
    remarks: r.remarks,
    industry: r.remarks,
    ipAddress: r.ip_address,
    createDate: r.create_date,
    eventName: r.event_name,
    sourceStatus: r.status == null ? null : String(r.status),
    source: 'WEBSITE' as const,
    sourceChannel: 'SPACE_BOOKING' as const,
  };
}

function splitName(name: string | null): { firstName: string | null; lastName: string | null } {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: null };
  return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1).trim() || null };
}

type ExternalCategory = 'VISITOR' | 'SPEAKER' | 'DELEGATE' | 'OTHER';

function classifyDownload(r: DownloadSourceRow): 'EXHIBITOR' | ExternalCategory {
  switch ((r.business_interest ?? '').trim().toLowerCase()) {
    case 'exhibitor':
      return 'EXHIBITOR';
    case 'visitor':
      return 'VISITOR';
    case 'speaker':
      return 'SPEAKER';
    case 'delegate':
      return 'DELEGATE';
    default:
      return 'OTHER';
  }
}

function mapDownloadToLead(r: DownloadSourceRow) {
  const { firstName, lastName } = splitName(r.name);
  const remarks = r.business_interest ? `Interest: ${r.business_interest}` : null;
  return {
    sourceId: Number(r.id),
    firstName,
    lastName,
    company: r.company,
    designation: r.designation,
    email: r.email,
    mobile: r.mobile,
    eventName: r.event_name,
    ipAddress: r.ip_address,
    createDate: downloadCreateDate(r),
    industry: r.industry ? String(r.industry) : null,
    remarks,
    source: 'WEBSITE' as const,
    sourceChannel: 'POST_SHOW_DOWNLOAD' as const,
    leadType: 'EXHIBITION' as const,
  };
}

function mapDownloadToExternal(r: DownloadSourceRow, category: ExternalCategory) {
  const { firstName, lastName } = splitName(r.name);
  return {
    sourceId: Number(r.id),
    category,
    name: r.name,
    firstName,
    lastName,
    email: r.email,
    mobile: r.mobile,
    designation: r.designation,
    company: r.company,
    industry: r.industry,
    businessInterest: r.business_interest,
    eventName: r.event_name,
    ipAddress: r.ip_address,
    createDate: downloadCreateDate(r),
    raw: JSON.parse(JSON.stringify(r)) as object,
    source: 'WEBSITE' as const,
    sourceChannel: 'POST_SHOW_DOWNLOAD' as const,
  };
}

async function dropExistingByContact<T extends { email?: string | null; mobile?: string | null }>(rows: T[]): Promise<T[]> {
  const key = (e: string, m: string) => `${e.trim().toLowerCase()}|||${m.trim()}`;
  const withBoth = rows.filter((r) => r.email && r.mobile);
  if (withBoth.length === 0) return rows;

  const emails = [...new Set(withBoth.map((r) => r.email as string))];
  const existing = await prisma.lead.findMany({
    where: { deletedAt: null, email: { in: emails } },
    select: { email: true, mobile: true },
  });
  const seen = new Set(
    existing.filter((e) => e.email && e.mobile).map((e) => key(e.email!, e.mobile!)),
  );

  const out: T[] = [];
  for (const r of rows) {
    if (r.email && r.mobile) {
      const k = key(r.email, r.mobile);
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.push(r);
  }
  return out;
}

export const syncService = {
  async runOnce(): Promise<{ fetched: number; inserted: number; skipped: number }> {
    const startedAt = Date.now();
    const state = await prisma.syncState.upsert({
      where: { source: 'exhi_reg' },
      update: {},
      create: { source: 'exhi_reg', lastSyncedId: 0 },
    });

    const log = await prisma.syncLog.create({
      data: { source: 'exhi_reg', status: 'RUNNING', fromId: state.lastSyncedId },
    });

    try {
      const rows = await source.fetchNewLeads(state.lastSyncedId, env.SYNC_BATCH_SIZE);
      if (rows.length === 0) {
        await prisma.syncLog.update({
          where: { id: log.id },
          data: { status: 'SUCCESS', fetchedCount: 0, finishedAt: new Date(), durationMs: Date.now() - startedAt },
        });
        return { fetched: 0, inserted: 0, skipped: 0 };
      }

      const toInsert = await dropExistingByContact(rows.map(mapRow));
      const created = await prisma.lead.createMany({
        data: toInsert,
        skipDuplicates: true,
      });

      const maxId = Number(rows[rows.length - 1].id);
      const lastDate = rows[rows.length - 1].create_date ?? undefined;

      await prisma.$transaction([
        prisma.syncState.update({
          where: { source: 'exhi_reg' },
          data: { lastSyncedId: maxId, lastSyncedDate: lastDate },
        }),
        prisma.syncLog.update({
          where: { id: log.id },
          data: {
            status: 'SUCCESS',
            fetchedCount: rows.length,
            insertedCount: created.count,
            skippedCount: rows.length - created.count,
            toId: maxId,
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
          },
        }),
      ]);

      await cache.delPattern('dash:*');
      logger.info(`Sync: fetched ${rows.length}, inserted ${created.count}, cursor -> ${maxId}`);
      return { fetched: rows.length, inserted: created.count, skipped: rows.length - created.count };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: message, finishedAt: new Date(), durationMs: Date.now() - startedAt },
      });
      logger.error('Sync failed', { error: message });
      throw err;
    }
  },

  async runUntilCaughtUp(maxBatches = 20): Promise<{ inserted: number; batches: number }> {
    let inserted = 0;
    let batches = 0;
    for (let i = 0; i < maxBatches; i++) {
      const res = await this.runOnce();
      inserted += res.inserted;
      batches++;
      if (res.fetched < env.SYNC_BATCH_SIZE) break;
    }
    return { inserted, batches };
  },

  async runDownloadOnce(): Promise<{ fetched: number; insertedLeads: number; insertedExternal: number; skipped: number }> {
    const startedAt = Date.now();
    const state = await prisma.syncState.upsert({
      where: { source: 'download_reg' },
      update: {},
      create: { source: 'download_reg', lastSyncedId: 0 },
    });

    const log = await prisma.syncLog.create({
      data: { source: 'download_reg', status: 'RUNNING', fromId: state.lastSyncedId },
    });

    try {
      const rows = await source.fetchNewDownloadLeads(state.lastSyncedId, env.SYNC_BATCH_SIZE);
      if (rows.length === 0) {
        await prisma.syncLog.update({
          where: { id: log.id },
          data: { status: 'SUCCESS', fetchedCount: 0, finishedAt: new Date(), durationMs: Date.now() - startedAt },
        });
        return { fetched: 0, insertedLeads: 0, insertedExternal: 0, skipped: 0 };
      }

      const leadRows = [];
      const externalRows = [];
      for (const r of rows) {
        const kind = classifyDownload(r);
        if (kind === 'EXHIBITOR') leadRows.push(mapDownloadToLead(r));
        else externalRows.push(mapDownloadToExternal(r, kind));
      }

      const leadToInsert = await dropExistingByContact(leadRows);
      const [leadRes, externalRes] = await prisma.$transaction([
        prisma.lead.createMany({ data: leadToInsert, skipDuplicates: true }),
        prisma.externalLead.createMany({ data: externalRows, skipDuplicates: true }),
      ]);

      const maxId = Number(rows[rows.length - 1].id);
      const lastDate = downloadCreateDate(rows[rows.length - 1]) ?? undefined;
      const inserted = leadRes.count + externalRes.count;

      await prisma.$transaction([
        prisma.syncState.update({
          where: { source: 'download_reg' },
          data: { lastSyncedId: maxId, lastSyncedDate: lastDate },
        }),
        prisma.syncLog.update({
          where: { id: log.id },
          data: {
            status: 'SUCCESS',
            fetchedCount: rows.length,
            insertedCount: inserted,
            skippedCount: rows.length - inserted,
            toId: maxId,
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
          },
        }),
      ]);

      await cache.delPattern('dash:*');
      logger.info(
        `Sync[download]: fetched ${rows.length}, leads +${leadRes.count}, external +${externalRes.count}, cursor -> ${maxId}`,
      );
      return { fetched: rows.length, insertedLeads: leadRes.count, insertedExternal: externalRes.count, skipped: rows.length - inserted };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: message, finishedAt: new Date(), durationMs: Date.now() - startedAt },
      });
      logger.error('Sync[download] failed', { error: message });
      throw err;
    }
  },

  async runDownloadUntilCaughtUp(maxBatches = 20): Promise<{ insertedLeads: number; insertedExternal: number; batches: number }> {
    let insertedLeads = 0;
    let insertedExternal = 0;
    let batches = 0;
    for (let i = 0; i < maxBatches; i++) {
      const res = await this.runDownloadOnce();
      insertedLeads += res.insertedLeads;
      insertedExternal += res.insertedExternal;
      batches++;
      if (res.fetched < env.SYNC_BATCH_SIZE) break;
    }
    return { insertedLeads, insertedExternal, batches };
  },

  listLogs(limit = 50) {
    return prisma.syncLog.findMany({ orderBy: { startedAt: 'desc' }, take: limit });
  },
};
