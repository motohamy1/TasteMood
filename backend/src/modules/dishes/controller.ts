import { Request, Response, NextFunction } from 'express';
import { dishService } from './service.js';
import { QueryDishInput } from './schema.js';

export class DishController {
  async getDishes(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dishService.getDishes(req.query as unknown as QueryDishInput);
      res.json({
        success: true,
        data: result.items,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDishById(req: Request, res: Response, next: NextFunction) {
    try {
      const dish = await dishService.getDishById(req.params.id);
      res.json({ success: true, data: dish });
    } catch (error) {
      next(error);
    }
  }

  async createDish(req: Request, res: Response, next: NextFunction) {
    try {
      const dish = await dishService.createDish(req.body);
      res.status(201).json({ success: true, data: dish });
    } catch (error) {
      next(error);
    }
  }

  async updateDish(req: Request, res: Response, next: NextFunction) {
    try {
      const dish = await dishService.updateDish(req.params.id, req.body);
      res.json({ success: true, data: dish });
    } catch (error) {
      next(error);
    }
  }

  async deleteDish(req: Request, res: Response, next: NextFunction) {
    try {
      await dishService.deleteDish(req.params.id);
      res.json({ success: true, data: { message: 'Dish deleted successfully' } });
    } catch (error) {
      next(error);
    }
  }
}

export const dishController = new DishController();
