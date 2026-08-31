import pino from 'pino';
import type { Env } from './config.js';

let _logger: pino.Logger | undefined;

export function createLogger(env: Env): pino.Logger {
  if (_logger) return _logger;
  _logger = pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
  return _logger;
}

export function getLogger(): pino.Logger {
  if (!_logger) throw new Error('Logger not initialized — call createLogger() first');
  return _logger;
}
