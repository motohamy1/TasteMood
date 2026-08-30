import { Router } from 'express';
import { restaurantController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import {
  CreateRestaurantSchema,
  QueryRestaurantSchema,
  UpdateRestaurantSchema,
} from './schema.js';

const router = Router();

router.get(
  '/',
  validate({ query: QueryRestaurantSchema }),
  (req, res, next) => restaurantController.getRestaurants(req, res, next)
);

router.get('/slug/:slug', (req, res, next) =>
  restaurantController.getRestaurantBySlug(req, res, next)
);

router.get('/:id', (req, res, next) =>
  restaurantController.getRestaurantById(req, res, next)
);

router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: CreateRestaurantSchema }),
  (req, res, next) => restaurantController.createRestaurant(req, res, next)
);

router.put(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: UpdateRestaurantSchema }),
  (req, res, next) => restaurantController.updateRestaurant(req, res, next)
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  (req, res, next) => restaurantController.deleteRestaurant(req, res, next)
);

export const restaurantRoutes = router;
