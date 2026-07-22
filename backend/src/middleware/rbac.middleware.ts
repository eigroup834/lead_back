import type { RequestHandler } from 'express';
import { AppError } from '@utils/AppError';

// Permission-based guard. Dynamic — permissions come from the DB role matrix
// (loaded into req.user.permissions), never hardcoded per route logic.
export function requirePermission(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    const granted = new Set(req.user.permissions);
    const okAll = required.every((p) => granted.has(p));
    if (!okAll) return next(AppError.forbidden(`Missing permission: ${required.join(', ')}`));
    next();
  };
}

// At least one of the listed permissions.
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

// Role-hierarchy guard: caller level must be <= maxLevel (lower number = higher rank).
export function requireMaxLevel(maxLevel: number): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (req.user.level > maxLevel) return next(AppError.forbidden('Insufficient role level'));
    next();
  };
}
