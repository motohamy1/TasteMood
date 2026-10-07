import { Router } from 'express';
import { pairTasteController } from './controller.js';
import { optionalAuthMiddleware } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rate-limit.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { PairTasteRequestSchema } from './schema.js';

const router = Router();

router.post(
  '/',
  optionalAuthMiddleware,
  aiRateLimiter,
  validate({ body: PairTasteRequestSchema }),
  (req, res, next) => pairTasteController.getPairTaste(req, res, next)
);

export const pairTasteRoutes = router;
