import { Request, Response, NextFunction } from 'express';
import { interactionService } from './service.js';
import { AppError } from '../../common/errors/app-error.js';
import { QueryInteractionsInput } from './schema.js';

export class InteractionController {
  async recordInteraction(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw AppError.unauthorized();
      const interaction = await interactionService.recordInteraction(req.user.id, req.body);
      res.status(201).json({ success: true, data: interaction });
    } catch (error) {
      next(error);
    }
  }

  async unsaveDish(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw AppError.unauthorized();
      const result = await interactionService.removeSavedInteraction(
        req.user.id,
        req.params.dishId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getMyInteractions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw AppError.unauthorized();
      const result = await interactionService.getUserInteractions(
        req.user.id,
        req.query as unknown as QueryInteractionsInput
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

export const interactionController = new InteractionController();
