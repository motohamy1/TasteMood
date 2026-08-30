import { Router } from 'express';
import { menuController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateMenuSchema, UpdateMenuSchema } from './schema.js';

const router = Router();

router.get('/', (req, res, next) => menuController.getMenus(req, res, next));
router.get('/:id', (req, res, next) => menuController.getMenuById(req, res, next));

router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: CreateMenuSchema }),
  (req, res, next) => menuController.createMenu(req, res, next)
);

router.put(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: UpdateMenuSchema }),
  (req, res, next) => menuController.updateMenu(req, res, next)
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  (req, res, next) => menuController.deleteMenu(req, res, next)
);

export const menuRoutes = router;
