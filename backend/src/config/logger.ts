import winston from 'winston';
import { env, isProd } from './env';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}] ${stack || message}${rest}`;
});

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  defaultMeta: { service: env.APP_NAME },
  format: combine(timestamp(), errors({ stack: true }), isProd ? json() : combine(colorize(), devFormat)),
  transports: [new winston.transports.Console()],
});

if (isProd) {
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}
