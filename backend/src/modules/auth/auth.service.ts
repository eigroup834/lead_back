import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { AppError } from '@utils/AppError';
import { tokenService } from '@services/token.service';
import { cache, cacheKeys } from '@services/cache.service';
import { loadAuthUser } from '@middleware/auth.middleware';
import type { LoginInput } from './auth.validator';

interface Ctx {
  ip?: string;
  userAgent?: string;
}

export const authService = {
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
  },

  async login(input: LoginInput, ctx: Ctx) {
    const user = await prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });
    // Constant-ish behavior: always run a compare to reduce user-enumeration timing.
    const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !valid) throw AppError.unauthorized('Invalid credentials');
    if (user.status !== 'ACTIVE') throw AppError.forbidden('Account is not active');

    const authUser = await loadAuthUser(user.id);
    if (!authUser) throw AppError.unauthorized('Account unavailable');

    const familyId = randomUUID();
    const refreshToken = await tokenService.issueRefreshToken(user.id, familyId, ctx);
    const accessToken = tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      level: authUser.level,
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return { accessToken, refreshToken, user: authUser };
  },

  async refresh(rawToken: string | undefined, ctx: Ctx) {
    if (!rawToken) throw AppError.unauthorized('Missing refresh token');
    const result = await tokenService.rotateRefreshToken(rawToken, ctx);
    if (!result.ok) {
      if (result.reason === 'reuse') {
        // Bust permission cache to force re-auth everywhere.
        await cache.del(cacheKeys.permissions(result.userId));
      }
      throw AppError.unauthorized('Invalid refresh token');
    }
    const authUser = await loadAuthUser(result.userId);
    if (!authUser) throw AppError.unauthorized('Account unavailable');

    const accessToken = tokenService.signAccessToken({
      sub: result.userId,
      email: authUser.email,
      level: authUser.level,
    });
    return { accessToken, refreshToken: result.token, user: authUser };
  },

  async logout(rawToken: string | undefined, userId?: string) {
    if (rawToken) await tokenService.revokeFamilyByToken(rawToken);
    if (userId) await cache.del(cacheKeys.permissions(userId));
  },
};
