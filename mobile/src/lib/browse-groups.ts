/**
 * Pure list-shaping for the browse screen: de-duplication of recommendation
 * items and the two mappings onto the place-card view model. Kept out of the
 * component so they are unit-testable (see browse-groups.test.ts).
 */

import type { RecommendationItem } from "@/types/recommendation";
import type {
  RestaurantArea,
  RestaurantCardItem,
  RestaurantSummary,
} from "@/types/restaurant";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km — mirrors the backend's haversine helper. */
function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The markaz the user is standing in (or next to). Drives the Location rail's
 * dish list, which is area-scoped rather than radius-scoped: dishes belong to
 * the places of an area. `maxKm` keeps a user outside Dakahlia from being shown
 * another city's dishes as if they were nearby.
 */
export function nearestArea(
  areas: RestaurantArea[],
  latitude: number | null,
  longitude: number | null,
  maxKm = 40
): RestaurantArea | null {
  if (latitude === null || longitude === null || areas.length === 0) return null;

  let best: RestaurantArea | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const area of areas) {
    if (area.latitude === null || area.longitude === null) continue;
    const km = haversineKm(latitude, longitude, area.latitude, area.longitude);
    if (km < bestKm) {
      bestKm = km;
      best = area;
    }
  }
  return best && bestKm <= maxKm ? best : null;
}

/** One card per dish, in the order the backend ranked them. */
export function dedupeRecommendations(
  items: RecommendationItem[] | undefined
): RecommendationItem[] {
  const seen = new Set<string>();
  const out: RecommendationItem[] = [];
  for (const item of items ?? []) {
    const id = item?.dish?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export function cardFromRestaurant(
  restaurant: RestaurantSummary
): RestaurantCardItem {
  return {
    id: restaurant.id,
    name: restaurant.name,
    nameEn: restaurant.nameEn,
    photoUrl: restaurant.coverImageUrl ?? restaurant.logoUrl ?? null,
    cuisines: restaurant.cuisines.map((c) => ({
      name: c.name,
      nameAr: c.nameAr,
    })),
    area: restaurant.area
      ? { name: restaurant.area.nameEn, nameAr: restaurant.area.nameAr }
      : null,
    address: restaurant.branch?.address ?? null,
    isOpen: restaurant.branch?.isOpen ?? null,
    distanceMeters: restaurant.distanceMeters,
    branchesCount: restaurant.branchesCount,
    placeKind: restaurant.placeKind,
    rating: restaurant.branch?.rating ?? null,
    reviewsCount: restaurant.branch?.reviewsCount ?? null,
  };
}

/**
 * Places serving the ranked dishes of one category. The recommendation payload
 * carries the restaurant + branch inline, so a dish rail can also show the
 * places behind it without a second request.
 */
export function cardsFromRecommendations(
  items: RecommendationItem[]
): RestaurantCardItem[] {
  const byRestaurant: Record<string, RestaurantCardItem> = {};
  for (const item of items) {
    const restaurant = item.restaurant;
    if (!restaurant?.id || byRestaurant[restaurant.id]) continue;
    byRestaurant[restaurant.id] = {
      id: restaurant.id,
      name: restaurant.name,
      nameEn: restaurant.nameEn ?? null,
      photoUrl: restaurant.logoUrl ?? null,
      cuisines: (restaurant.cuisines ?? []).map((name) => ({
        name,
        nameAr: null,
      })),
      area: null,
      address: item.branch?.address ?? null,
      isOpen: item.branch?.isOpen ?? null,
      distanceMeters: item.distanceMeters,
      branchesCount: null,
      placeKind: null,
      rating: null,
      reviewsCount: null,
    };
  }
  return Object.values(byRestaurant);
}
