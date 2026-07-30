import type { RequestHandler } from 'express';
import { AppError } from '@utils/AppError';

export function requirePermission(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    const granted = new Set(req.user.permissions);
    const okAll = required.every((p) => granted.has(p));
    if (!okAll) return next(AppError.forbidden(`Missing permission: ${required.join(', ')}`));
    next();
  };
}

export function requireAnyPermission(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    const granted = new Set(req.user.permissions);
    if (!required.some((p) => granted.has(p))) {
      return next(AppError.forbidden(`Missing permission: one of ${required.join(', ')}`));
    }
    next();
  };
}

export function requireMaxLevel(maxLevel: number): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.level > maxLevel) return next(AppError.forbidden('Insufficient role level'));
    next();
  };
}
