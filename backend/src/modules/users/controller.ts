import { Request, Response, NextFunction } from 'express';
import { userService } from './service.js';
import { AppError } from '../../common/errors/app-error.js';

export class UserController {
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw AppError.unauthorized();
      const profile = await userService.getProfile(req.user.id);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw AppError.unauthorized();
      const profile = await userService.updateProfile(req.user.id, req.body);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await userService.getAllUsers(page, limit);
      res.json({ success: true, data: result.items, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
