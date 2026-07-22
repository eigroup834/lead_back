import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '@utils/AppError';
import { logger } from '@config/logger';
import { isProd } from '@config/env';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.flatten();
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = `Duplicate value for ${(err.meta?.target as string[])?.join(', ') ?? 'field'}`;
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Record not found';
    } else {
      status = 400;
      code = 'DB_ERROR';
      message = 'Database request error';
    }
  }

  if (status >= 500) {
    logger.error(message, { err, path: req.originalUrl, userId: req.user?.id });
  }

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
};
