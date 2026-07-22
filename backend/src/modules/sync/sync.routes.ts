import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { ok, created } from '@utils/response';
import { runSyncNow, isSyncRunning } from '@jobs/sync.scheduler';
import { syncService } from './sync.service';

const router = Router();
router.use(authenticate);

router.get('/logs', requirePermission('lead.sync'), asyncHandler(async (_req, res) => ok(res, await syncService.listLogs())));

// Manually trigger an out-of-band sync (in addition to the interval scheduler).
// Fire-and-forget: kick the run in the background and respond immediately, so the
// HTTP request doesn't block on a large import.
router.post('/run', requirePermission('lead.sync'), asyncHandler(async (_req, res) => {
  const alreadyRunning = isSyncRunning();
  void runSyncNow('manual');
  return created(res, { status: alreadyRunning ? 'already-running' : 'started' });
}));

export default router;
