import { syncService } from '@modules/sync/sync.service';
import { env } from '@config/env';
import { logger } from '@config/logger';

let running = false;
let timer: NodeJS.Timeout | null = null;

export async function runSyncNow(trigger: 'startup' | 'interval' | 'manual'): Promise<{ started: boolean; reason?: string }> {
  if (running) {
    logger.info(`[sync] ${trigger} trigger skipped — a sync is already running`);
    return { started: false, reason: 'already-running' };
  }
  running = true;
  const startedAt = Date.now();
  try {
    const exhi = await syncService.runUntilCaughtUp();
    const download = await syncService.runDownloadUntilCaughtUp();
    logger.info(
      `[sync] ${trigger} done in ${Date.now() - startedAt}ms — ` +
        `exhi +${exhi.inserted} (${exhi.batches}b); ` +
        `download leads +${download.insertedLeads}, external +${download.insertedExternal} (${download.batches}b)`,
    );
    return { started: true };
  } catch (err) {
    logger.error(`[sync] ${trigger} run failed`, { error: err instanceof Error ? err.message : String(err) });
    return { started: true, reason: 'error' };
  } finally {
    running = false;
  }
}

export function isSyncRunning(): boolean {
  return running;
}

export function startSyncScheduler(): void {
  if (!env.SYNC_ENABLED) {
    logger.info('[sync] scheduler disabled (SYNC_ENABLED=false)');
    return;
  }
  if (timer) return;

  setTimeout(() => void runSyncNow('startup'), 5_000);
  timer = setInterval(() => void runSyncNow('interval'), env.SYNC_INTERVAL_MS);
  timer.unref?.();

  logger.info(`⏱️  Lead sync scheduler started — every ${Math.round(env.SYNC_INTERVAL_MS / 1000)}s (in-process, no Redis)`);
}

export function stopSyncScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
