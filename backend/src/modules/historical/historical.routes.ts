import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { historicalController } from './historical.controller';
import {
  convertBulkSchema,
  convertRowSchema,
  createUploadSchema,
  createHistoricalLeadSchema,
  idParam,
  listHistoricalLeadsQuery,
  listRowsQuery,
  restoreHistoricalSchema,
  updateHistoricalLeadSchema,
  updateUploadSchema,
  uploadRowParams,
} from './historical.validator';

const router = Router();
router.use(authenticate);

// Historical leads: year-tagged archive of converted leads (moved from Lead
// Management). Declared before the legacy /uploads routes; no path overlap.
router.get('/leads', requirePermission('historical.view'), validate({ query: listHistoricalLeadsQuery }), asyncHandler(historicalController.listLeads));
router.post('/leads', requirePermission('lead.create'), validate({ body: createHistoricalLeadSchema }), asyncHandler(historicalController.createLead));
router.get('/leads/years', requirePermission('historical.view'), asyncHandler(historicalController.years));
router.post('/leads/restore', requirePermission('lead.create'), validate({ body: restoreHistoricalSchema }), asyncHandler(historicalController.restore));
router.patch('/leads/:id', requirePermission('lead.edit'), validate({ params: idParam, body: updateHistoricalLeadSchema }), asyncHandler(historicalController.updateLead));
router.delete('/leads/:id', requirePermission('lead.edit'), validate({ params: idParam }), asyncHandler(historicalController.removeLead));

// All endpoints are owner-scoped inside the service (a rep only ever sees/edits
// their own uploads), so viewing needs historical.view and mutations need manage.
router.get('/uploads', requirePermission('historical.view'), asyncHandler(historicalController.list));
router.post('/uploads', requirePermission('historical.manage'), validate({ body: createUploadSchema }), asyncHandler(historicalController.create));
router.get('/uploads/:id', requirePermission('historical.view'), validate({ params: idParam }), asyncHandler(historicalController.get));
router.get('/uploads/:id/rows', requirePermission('historical.view'), validate({ params: idParam, query: listRowsQuery }), asyncHandler(historicalController.rows));
router.patch('/uploads/:id', requirePermission('historical.manage'), validate({ params: idParam, body: updateUploadSchema }), asyncHandler(historicalController.update));
router.delete('/uploads/:id', requirePermission('historical.manage'), validate({ params: idParam }), asyncHandler(historicalController.remove));
router.post('/uploads/:id/convert', requirePermission('historical.manage'), validate({ params: idParam, body: convertBulkSchema }), asyncHandler(historicalController.convertBulk));
router.post('/uploads/:id/rows/:rowId/convert', requirePermission('historical.manage'), validate({ params: uploadRowParams, body: convertRowSchema }), asyncHandler(historicalController.convertRow));

export default router;
