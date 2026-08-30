import { Router } from 'express';
import { searchController } from './controller.js';
import { validate } from '../../middleware/validation.middleware.js';
import { SearchDishesSchema, SearchRestaurantsSchema } from './schema.js';

const router = Router();

router.get(
  '/restaurants',
  validate({ query: SearchRestaurantsSchema }),
  (req, res, next) => searchController.searchRestaurants(req, res, next)
);

router.get(
  '/dishes',
  validate({ query: SearchDishesSchema }),
  (req, res, next) => searchController.searchDishes(req, res, next)
);

export const searchRoutes = router;
