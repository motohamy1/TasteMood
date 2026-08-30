import { Request, Response, NextFunction } from 'express';
import { taxonomyService } from './service.js';

export class TaxonomyController {
  async getAllTaxonomies(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.getAllTaxonomies();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getCuisines(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.getCuisines();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.getCategories();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getTags(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.getFoodTags();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getAtmosphereTags(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await taxonomyService.getAtmosphereTags();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createCuisine(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const data = await taxonomyService.createCuisine(name, description);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const data = await taxonomyService.createCategory(name, description);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const data = await taxonomyService.createFoodTag(name, description);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createAtmosphereTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const data = await taxonomyService.createAtmosphereTag(name, description);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const taxonomyController = new TaxonomyController();
