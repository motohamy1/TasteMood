import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { prisma } from '../../database/prisma.client.js';
import { z } from 'zod';
import { validate } from '../../middleware/validation.middleware.js';

const router = Router();

const VerifyStatusSchema = z.object({
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']),
});

// Admin Stats
router.get(
  '/stats',
  authMiddleware,
  requireRole('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        totalRestaurants,
        totalBranches,
        totalDishes,
        totalUsers,
        totalInteractions,
        verifiedRestaurants,
        verifiedDishes,
      ] = await Promise.all([
        prisma.restaurant.count(),
        prisma.branch.count(),
        prisma.dish.count(),
        prisma.user.count(),
        prisma.userInteraction.count(),
        prisma.restaurant.count({ where: { verificationStatus: 'VERIFIED' } }),
        prisma.dish.count({ where: { verificationStatus: 'VERIFIED' } }),
      ]);

      res.json({
        success: true,
        data: {
          totalRestaurants,
          totalBranches,
          totalDishes,
          totalUsers,
          totalInteractions,
          verifiedRestaurants,
          verifiedDishes,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Verify Restaurant
router.put(
  '/restaurants/:id/verify',
  authMiddleware,
  requireRole('ADMIN'),
  validate({ body: VerifyStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurant = await prisma.restaurant.update({
        where: { id: req.params.id },
        data: {
          verificationStatus: req.body.verificationStatus,
          lastVerifiedAt: new Date(),
        },
      });
      res.json({ success: true, data: restaurant });
    } catch (error) {
      next(error);
    }
  }
);

// Verify Dish
router.put(
  '/dishes/:id/verify',
  authMiddleware,
  requireRole('ADMIN'),
  validate({ body: VerifyStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dish = await prisma.dish.update({
        where: { id: req.params.id },
        data: {
          verificationStatus: req.body.verificationStatus,
          lastVerifiedAt: new Date(),
        },
      });
      res.json({ success: true, data: dish });
    } catch (error) {
      next(error);
    }
  }
);

export const adminRoutes = router;
