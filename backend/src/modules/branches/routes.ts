import { Router } from 'express';
import { branchController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateBranchSchema, QueryBranchSchema, UpdateBranchSchema } from './schema.js';

const router = Router();

router.get(
  '/',
  validate({ query: QueryBranchSchema }),
  (req, res, next) => branchController.getBranches(req, res, next)
);

router.get('/:id', (req, res, next) =>
  branchController.getBranchById(req, res, next)
);

router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: CreateBranchSchema }),
  (req, res, next) => branchController.createBranch(req, res, next)
);

router.put(
  '/:id',
  authMiddleware,
  requireRole('ADMIN', 'RESTAURANT_OWNER'),
  validate({ body: UpdateBranchSchema }),
  (req, res, next) => branchController.updateBranch(req, res, next)
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  (req, res, next) => branchController.deleteBranch(req, res, next)
);

export const branchRoutes = router;
