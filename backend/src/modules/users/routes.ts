import { Router } from 'express';
import { userController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';

const router = Router();

router.get('/me', authMiddleware, (req, res, next) => userController.getMe(req, res, next));
router.put('/me', authMiddleware, (req, res, next) => userController.updateMe(req, res, next));

// Admin user management
router.get('/admin/users', authMiddleware, requireRole('ADMIN'), (req, res, next) =>
  userController.getAllUsers(req, res, next)
);

export const userRoutes = router;
