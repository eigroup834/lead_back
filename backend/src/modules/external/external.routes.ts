import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { externalController } from './external.controller';
import { bulkConvertSchema, idParam, listExternalQuery } from './external.validator';

const router = Router();
router.use(authenticate);

// Non-exhibitor (Visitor/Delegate/Speaker/Other) leads staged for the local CRM.
router.get('/', requirePermission('lead.view'), validate({ query: listExternalQuery }), asyncHandler(externalController.list));
router.get('/counts', requirePermission('lead.view'), asyncHandler(externalController.counts));
router.post('/convert-exhibitor/bulk', requirePermission('lead.edit'), validate({ body: bulkConvertSchema }), asyncHandler(externalController.bulkConvertToExhibitor));
router.post('/:id/convert-exhibitor', requirePermission('lead.edit'), validate({ params: idParam }), asyncHandler(externalController.convertToExhibitor));

export default router;
