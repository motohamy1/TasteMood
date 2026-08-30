import { Router } from 'express';
import { preferencesController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { UpdatePreferencesSchema } from './schema.js';

const router = Router();

router.get('/me/preferences', authMiddleware, (req, res, next) =>
  preferencesController.getMyPreferences(req, res, next)
);

router.put(
  '/me/preferences',
  authMiddleware,
  validate({ body: UpdatePreferencesSchema }),
  (req, res, next) => preferencesController.updateMyPreferences(req, res, next)
);

export const preferenceRoutes = router;
