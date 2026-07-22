import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@config/prisma';
import { ok, created } from '@utils/response';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';

const router = Router();
router.use(authenticate);

const deptSchema = z.object({ name: z.string().min(2), description: z.string().optional() });
const teamSchema = z.object({ name: z.string().min(2), departmentId: z.string().uuid(), leaderId: z.string().uuid().optional() });

router.get('/', requirePermission('user.view'), asyncHandler(async (_req, res) => {
  const depts = await prisma.department.findMany({
    where: { deletedAt: null },
    include: { teams: { where: { deletedAt: null } }, _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  });
  return ok(res, depts);
}));

router.post('/', requirePermission('department.manage'), validate({ body: deptSchema }), asyncHandler(async (req, res) =>
  created(res, await prisma.department.create({ data: req.body })),
));

router.post('/teams', requirePermission('department.manage'), validate({ body: teamSchema }), asyncHandler(async (req, res) =>
  created(res, await prisma.team.create({ data: req.body })),
));

export default router;
