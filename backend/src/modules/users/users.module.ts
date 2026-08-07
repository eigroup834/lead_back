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
import type { AuthUser } from '@/types';

const targetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  targetSqm: z.coerce.number().min(0).max(1_000_000),
});
const targetsSchema = z.object({ targets: z.array(targetSchema).max(20) });

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
  targets: z.array(targetSchema).max(20).optional(),
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
  targets: z.array(targetSchema).max(20).optional(),
});
const USER_SORTABLE = ['firstName', 'email', 'phone', 'status', 'lastLoginAt', 'createdAt'] as const;
const listQuery = z.object({
  q: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(USER_SORTABLE).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
const idParam = z.object({ id: z.string().uuid() });

const publicSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true, status: true,
  departmentId: true, teamId: true, managerId: true, lastLoginAt: true, createdAt: true,
  roles: { select: { role: { select: { id: true, name: true, label: true, level: true } } } },
  salesTargets: { select: { year: true, targetSqm: true }, orderBy: { year: 'desc' } },
} satisfies Prisma.UserSelect;

function dedupeTargets(targets: z.infer<typeof targetSchema>[]) {
  const byYear = new Map<number, number>();
  for (const t of targets) byYear.set(t.year, t.targetSqm);
  return [...byYear.entries()].map(([year, targetSqm]) => ({ year, targetSqm }));
}

export const usersService = {
  async list(q: z.infer<typeof listQuery>) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [
      { email: { contains: q.q, mode: 'insensitive' } },
      { firstName: { contains: q.q, mode: 'insensitive' } },
      { lastName: { contains: q.q, mode: 'insensitive' } },
    ];
    const nullable = q.sortBy === 'phone' || q.sortBy === 'lastLoginAt';
    const orderBy = [
      (nullable ? { [q.sortBy]: { sort: q.sortDir, nulls: 'last' } } : { [q.sortBy]: q.sortDir }) as Prisma.UserOrderByWithRelationInput,
      { id: q.sortDir },
    ];
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, select: publicSelect, orderBy, skip: (q.page - 1) * q.limit, take: q.limit }),
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
        salesTargets: input.targets?.length
          ? { create: dedupeTargets(input.targets) }
          : undefined,
      },
      select: publicSelect,
    });
  },

  async setTargets(userId: string, targets: z.infer<typeof targetSchema>[]) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
    if (!user) throw AppError.notFound('User not found');
    const rows = dedupeTargets(targets);
    await prisma.$transaction([
      prisma.userSalesTarget.deleteMany({ where: { userId } }),
      ...(rows.length ? [prisma.userSalesTarget.createMany({ data: rows.map((r) => ({ ...r, userId })) })] : []),
    ]);
    return prisma.userSalesTarget.findMany({
      where: { userId }, select: { year: true, targetSqm: true }, orderBy: { year: 'desc' },
    });
  },

  async revealPassword(id: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id }, select: { passwordEnc: true } });
    if (!user?.passwordEnc) return null;
    return decryptSecret(user.passwordEnc);
  },

  async update(actor: AuthUser, id: string, input: z.infer<typeof updateSchema>) {
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw AppError.notFound('User not found');

    if (input.status !== undefined && input.status !== user.status) {
      if (actor.level !== 1) throw AppError.forbidden('Only a Super Admin can change a user\'s status');
      if (id === actor.id) throw AppError.forbidden('You cannot change your own status');
    }

    if (input.roleIds?.length) {
      if (id === actor.id) throw AppError.forbidden('You cannot change your own role');
      const targets = await prisma.role.findMany({
        where: { id: { in: input.roleIds }, deletedAt: null },
        select: { id: true, level: true, label: true },
      });
      if (targets.length !== input.roleIds.length) throw AppError.badRequest('Unknown role');
      const tooHigh = targets.find((r) => r.level < actor.level);
      if (tooHigh) throw AppError.forbidden(`You cannot assign the ${tooHigh.label} role`);
    }

    const { roleIds, targets, ...rest } = input;
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: rest, select: publicSelect });
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
      }
      if (targets) {
        await tx.userSalesTarget.deleteMany({ where: { userId: id } });
        const rows = dedupeTargets(targets);
        if (rows.length) await tx.userSalesTarget.createMany({ data: rows.map((r) => ({ ...r, userId: id })) });
      }
      return tx.user.findUniqueOrThrow({ where: { id }, select: publicSelect });
    });
    await cache.del(cacheKeys.permissions(id));
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

router.get('/:id/credential', requireMaxLevel(1), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const password = await usersService.revealPassword(req.params.id);
  return ok(res, { password });
}));

router.patch('/:id', requirePermission('user.update'), validate({ params: idParam, body: updateSchema }), asyncHandler(async (req, res) => {
  const user = await usersService.update(req.user!, req.params.id, req.body);
  return ok(res, user);
}));

router.put('/:id/targets', requirePermission('user.update'), validate({ params: idParam, body: targetsSchema }), asyncHandler(async (req, res) => {
  return ok(res, await usersService.setTargets(req.params.id, req.body.targets));
}));

router.delete('/:id', requirePermission('user.delete'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await usersService.softDelete(req.params.id);
  return ok(res, { deleted: true });
}));

export default router;
