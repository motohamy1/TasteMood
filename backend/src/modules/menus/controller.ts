import { Request, Response, NextFunction } from 'express';
import { menuService } from './service.js';

export class MenuController {
  async getMenus(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurantId = req.query.restaurantId as string | undefined;
      const branchId = req.query.branchId as string | undefined;
      const menus = await menuService.getMenus(restaurantId, branchId);
      res.json({ success: true, data: menus });
    } catch (error) {
      next(error);
    }
  }

  async getMenuById(req: Request, res: Response, next: NextFunction) {
    try {
      const menu = await menuService.getMenuById(req.params.id);
      res.json({ success: true, data: menu });
    } catch (error) {
      next(error);
    }
  }

  async createMenu(req: Request, res: Response, next: NextFunction) {
    try {
      const menu = await menuService.createMenu(req.body);
      res.status(201).json({ success: true, data: menu });
    } catch (error) {
      next(error);
    }
  }

  async updateMenu(req: Request, res: Response, next: NextFunction) {
    try {
      const menu = await menuService.updateMenu(req.params.id, req.body);
      res.json({ success: true, data: menu });
    } catch (error) {
      next(error);
    }
  }

  async deleteMenu(req: Request, res: Response, next: NextFunction) {
    try {
      await menuService.deleteMenu(req.params.id);
      res.json({ success: true, data: { message: 'Menu deleted successfully' } });
    } catch (error) {
      next(error);
    }
  }
}

export const menuController = new MenuController();
