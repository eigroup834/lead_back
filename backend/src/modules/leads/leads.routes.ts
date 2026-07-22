import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { leadsController } from './leads.controller';
import { assignmentController } from '@modules/assignments/assignment.controller';
import { assignBulkSchema, assignSingleSchema, autoAssignSchema } from '@modules/assignments/assignment.validator';
import { archiveHistoricalSchema, changeStatusSchema, convertExternalSchema, createLeadSchema, idParam, listLeadsQuery, updateLeadSchema } from './leads.validator';

const router = Router();
router.use(authenticate);

// Assignment endpoints (mounted under /leads to match the API surface).
router.post('/assign', requirePermission('lead.assign'), validate({ body: assignSingleSchema }), asyncHandler(assignmentController.single));
router.post('/assign/bulk', requirePermission('lead.assign'), validate({ body: assignBulkSchema }), asyncHandler(assignmentController.bulk));
router.post('/assign/auto', requirePermission('lead.assign'), validate({ body: autoAssignSchema }), asyncHandler(assignmentController.auto));

// Archive converted leads into the year-tagged Historical store.
router.post('/archive-historical', requirePermission('lead.edit'), validate({ body: archiveHistoricalSchema }), asyncHandler(leadsController.archiveHistorical));

// Lead CRUD / detail
router.get('/', requirePermission('lead.view'), validate({ query: listLeadsQuery }), asyncHandler(leadsController.list));
router.post('/', requirePermission('lead.create'), validate({ body: createLeadSchema }), asyncHandler(leadsController.create));
router.get('/export', requirePermission('lead.export'), validate({ query: listLeadsQuery }), asyncHandler(leadsController.exportXlsx));
router.get('/:id', requirePermission('lead.view'), validate({ params: idParam }), asyncHandler(leadsController.get));
router.patch('/:id', requirePermission('lead.edit'), validate({ params: idParam, body: updateLeadSchema }), asyncHandler(leadsController.update));
router.post('/:id/status', requirePermission('lead.edit'), validate({ params: idParam, body: changeStatusSchema }), asyncHandler(leadsController.changeStatus));
router.post('/:id/convert-external', requirePermission('lead.edit'), validate({ params: idParam, body: convertExternalSchema }), asyncHandler(leadsController.convertExternal));
router.delete('/:id', requirePermission('lead.delete'), validate({ params: idParam }), asyncHandler(leadsController.remove));
router.post('/:id/notes', requirePermission('lead.note'), validate({ params: idParam, body: z.object({ body: z.string().min(1).max(2000) }) }), asyncHandler(leadsController.addNote));

export default router;
