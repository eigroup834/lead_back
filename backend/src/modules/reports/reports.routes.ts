import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { ok, created } from '@utils/response';
import { exportQueue } from '@queues/index';

const router = Router();
router.use(authenticate);

const exportSchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']).default('csv'),
  filter: z
    .object({
      status: z.array(z.string()).optional(),
      eventName: z.string().optional(),
      country: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })
    .default({}),
});

router.post(
  '/export',
  requirePermission('report.export'),
  validate({ body: exportSchema }),
  asyncHandler(async (req, res) => {
    const job = await exportQueue.add('lead-export', {
      format: req.body.format,
      filter: req.body.filter,
      requestedBy: req.user!.id,
    });
    return created(res, { jobId: job.id, status: 'queued' });
  }),
);

router.get(
  '/:jobId',
  requirePermission('report.export'),
  asyncHandler(async (req, res) => {
    const job = await exportQueue.getJob(req.params.jobId);
    if (!job) return ok(res, { status: 'not_found' });
    const state = await job.getState();
    const result = job.returnvalue as { file?: string; rows?: number } | undefined;
    return ok(res, {
      jobId: job.id,
      status: state,
      progress: job.progress,
      ...(state === 'completed' && result ? { file: result.file, rows: result.rows, downloadUrl: `/files/exports/${result.file}` } : {}),
    });
  }),
);

export default router;
