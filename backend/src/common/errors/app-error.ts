import { ERROR_CODES, ErrorCode } from './error-codes.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, ERROR_CODES.BAD_REQUEST, details);
  }

  static validation(message: string, details?: unknown) {
    return new AppError(message, 422, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static unauthorized(message: string = 'Unauthorized access') {
    return new AppError(message, 401, ERROR_CODES.UNAUTHORIZED);
  }

  static forbidden(message: string = 'Forbidden resource') {
    return new AppError(message, 403, ERROR_CODES.FORBIDDEN);
  }

  static notFound(message: string = 'Resource not found') {
    return new AppError(message, 404, ERROR_CODES.NOT_FOUND);
  }

  static conflict(message: string) {
    return new AppError(message, 409, ERROR_CODES.CONFLICT);
  }

  static aiError(message: string, details?: unknown) {
    return new AppError(message, 502, ERROR_CODES.AI_PROVIDER_ERROR, details);
  }
}
