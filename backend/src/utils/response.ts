import type { Response } from 'express';

export interface Meta {
  [key: string]: unknown;
}

export function ok<T>(res: Response, data: T, meta?: Meta, status = 200): Response {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T, meta?: Meta): Response {
  return ok(res, data, meta, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
