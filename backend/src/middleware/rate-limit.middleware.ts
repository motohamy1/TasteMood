import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../common/errors/app-error.js';
import { ERROR_CODES } from '../common/errors/error-codes.js';

export const standardRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests, please try again later', 429, ERROR_CODES.RATE_LIMIT_EXCEEDED));
  },
});

export const aiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('AI rate limit exceeded, please wait a moment before asking again', 429, ERROR_CODES.RATE_LIMIT_EXCEEDED));
  },
});
