import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@config/prisma';
import { AppError } from '@utils/AppError';
import { ok, created } from '@utils/response';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { cache } from '@services/cache.service';

const createSchema = z.object({
  name: z.string().min(2).regex(/^[A-Z0-9_]+$/, 'UPPER_SNAKE_CASE'),
  label: z.string().min(2),
  level: z.number().int().min(1).max(99),
  description: z.string().optional(),
});
const setPermsSchema = z.object({ permissionIds: z.array(z.string().uuid()) });
const idParam = z.object({ id: z.string().uuid() });

const router = Router();
router.use(authenticate);

// ----- permissions catalog (dynamic, from DB) -----
router.get('/permissions/all', requirePermission('role.manage'), asyncHandler(async (_req, res) => {
  const perms = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
  return ok(res, perms);
}));

// ----- roles -----
// Also readable by whoever can create or edit users — they need the list to
// populate the role picker, and can't manage the matrix without role.manage.
router.get('/', requireAnyPermission('role.manage', 'user.create', 'user.update'), asyncHandler(async (_req, res) => {
  const roles = await prisma.role.findMany({
    where: { deletedAt: null },
    orderBy: { level: 'asc' },
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
  });
  return ok(res, roles.map((r) => ({
    id: r.id, name: r.name, label: r.label, level: r.level, isSystem: r.isSystem,
    userCount: r._count.users,
    permissions: r.permissions.map((p) => p.permission.key),
  })));
}));

router.post('/', requirePermission('role.manage'), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const role = await prisma.role.create({ data: req.body });
  return created(res, role);
}));

// Dynamic role→permission matrix update (no hardcoding).
router.patch('/:id/permissions', requirePermission('role.manage'), validate({ params: idParam, body: setPermsSchema }), asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) throw AppError.notFound('Role not found');

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: req.body.permissionIds.map((permissionId: string) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    }),
  ]);

  // Bust all permission caches — affected users must pick up the new matrix.
  await cache.delPattern('perm:*');
  return ok(res, { updated: true });
}));

export default router;
