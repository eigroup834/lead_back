import jwt, { type SignOptions } from 'jsonwebtoken';
import { addDays } from 'date-fns';
import { env } from '@config/env';
import { prisma } from '@config/prisma';
import { randomToken, sha256 } from '@utils/crypto';
import type { JwtAccessPayload } from '@/types';

const REFRESH_DAYS = 7;

export const tokenService = {
  signAccessToken(payload: Omit<JwtAccessPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_TTL,
    } as SignOptions);
  },

  verifyAccessToken(token: string): JwtAccessPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
  },

  // Issue a refresh token: random secret returned to the client, only its
  // hash is persisted. `familyId` ties rotations together for reuse detection.
  async issueRefreshToken(userId: string, familyId: string, ctx: { ip?: string; userAgent?: string }) {
    const raw = randomToken();
    await prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(raw),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        expiresAt: addDays(new Date(), REFRESH_DAYS),
      },
    });
    return raw;
  },

  // Validate + rotate. If a previously-revoked token is reused, revoke the
  // entire family (token theft mitigation).
  async rotateRefreshToken(rawToken: string, ctx: { ip?: string; userAgent?: string }) {
    const tokenHash = sha256(rawToken);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.expiresAt < new Date()) {
      return { ok: false as const, reason: 'invalid' as const };
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated token => compromise. Burn the family.
      await prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { ok: false as const, reason: 'reuse' as const, userId: existing.userId };
    }

    // Rotate: revoke current, issue replacement in the same family.
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
    const next = await this.issueRefreshToken(existing.userId, existing.familyId, ctx);
    return { ok: true as const, userId: existing.userId, token: next };
  },

  async revokeFamilyByToken(rawToken: string) {
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (existing) {
      await prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  },
};
