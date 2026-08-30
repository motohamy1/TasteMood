import { Request, Response, NextFunction } from 'express';
import { recommendationService } from './recommendation.service.js';

export class RecommendationController {
  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await recommendationService.getRecommendations(req.body, req.user?.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const recommendationController = new RecommendationController();
