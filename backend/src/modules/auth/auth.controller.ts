import type { Request, Response } from 'express';
import { env, isProd } from '@config/env';
import { ok } from '@utils/response';
import { authService } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: env.API_PREFIX + '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const authController = {
  async login(req: Request, res: Response) {
    const ctx = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const { accessToken, refreshToken, user } = await authService.login(req.body, ctx);
    setRefreshCookie(res, refreshToken);
    return ok(res, { accessToken, user });
  },

  async refresh(req: Request, res: Response) {
    const ctx = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const raw = req.cookies?.[REFRESH_COOKIE];
    const { accessToken, refreshToken, user } = await authService.refresh(raw, ctx);
    setRefreshCookie(res, refreshToken);
    return ok(res, { accessToken, user });
  },

  async logout(req: Request, res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await authService.logout(raw, req.user?.id);
    res.clearCookie(REFRESH_COOKIE, { path: env.API_PREFIX + '/auth' });
    return ok(res, { loggedOut: true });
  },

  async me(req: Request, res: Response) {
    return ok(res, { user: req.user });
  },
};
