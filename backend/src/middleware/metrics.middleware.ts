import type { RequestHandler } from 'express';
import { httpRequestDuration } from '@config/metrics';

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    end({ method: req.method, route, status: String(res.statusCode) });
  });
  next();
};
