import { Router } from 'express';
import { interactionController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import {
  CreateInteractionSchema,
  DishIdParamSchema,
  QueryInteractionsSchema,
} from './schema.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  validate({ body: CreateInteractionSchema }),
  (req, res, next) => interactionController.recordInteraction(req, res, next)
);

router.delete(
  '/saved/:dishId',
  authMiddleware,
  validate({ params: DishIdParamSchema }),
  (req, res, next) => interactionController.unsaveDish(req, res, next)
);

router.get(
  '/me',
  authMiddleware,
  validate({ query: QueryInteractionsSchema }),
  (req, res, next) => interactionController.getMyInteractions(req, res, next)
);

export const interactionRoutes = router;
