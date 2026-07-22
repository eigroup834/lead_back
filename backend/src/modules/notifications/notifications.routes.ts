import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@config/prisma';
import { authenticate } from '@middleware/auth.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { ok } from '@utils/response';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unread = await prisma.notification.count({ where: { userId: req.user!.id, readAt: null } });
  return ok(res, items, { unread });
}));

router.patch('/:id/read', validate({ params: z.object({ id: z.string().uuid() }) }), asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { readAt: new Date(), status: 'READ' },
  });
  return ok(res, { read: true });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null },
    data: { readAt: new Date(), status: 'READ' },
  });
  return ok(res, { read: true });
}));

export default router;
