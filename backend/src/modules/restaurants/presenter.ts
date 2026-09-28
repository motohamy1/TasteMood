/**
 * Restaurant presenter — maps raw Prisma restaurant rows (with the includes of
 * the restaurants repository) into the browse/detail DTOs the mobile client
 * consumes. Before this file the read endpoints returned raw rows, leaking
 * `source`, `externalId` and `interactions`; every read path now goes through
 * here instead.
 *
 * Geo decisions (open state, distance) are delegated to the branches
 * availability module — the single owner of that math.
 */
import { Coordinates } from '../../common/utils/geo.utils.js';
import { evaluateBranch, OperatingHoursLike } from '../branches/availability.js';
import { DishDTO, presentDish } from '../dishes/presenter.js';
import type { RestaurantSort } from './schema.js';

export interface RestaurantCuisineDTO {
  slug: string;
  name: string;
  nameAr: string | null;
}

/** A city (markaz) reference without its counts — see `RestaurantAreaCountDTO`. */
export interface RestaurantAreaRefDTO {
  slug: string;
  nameEn: string;
  nameAr: string;
}

export interface RestaurantBranchDTO {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  /** `null` when the branch declares no operating hours (unknown, not closed). */
  isOpen: boolean | null;
  area: RestaurantAreaRefDTO | null;
  atmospheres: string[];
}

export interface RestaurantBrowseDTO {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  description: string | null;
  priceRange: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  cuisines: RestaurantCuisineDTO[];
  /** Nearest (or first) ACTIVE branch's city. */
  area: RestaurantAreaRefDTO | null;
  /** Nearest (or first) ACTIVE branch. */
  branch: RestaurantBranchDTO | null;
  branchesCount: number;
  distanceMeters: number | null;
}

export interface RestaurantDetailDTO extends RestaurantBrowseDTO {
  /** Every ACTIVE branch, nearest first when an origin was supplied. */
  branches: RestaurantBranchDTO[];
  /** ACTIVE dishes of the restaurant's ACTIVE menus, via the shared dish presenter. */
  dishes: DishDTO[];
}

/** City row of GET /restaurants/cities. */
export interface RestaurantAreaCountDTO extends RestaurantAreaRefDTO {
  latitude: number | null;
  longitude: number | null;
  restaurantCount: number;
}

/** Shape of a `city`/`governorate` selection on a branch row. */
export interface RestaurantAreaRowLike {
  slug: string;
  nameEn: string;
  nameAr: string;
}

export interface RestaurantBranchRowLike {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  operatingHours?: OperatingHoursLike[] | null;
  city?: RestaurantAreaRowLike | null;
  atmospheres?: { atmosphereTag: { name: string } }[] | null;
}

export interface RestaurantRowLike {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  description: string | null;
  priceRange: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  cuisines?: { cuisine: { slug: string; name: string; nameAr: string | null } }[];
  branches?: RestaurantBranchRowLike[];
}

export interface RestaurantDetailRowLike extends RestaurantRowLike {
  menus?: { dishes?: DishRowLike[] }[];
}

/** Dish row accepted by the shared dish presenter. */
export type DishRowLike = Parameters<typeof presentDish>[0];

/** City row as selected by the repository for the /cities endpoint. */
export interface RestaurantCityRowLike {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PresentRestaurantOptions {
  origin?: Coordinates | null;
  now?: Date;
}

export interface EvaluatedRestaurantBranch {
  branch: RestaurantBranchRowLike;
  isOpen: boolean | null;
  distanceMeters: number | null;
}

/**
 * Annotates a restaurant's ACTIVE branches with open state and distance from
 * `origin` (via `evaluateBranch`), and orders them nearest first when an origin
 * is given so `[0]` is the branch the browse row should show.
 */
export function evaluateRestaurantBranches(
  branches: RestaurantBranchRowLike[] | null | undefined,
  origin?: Coordinates | null,
  now: Date = new Date()
): EvaluatedRestaurantBranch[] {
  const evaluated = (branches ?? []).map<EvaluatedRestaurantBranch>((branch) => {
    const { isOpen, distanceKm } = evaluateBranch(branch, origin, now);

    return {
      branch,
      isOpen,
      distanceMeters: distanceKm === undefined ? null : Math.round(distanceKm * 1000),
    };
  });

  if (origin) {
    // Stable sort: branches without a measurable distance keep their input order.
    evaluated.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  }

  return evaluated;
}

/** Minimum measured distance across a restaurant's branches, or `null` if none. */
export function minDistanceMeters(branches: EvaluatedRestaurantBranch[]): number | null {
  let min: number | null = null;

  for (const entry of branches) {
    if (entry.distanceMeters === null) continue;
    if (min === null || entry.distanceMeters < min) min = entry.distanceMeters;
  }

  return min;
}

/** ACTIVE dishes of the restaurant's ACTIVE menus, flattened through `presentDish`. */
export function presentRestaurantDishes(row: RestaurantDetailRowLike): DishDTO[] {
  return (row.menus ?? []).flatMap((menu) => (menu.dishes ?? []).map(presentDish));
}

/**
 * Radius filter + ordering for the in-memory geo path. Prisma cannot order by a
 * computed relation distance, so the repositories fetch every matching row and
 * this pure pass (plus the pagination slice in the service) finishes the query.
 */
export function refineGeoBrowseResults(
  rows: RestaurantBrowseDTO[],
  options: { radiusKm?: number; sort: RestaurantSort }
): RestaurantBrowseDTO[] {
  const radiusMeters = options.radiusKm === undefined ? undefined : options.radiusKm * 1000;

  const inRange = rows.filter(
    (row) =>
      row.distanceMeters !== null &&
      (radiusMeters === undefined || row.distanceMeters <= radiusMeters)
  );

  if (options.sort === 'distance') {
    return inRange.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  }

  if (options.sort === 'name') {
    return inRange.sort((a, b) => a.name.localeCompare(b.name));
  }

  // `newest` — the repository already ordered the rows by createdAt desc.
  return inRange;
}

/**
 * Distinct ACTIVE restaurants per city, keyed by city id. Input rows are the
 * `(restaurantId, cityId)` pairs of ACTIVE branches of ACTIVE restaurants;
 * a restaurant with two branches in one city counts once.
 */
export function countRestaurantsByCity(
  branchPairs: { restaurantId: string; cityId: string | null }[]
): Map<string, number> {
  const restaurantsPerCity = new Map<string, Set<string>>();

  for (const pair of branchPairs) {
    if (!pair.cityId) continue;

    const restaurants = restaurantsPerCity.get(pair.cityId) ?? new Set<string>();
    restaurants.add(pair.restaurantId);
    restaurantsPerCity.set(pair.cityId, restaurants);
  }

  const counts = new Map<string, number>();
  for (const [cityId, restaurants] of restaurantsPerCity) {
    counts.set(cityId, restaurants.size);
  }

  return counts;
}

/** Cities that have at least one ACTIVE restaurant, most restaurants first. */
export function presentRestaurantAreas(
  cities: RestaurantCityRowLike[],
  restaurantCounts: Map<string, number>
): RestaurantAreaCountDTO[] {
  return cities
    .map<RestaurantAreaCountDTO>((city) => ({
      slug: city.slug,
      nameEn: city.nameEn,
      nameAr: city.nameAr,
      latitude: city.latitude,
      longitude: city.longitude,
      restaurantCount: restaurantCounts.get(city.id) ?? 0,
    }))
    .filter((area) => area.restaurantCount > 0)
    .sort((a, b) => b.restaurantCount - a.restaurantCount || a.nameEn.localeCompare(b.nameEn));
}

/** Presented branch: annotated branch row + its city reference. */
export function presentRestaurantBranch(entry: EvaluatedRestaurantBranch): RestaurantBranchDTO {
  const { branch } = entry;
  const city = branch.city ?? null;

  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    phone: branch.phone,
    isOpen: entry.isOpen,
    area: city ? { slug: city.slug, nameEn: city.nameEn, nameAr: city.nameAr } : null,
    atmospheres: (branch.atmospheres ?? []).map(({ atmosphereTag }) => atmosphereTag.name),
  };
}

function buildBrowseDTO(
  row: RestaurantRowLike,
  branches: EvaluatedRestaurantBranch[],
  hasOrigin: boolean
): RestaurantBrowseDTO {
  const primaryBranch = branches[0] ?? null;
  const primaryCity = primaryBranch?.branch.city ?? null;

  return {
    id: row.id,
    name: row.name,
    nameEn: row.nameEn,
    slug: row.slug,
    description: row.description,
    priceRange: row.priceRange,
    logoUrl: row.logoUrl,
    coverImageUrl: row.coverImageUrl,
    cuisines: (row.cuisines ?? []).map(({ cuisine }) => ({
      slug: cuisine.slug,
      name: cuisine.name,
      nameAr: cuisine.nameAr,
    })),
    area: primaryCity
      ? { slug: primaryCity.slug, nameEn: primaryCity.nameEn, nameAr: primaryCity.nameAr }
      : null,
    branch: primaryBranch ? presentRestaurantBranch(primaryBranch) : null,
    branchesCount: branches.length,
    distanceMeters: hasOrigin ? minDistanceMeters(branches) : null,
  };
}

/** Browse row for GET /restaurants. */
export function presentRestaurantBrowse(
  row: RestaurantRowLike,
  options: PresentRestaurantOptions = {}
): RestaurantBrowseDTO {
  const origin = options.origin ?? null;
  const branches = evaluateRestaurantBranches(row.branches, origin, options.now);

  return buildBrowseDTO(row, branches, origin !== null);
}

/** Detail row for GET /restaurants/:id and /restaurants/slug/:slug. */
export function presentRestaurantDetail(
  row: RestaurantDetailRowLike,
  options: PresentRestaurantOptions = {}
): RestaurantDetailDTO {
  const origin = options.origin ?? null;
  const branches = evaluateRestaurantBranches(row.branches, origin, options.now);

  return {
    ...buildBrowseDTO(row, branches, origin !== null),
    branches: branches.map((entry) => presentRestaurantBranch(entry)),
    dishes: presentRestaurantDishes(row),
  };
}
