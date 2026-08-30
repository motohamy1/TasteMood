import { Request, Response, NextFunction } from 'express';
import { preferencesService } from './service.js';
import { AppError } from '../../common/errors/app-error.js';

export class PreferencesController {
  async getMyPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw AppError.unauthorized();
      const profile = await preferencesService.getUserPreferences(req.user.id);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateMyPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw AppError.unauthorized();
      const profile = await preferencesService.updatePreferences(req.user.id, req.body);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
}

export const preferencesController = new PreferencesController();
