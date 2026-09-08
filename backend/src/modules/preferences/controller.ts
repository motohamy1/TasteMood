import { Request, Response, NextFunction } from 'express';
import { preferencesService } from './service.js';
import { requireCaller } from '../../common/types/identity.js';

export class PreferencesController {
  async getMyPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = requireCaller(req);
      const profile = await preferencesService.getUserPreferences(caller.id);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateMyPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = requireCaller(req);
      const profile = await preferencesService.updatePreferences(caller.id, req.body);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
}

export const preferencesController = new PreferencesController();
