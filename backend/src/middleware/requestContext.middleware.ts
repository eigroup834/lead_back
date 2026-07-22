import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

// Attaches a request id and exposes it as a response header for tracing.
export const requestContext: RequestHandler = (req, res, next) => {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
