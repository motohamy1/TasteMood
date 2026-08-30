import { branchRepository } from './repository.js';
import { CreateBranchInput, QueryBranchInput, UpdateBranchInput } from './schema.js';
import { AppError } from '../../common/errors/app-error.js';
import { calculateHaversineDistanceKm } from '../../common/utils/geo.utils.js';
import { BranchOperatingHour } from '@prisma/client';

export class BranchService {
  /**
   * Evaluates if branch is currently open based on day-of-week and 24h open/close times.
   */
  isBranchOpen(hours: BranchOperatingHour[], now: Date = new Date()): boolean {
    if (!hours || hours.length === 0) return true; // Default open if no explicit hours defined

    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentFormatted = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    const todaysHours = hours.filter((h) => h.dayOfWeek === currentDay);
    if (todaysHours.length === 0) return false;

    for (const shift of todaysHours) {
      if (shift.isClosed) return false;

      // Handle normal daytime shift (e.g. 09:00 - 23:00)
      if (shift.openTime <= shift.closeTime) {
        if (currentFormatted >= shift.openTime && currentFormatted <= shift.closeTime) {
          return true;
        }
      } else {
        // Handle overnight shift (e.g. 18:00 - 03:00)
        if (currentFormatted >= shift.openTime || currentFormatted <= shift.closeTime) {
          return true;
        }
      }
    }

    return false;
  }

  async getBranches(params: QueryBranchInput) {
    const branches = await branchRepository.findMany(params);
    const now = new Date();

    let result = branches.map((branch) => {
      const isOpen = this.isBranchOpen(branch.operatingHours, now);
      let distanceKm: number | undefined;

      if (params.latitude !== undefined && params.longitude !== undefined) {
        distanceKm = calculateHaversineDistanceKm(
          params.latitude,
          params.longitude,
          branch.latitude,
          branch.longitude
        );
      }

      return {
        ...branch,
        isOpen,
        distanceKm: distanceKm !== undefined ? Number(distanceKm.toFixed(2)) : undefined,
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

    const isOpen = this.isBranchOpen(branch.operatingHours);
    let distanceKm: number | undefined;

    if (userLat !== undefined && userLng !== undefined) {
      distanceKm = calculateHaversineDistanceKm(userLat, userLng, branch.latitude, branch.longitude);
    }

    return {
      ...branch,
      isOpen,
      distanceKm: distanceKm !== undefined ? Number(distanceKm.toFixed(2)) : undefined,
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
