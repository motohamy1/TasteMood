import { Request, Response, NextFunction } from 'express';
import { pairTasteService } from './service.js';

export class PairTasteController {
  async getPairTaste(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pairTasteService.getPairTaste(req.body, req.user?.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const pairTasteController = new PairTasteController();
