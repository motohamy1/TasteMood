import { restaurantRepository } from './repository.js';
import {
  CreateRestaurantInput,
  QueryRestaurantCityInput,
  QueryRestaurantInput,
  UpdateRestaurantInput,
} from './schema.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  countRestaurantsByCity,
  presentRestaurantAreas,
  presentRestaurantBrowse,
  presentRestaurantDetail,
  refineGeoBrowseResults,
  RestaurantAreaCountDTO,
  RestaurantBrowseDTO,
  RestaurantDetailDTO,
  RestaurantKindCountDTO,
} from './presenter.js';

/**
 * Bilingual labels for the kinds the importer writes. Kept here (not in the
 * taxonomy) because this is presentation for the browse filter, and a kind may
 * exist in the data without a label.
 */
const PLACE_KIND_LABELS_EN: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Coffee shop',
  fast_food: 'Fast food',
  bakery: 'Bakery',
  ice_cream: 'Ice cream',
  bar: 'Cafe & lounge',
  food_court: 'Food court',
};

const PLACE_KIND_LABELS_AR: Record<string, string> = {
  restaurant: 'مطعم',
  cafe: 'كافيه',
  fast_food: 'أكل سريع',
  bakery: 'مخبز',
  ice_cream: 'آيس كريم',
  bar: 'مقهى',
  food_court: 'فود كورت',
};

export interface RestaurantBrowsePage {
  items: RestaurantBrowseDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class RestaurantService {
  async getRestaurants(params: QueryRestaurantInput): Promise<RestaurantBrowsePage> {
    const hasOrigin = params.latitude !== undefined && params.longitude !== undefined;

    if (params.sort === 'distance' && !hasOrigin) {
      throw AppError.badRequest('sort=distance requires latitude and longitude');
    }

    const origin = hasOrigin
      ? { latitude: params.latitude as number, longitude: params.longitude as number }
      : null;
    const now = new Date();
    const { items, total } = await restaurantRepository.findMany(params);

    if (!origin) {
      return {
        items: items.map((row) => presentRestaurantBrowse(row, { now })),
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      };
    }

    // Geo mode: the repository returned every match (distance is computed from
    // branch coordinates, so the DB cannot paginate by it). The radius filter,
    // the ordering and the page slice all happen here, in memory.
    const ranked = refineGeoBrowseResults(
      items.map((row) => presentRestaurantBrowse(row, { origin, now })),
      { radiusKm: params.radiusKm, sort: params.sort }
    );
    const start = (params.page - 1) * params.limit;

    return {
      items: ranked.slice(start, start + params.limit),
      total: ranked.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(ranked.length / params.limit),
    };
  }

  /** Cities (markaz) that hold at least one ACTIVE restaurant, busiest first. */
  async getRestaurantCities(
    params: QueryRestaurantCityInput
  ): Promise<RestaurantAreaCountDTO[]> {
    const [cities, branchPairs] = await Promise.all([
      restaurantRepository.findCities(params.governorate),
      restaurantRepository.findActiveRestaurantCityPairs(params.governorate),
    ]);

    return presentRestaurantAreas(cities, countRestaurantsByCity(branchPairs));
  }

  /**
   * Kinds of place the catalogue holds, with counts, so the client can offer a
   * "coffee shops" filter that reflects real coverage instead of a fixed list
   * that might match nothing.
   */
  async getPlaceKinds(params: QueryRestaurantCityInput): Promise<RestaurantKindCountDTO[]> {
    const rows = await restaurantRepository.findActiveBranchKindCounts(params.governorate);

    return rows
      .map((row) => ({
        kind: row.placeKind,
        count: row.branchCount,
        nameEn: PLACE_KIND_LABELS_EN[row.placeKind] ?? null,
        nameAr: PLACE_KIND_LABELS_AR[row.placeKind] ?? null,
      }))
      .filter((row) => row.nameEn !== null || row.nameAr !== null);
  }

  async getRestaurantById(id: string): Promise<RestaurantDetailDTO> {
    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      throw AppError.notFound(`Restaurant with ID ${id} not found`);
    }
    return presentRestaurantDetail(restaurant);
  }

  async getRestaurantBySlug(slug: string): Promise<RestaurantDetailDTO> {
    const restaurant = await restaurantRepository.findBySlug(slug);
    if (!restaurant) {
      throw AppError.notFound(`Restaurant with slug ${slug} not found`);
    }
    return presentRestaurantDetail(restaurant);
  }

  async createRestaurant(input: CreateRestaurantInput) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = await restaurantRepository.findBySlug(slug);
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    return restaurantRepository.create({
      ...input,
      slug: finalSlug,
    });
  }

  async updateRestaurant(id: string, input: UpdateRestaurantInput) {
    await this.getRestaurantById(id);
    return restaurantRepository.update(id, input);
  }

  async deleteRestaurant(id: string) {
    await this.getRestaurantById(id);
    return restaurantRepository.delete(id);
  }
}

export const restaurantService = new RestaurantService();
