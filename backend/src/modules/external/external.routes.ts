import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission, requireMaxLevel } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { externalController } from './external.controller';
import { assignExternalSchema, bulkConvertSchema, idParam, listExternalQuery, reclassifySchema, syncExternalSchema } from './external.validator';

const router = Router();
router.use(authenticate);

// Non-exhibitor (Visitor/Delegate/Speaker/Other) leads staged for the local CRM.
router.get('/', requirePermission('lead.view'), validate({ query: listExternalQuery }), asyncHandler(externalController.list));
router.get('/counts', requirePermission('lead.view'), asyncHandler(externalController.counts));
router.post('/convert-exhibitor/bulk', requirePermission('lead.edit'), validate({ body: bulkConvertSchema }), asyncHandler(externalController.bulkConvertToExhibitor));
// Assign brochure leads to a user (managers/admin); sync = any user on their own leads.
router.post('/assign', requireMaxLevel(1), validate({ body: assignExternalSchema }), asyncHandler(externalController.assign));
router.post('/sync', requirePermission('lead.edit'), validate({ body: syncExternalSchema }), asyncHandler(externalController.sync));
router.patch('/:id/reclassify', requirePermission('lead.edit'), validate({ params: idParam, body: reclassifySchema }), asyncHandler(externalController.reclassify));
router.post('/:id/convert-exhibitor', requirePermission('lead.edit'), validate({ params: idParam }), asyncHandler(externalController.convertToExhibitor));

export default router;
