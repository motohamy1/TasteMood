import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { ERROR_CODES } from '../common/errors/error-codes.js';
import { logger } from '../common/utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`AppError [${err.code}]: ${err.message}`, err);
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Unhandled / Internal Errors
  logger.error('Unhandled Server Error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}
