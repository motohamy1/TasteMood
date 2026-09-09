import { branchRepository } from './repository.js';
import { CreateBranchInput, QueryBranchInput, UpdateBranchInput } from './schema.js';
import { AppError } from '../../common/errors/app-error.js';
import { BranchOperatingHour } from '@prisma/client';
import { evaluateBranch, isBranchOpenAt } from './availability.js';

export class BranchService {
  /**
   * Evaluates if branch is currently open based on day-of-week and 24h open/close times.
   * Delegates to the shared geo-availability module.
   */
  isBranchOpen(hours: BranchOperatingHour[], now: Date = new Date()): boolean {
    return isBranchOpenAt(hours, now);
  }

  async getBranches(params: QueryBranchInput) {
    const branches = await branchRepository.findMany(params);
    const now = new Date();
    const origin =
      params.latitude !== undefined && params.longitude !== undefined
        ? { latitude: params.latitude, longitude: params.longitude }
        : undefined;

    let result = branches.map((branch) => {
      const { isOpen, distanceKm } = evaluateBranch(branch, origin, now);

      return {
        ...branch,
        isOpen,
        distanceKm,
      };
    });

    if (params.latitude !== undefined && params.longitude !== undefined) {
      result = result.filter(
        (b) => b.distanceKm !== undefined && b.distanceKm <= (params.radiusKm || 10)
      );
      result.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    if (params.openNow) {
      result = result.filter((b) => b.isOpen);
    }

    return result;
  }

  async getBranchById(id: string, userLat?: number, userLng?: number) {
    const branch = await branchRepository.findById(id);
    if (!branch) {
      throw AppError.notFound(`Branch with ID ${id} not found`);
    }

    const origin =
      userLat !== undefined && userLng !== undefined
        ? { latitude: userLat, longitude: userLng }
        : undefined;
    const { isOpen, distanceKm } = evaluateBranch(branch, origin);

    return {
      ...branch,
      isOpen,
      distanceKm,
    };
  }

  async createBranch(input: CreateBranchInput) {
    return branchRepository.create(input);
  }

  async updateBranch(id: string, input: UpdateBranchInput) {
    await this.getBranchById(id);
    return branchRepository.update(id, input);
  }

  async deleteBranch(id: string) {
    await this.getBranchById(id);
    return branchRepository.delete(id);
  }
}

export const branchService = new BranchService();
