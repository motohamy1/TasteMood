import { Request, Response, NextFunction } from 'express';
import { restaurantService } from './service.js';
import { QueryRestaurantInput } from './schema.js';

export class RestaurantController {
  async getRestaurants(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await restaurantService.getRestaurants(req.query as unknown as QueryRestaurantInput);
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

  async getRestaurantById(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurant = await restaurantService.getRestaurantById(req.params.id);
      res.json({ success: true, data: restaurant });
    } catch (error) {
      next(error);
    }
  }

  async getRestaurantBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurant = await restaurantService.getRestaurantBySlug(req.params.slug);
      res.json({ success: true, data: restaurant });
    } catch (error) {
      next(error);
    }
  }

  async createRestaurant(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurant = await restaurantService.createRestaurant(req.body);
      res.status(201).json({ success: true, data: restaurant });
    } catch (error) {
      next(error);
    }
  }

  async updateRestaurant(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurant = await restaurantService.updateRestaurant(req.params.id, req.body);
      res.json({ success: true, data: restaurant });
    } catch (error) {
      next(error);
    }
  }

  async deleteRestaurant(req: Request, res: Response, next: NextFunction) {
    try {
      await restaurantService.deleteRestaurant(req.params.id);
      res.json({ success: true, data: { message: 'Restaurant deleted successfully' } });
    } catch (error) {
      next(error);
    }
  }
}

export const restaurantController = new RestaurantController();
