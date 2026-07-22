import type { RequestHandler } from 'express';
import { tokenService } from '@services/token.service';
import { cache, cacheKeys } from '@services/cache.service';
import { prisma } from '@config/prisma';
import { AppError } from '@utils/AppError';
import type { AuthUser } from '@/types';

const PERM_TTL = 300; // seconds

// Loads the user's effective roles/permissions (cached in Redis).
export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  return cache.remember<AuthUser | null>(cacheKeys.permissions(userId), PERM_TTL, async () => {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) return null;

    const roles = user.roles.map((r) => r.role.name);
    const level = user.roles.length ? Math.min(...user.roles.map((r) => r.role.level)) : 99;
    const permissions = Array.from(
      new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      level,
      roles,
      permissions,
      departmentId: user.departmentId,
      teamId: user.teamId,
    };
  });
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing bearer token');

    const payload = tokenService.verifyAccessToken(header.slice(7));
    const authUser = await loadAuthUser(payload.sub);
    if (!authUser) throw AppError.unauthorized('Account inactive or not found');

    req.user = authUser;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(AppError.unauthorized('Invalid or expired token'));
  }
};
