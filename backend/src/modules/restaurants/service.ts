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
} from './presenter.js';

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
