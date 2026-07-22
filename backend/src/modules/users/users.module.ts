import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@config/prisma';
import { AppError } from '@utils/AppError';
import { ok, created } from '@utils/response';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission, requireMaxLevel } from '@middleware/rbac.middleware';
import { validate } from '@middleware/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { authService } from '@modules/auth/auth.service';
import { cache, cacheKeys } from '@services/cache.service';
import { encryptSecret, decryptSecret } from '@utils/crypto';

const createSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).min(1),
});
const updateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});
const listQuery = z.object({
  q: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const idParam = z.object({ id: z.string().uuid() });

const publicSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true, status: true,
  departmentId: true, teamId: true, managerId: true, lastLoginAt: true, createdAt: true,
  roles: { select: { role: { select: { id: true, name: true, label: true, level: true } } } },
} satisfies Prisma.UserSelect;

export const usersService = {
  async list(q: z.infer<typeof listQuery>) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [
      { email: { contains: q.q, mode: 'insensitive' } },
      { firstName: { contains: q.q, mode: 'insensitive' } },
      { lastName: { contains: q.q, mode: 'insensitive' } },
    ];
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, select: publicSelect, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      prisma.user.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  },

  async create(input: z.infer<typeof createSchema>) {
    const passwordHash = await authService.hashPassword(input.password);
    return prisma.user.create({
      data: {
        email: input.email, passwordHash, passwordEnc: encryptSecret(input.password),
        firstName: input.firstName, lastName: input.lastName,
        phone: input.phone, departmentId: input.departmentId, teamId: input.teamId, managerId: input.managerId,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: publicSelect,
    });
  },

  // SUPER_ADMIN only — reveal a user's password (decrypt). Returns null if the
  // user predates the feature (no stored ciphertext).
  async revealPassword(id: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id }, select: { passwordEnc: true } });
    if (!user?.passwordEnc) return null;
    return decryptSecret(user.passwordEnc);
  },

  async update(id: string, input: z.infer<typeof updateSchema>) {
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw AppError.notFound('User not found');
    const { roleIds, ...rest } = input;
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: rest, select: publicSelect });
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
      }
      return u;
    });
    await cache.del(cacheKeys.permissions(id)); // permissions/roles may have changed
    return updated;
  },

  async softDelete(id: string) {
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
    await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await cache.del(cacheKeys.permissions(id));
  },
};

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('user.view'), validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const r = await usersService.list(req.query as never);
  return ok(res, r.items, { total: r.total, page: r.page, limit: r.limit });
}));

router.post('/', requirePermission('user.create'), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const user = await usersService.create(req.body);
  return created(res, user);
}));

router.get('/:id', requirePermission('user.view'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null }, select: publicSelect });
  if (!user) throw AppError.notFound('User not found');
  return ok(res, user);
}));

// SUPER_ADMIN (level 1) only — reveal a user's password.
router.get('/:id/credential', requireMaxLevel(1), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const password = await usersService.revealPassword(req.params.id);
  return ok(res, { password });
}));

router.patch('/:id', requirePermission('user.update'), validate({ params: idParam, body: updateSchema }), asyncHandler(async (req, res) => {
  const user = await usersService.update(req.params.id, req.body);
  return ok(res, user);
}));

router.delete('/:id', requirePermission('user.delete'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await usersService.softDelete(req.params.id);
  return ok(res, { deleted: true });
}));

export default router;
