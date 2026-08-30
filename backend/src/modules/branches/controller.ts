import { Request, Response, NextFunction } from 'express';
import { branchService } from './service.js';
import { QueryBranchInput } from './schema.js';

export class BranchController {
  async getBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const branches = await branchService.getBranches(req.query as unknown as QueryBranchInput);
      res.json({ success: true, data: branches });
    } catch (error) {
      next(error);
    }
  }

  async getBranchById(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const branch = await branchService.getBranchById(req.params.id, lat, lng);
      res.json({ success: true, data: branch });
    } catch (error) {
      next(error);
    }
  }

  async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branch = await branchService.createBranch(req.body);
      res.status(201).json({ success: true, data: branch });
    } catch (error) {
      next(error);
    }
  }

  async updateBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branch = await branchService.updateBranch(req.params.id, req.body);
      res.json({ success: true, data: branch });
    } catch (error) {
      next(error);
    }
  }

  async deleteBranch(req: Request, res: Response, next: NextFunction) {
    try {
      await branchService.deleteBranch(req.params.id);
      res.json({ success: true, data: { message: 'Branch deleted successfully' } });
    } catch (error) {
      next(error);
    }
  }
}

export const branchController = new BranchController();
