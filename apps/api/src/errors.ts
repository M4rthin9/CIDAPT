import { ZodError } from 'zod';
import type { StatusCode } from 'hono/utils/http-status';
import { getLogger } from './logger';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageTh: string,
    public readonly messageEn: string,
    public readonly status: StatusCode = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(messageEn);
    this.name = 'AppError';
  }
}

export function toErrorResponse(err: unknown, requestId?: string) {
  const log = getLogger();

  if (err instanceof AppError) {
    log.warn({ code: err.code, requestId }, err.messageEn);
    return {
      error: {
        code: err.code,
        message_th: err.messageTh,
        message_en: err.messageEn,
        details: err.details,
        request_id: requestId,
      },
    };
  }

  if (err instanceof ZodError) {
    log.warn({ code: 'validation_error', requestId }, 'Zod validation failed');
    return {
      error: {
        code: 'validation_error',
        message_th: 'ข้อมูลไม่ถูกต้อง',
        message_en: 'Validation error',
        details: Object.fromEntries(
          err.issues.map((i) => [i.path.join('.'), i.message]),
        ),
        request_id: requestId,
      },
    };
  }

  log.error({ err, requestId }, 'Unhandled error');
  return {
    error: {
      code: 'internal_error',
      message_th: 'เกิดข้อผิดพลาดภายใน',
      message_en: 'Internal server error',
      request_id: requestId,
    },
  };
}

export function getErrorStatus(err: unknown): StatusCode {
  if (err instanceof AppError) return err.status;
  if (err instanceof ZodError) return 422;
  return 500;
}
