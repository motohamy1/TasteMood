import { Request, Response, NextFunction } from 'express';
import { interactionService } from './service.js';
import { requireCaller } from '../../common/types/identity.js';
import { QueryInteractionsInput } from './schema.js';

export class InteractionController {
  async recordInteraction(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = requireCaller(req);
      const interaction = await interactionService.recordInteraction(caller.id, req.body);
      res.status(201).json({ success: true, data: interaction });
    } catch (error) {
      next(error);
    }
  }

  async unsaveDish(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = requireCaller(req);
      const result = await interactionService.removeSavedInteraction(
        caller.id,
        req.params.dishId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getMyInteractions(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = requireCaller(req);
      const result = await interactionService.getUserInteractions(
        caller.id,
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
