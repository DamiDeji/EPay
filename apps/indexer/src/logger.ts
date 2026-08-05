import pino from 'pino';

export const logger = pino({
  name: 'epay-indexer',
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export function createChildLogger(component: string): pino.Logger {
  return logger.child({ component });
}
