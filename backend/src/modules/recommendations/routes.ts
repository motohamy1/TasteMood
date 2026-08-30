import { Router } from 'express';
import { recommendationController } from './controller.js';
import { optionalAuthMiddleware } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rate-limit.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { RecommendationRequestSchema } from './schema.js';

const router = Router();

router.post(
  '/',
  optionalAuthMiddleware,
  aiRateLimiter,
  validate({ body: RecommendationRequestSchema }),
  (req, res, next) => recommendationController.getRecommendations(req, res, next)
);

export const recommendationRoutes = router;
