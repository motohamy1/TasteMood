import { Router } from 'express';
import { taxonomyController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import {
  CreateCuisineSchema,
  CreateCategorySchema,
  CreateTagSchema,
  CreateAtmosphereSchema,
} from './schema.js';

const router = Router();

router.get('/', (req, res, next) => taxonomyController.getAllTaxonomies(req, res, next));
router.get('/cuisines', (req, res, next) => taxonomyController.getCuisines(req, res, next));
router.get('/categories', (req, res, next) => taxonomyController.getCategories(req, res, next));
router.get('/tags', (req, res, next) => taxonomyController.getTags(req, res, next));
router.get('/atmosphere', (req, res, next) => taxonomyController.getAtmosphereTags(req, res, next));

// Admin management
router.post(
  '/cuisines',
  authMiddleware,
  requireRole('ADMIN'),
  validate({ body: CreateCuisineSchema }),
  (req, res, next) => taxonomyController.createCuisine(req, res, next)
);

router.post(
  '/categories',
  authMiddleware,
  requireRole('ADMIN'),
  validate({ body: CreateCategorySchema }),
  (req, res, next) => taxonomyController.createCategory(req, res, next)
);

router.post(
  '/tags',
  authMiddleware,
  requireRole('ADMIN'),
  validate({ body: CreateTagSchema }),
  (req, res, next) => taxonomyController.createTag(req, res, next)
);

router.post(
  '/atmosphere',
  authMiddleware,
  requireRole('ADMIN'),
  validate({ body: CreateAtmosphereSchema }),
  (req, res, next) => taxonomyController.createAtmosphereTag(req, res, next)
);

export const taxonomyRoutes = router;
