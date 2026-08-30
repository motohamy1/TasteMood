import { Router } from 'express';
import { dishController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateDishSchema, QueryDishSchema, UpdateDishSchema } from './schema.js';

const router = Router();

router.get(
  '/',
  validate({ query: QueryDishSchema }),
  (req, res, next) => dishController.getDishes(req, res, next)
);

router.get('/:id', (req, res, next) =>
  dishController.getDishById(req, res, next)
);

router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: CreateDishSchema }),
  (req, res, next) => dishController.createDish(req, res, next)
);

router.put(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: UpdateDishSchema }),
  (req, res, next) => dishController.updateDish(req, res, next)
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  (req, res, next) => dishController.deleteDish(req, res, next)
);

export const dishRoutes = router;
