import { Request, Response, NextFunction } from 'express';
import { searchService } from './service.js';
import { SearchDishesInput, SearchRestaurantsInput } from './schema.js';

export class SearchController {
  async searchRestaurants(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await searchService.searchRestaurants(
        req.query as unknown as SearchRestaurantsInput
      );
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

  async searchDishes(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await searchService.searchDishes(
        req.query as unknown as SearchDishesInput
      );
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
}

export const searchController = new SearchController();
