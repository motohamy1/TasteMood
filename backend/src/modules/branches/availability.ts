/**
 * Geo-availability: "is this branch open right now" and "how far is it".
 *
 * This is the single owner of open-hours evaluation and per-branch distance
 * annotation. Previously the loop lived in three services (branches, search,
 * recommendations) with slightly different rounding and filter behaviour.
 */
import { BranchOperatingHour } from '@prisma/client';
import { calculateHaversineDistanceKm, Coordinates } from '../../common/utils/geo.utils.js';

export type OperatingHoursLike = Pick<
  BranchOperatingHour,
  'dayOfWeek' | 'openTime' | 'closeTime' | 'isClosed'
>;

export interface BranchLike {
  latitude?: number;
  longitude?: number;
  operatingHours?: OperatingHoursLike[] | null;
}

export interface BranchAvailability {
  isOpen: boolean;
  distanceKm?: number;
}

export interface ClosestBranchSummary {
  hasOpenBranch: boolean;
  closestDistanceKm?: number;
}

/**
 * Evaluates whether a branch is currently open based on day-of-week and
 * 24h open/close times. A branch with no declared hours defaults to open.
 */
export function isBranchOpenAt(
  hours: OperatingHoursLike[] | null | undefined,
  now: Date = new Date()
): boolean {
  if (!hours || hours.length === 0) return true;

  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentFormatted = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  const todaysHours = hours.filter((h) => h.dayOfWeek === currentDay);
  if (todaysHours.length === 0) return false;

  for (const shift of todaysHours) {
    if (shift.isClosed) return false;

    // Normal daytime shift (e.g. 09:00 - 23:00)
    if (shift.openTime <= shift.closeTime) {
      if (currentFormatted >= shift.openTime && currentFormatted <= shift.closeTime) {
        return true;
      }
    } else {
      // Overnight shift (e.g. 18:00 - 03:00)
      if (currentFormatted >= shift.openTime || currentFormatted <= shift.closeTime) {
        return true;
      }
    }
  }

  return false;
}

/** Annotate a single branch with open state and (optional) distance from an origin. */
export function evaluateBranch(
  branch: BranchLike,
  origin?: Coordinates | null,
  now: Date = new Date()
): BranchAvailability {
  const availability: BranchAvailability = {
    isOpen: isBranchOpenAt(branch.operatingHours, now),
  };

  if (
    origin &&
    branch.latitude !== undefined &&
    branch.longitude !== undefined
  ) {
    const distanceKm = calculateHaversineDistanceKm(
      origin.latitude,
      origin.longitude,
      branch.latitude,
      branch.longitude
    );
    if (distanceKm !== undefined) {
      availability.distanceKm = Number(distanceKm.toFixed(2));
    }
  }

  return availability;
}

/**
 * Summarise a set of branches for a restaurant/dish row: whether any branch is
 * open and the distance of the closest one from the given origin.
 */
export function closestBranchSummary(
  branches: BranchLike[] | null | undefined,
  origin?: Coordinates | null,
  now: Date = new Date()
): ClosestBranchSummary {
  if (!branches || branches.length === 0) {
    return { hasOpenBranch: false };
  }

  let hasOpenBranch = false;
  let closestDistanceKm: number | undefined;

  for (const branch of branches) {
    const { isOpen, distanceKm } = evaluateBranch(branch, origin, now);
    if (isOpen) hasOpenBranch = true;
    if (distanceKm !== undefined && (closestDistanceKm === undefined || distanceKm < closestDistanceKm)) {
      closestDistanceKm = distanceKm;
    }
  }

  return {
    hasOpenBranch,
    closestDistanceKm,
  };
}
