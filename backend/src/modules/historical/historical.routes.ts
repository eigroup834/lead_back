import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { historicalController } from './historical.controller';
import {
  createHistoricalLeadSchema,
  idParam,
  listHistoricalLeadsQuery,
  restoreHistoricalSchema,
  updateHistoricalLeadSchema,
} from './historical.validator';

const router = Router();
router.use(authenticate);

router.get('/leads', requirePermission('historical.view'), validate({ query: listHistoricalLeadsQuery }), asyncHandler(historicalController.listLeads));
router.post('/leads', requirePermission('lead.create'), validate({ body: createHistoricalLeadSchema }), asyncHandler(historicalController.createLead));
router.get('/leads/years', requirePermission('historical.view'), asyncHandler(historicalController.years));
router.get('/leads/industries', requirePermission('historical.view'), asyncHandler(historicalController.industries));
router.post('/leads/restore', requirePermission('historical.view'), validate({ body: restoreHistoricalSchema }), asyncHandler(historicalController.restore));
router.get('/leads/:id/history', requirePermission('historical.view'), validate({ params: idParam }), asyncHandler(historicalController.leadHistory));
router.patch('/leads/:id', requirePermission('historical.view'), validate({ params: idParam, body: updateHistoricalLeadSchema }), asyncHandler(historicalController.updateLead));
router.delete('/leads/:id', requirePermission('historical.view'), validate({ params: idParam }), asyncHandler(historicalController.removeLead));
router.post('/leads/:id/restore', requirePermission('historical.view'), validate({ params: idParam }), asyncHandler(historicalController.restoreRemovedLead));









export default router;
