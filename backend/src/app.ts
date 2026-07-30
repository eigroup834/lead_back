import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { env } from '@config/env';
import { openapiDocument } from '@config/swagger';
import { registry } from '@config/metrics';
import { requestContext } from '@middleware/requestContext.middleware';
import { metricsMiddleware } from '@middleware/metrics.middleware';
import { apiRateLimiter } from '@middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from '@middleware/error.middleware';
import v1Routes from '@routes/index';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(requestContext);
  app.use(metricsMiddleware);

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  app.get('/ready', (_req, res) => res.json({ status: 'ready' }));

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

  app.use('/files', express.static(path.resolve(env.LOCAL_STORAGE_PATH)));

  app.use(env.API_PREFIX, apiRateLimiter, v1Routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
