import { restaurantRepository } from './repository.js';
import { CreateRestaurantInput, QueryRestaurantInput, UpdateRestaurantInput } from './schema.js';
import { AppError } from '../../common/errors/app-error.js';

export class RestaurantService {
  async getRestaurants(params: QueryRestaurantInput) {
    return restaurantRepository.findMany(params);
  }

  async getRestaurantById(id: string) {
    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      throw AppError.notFound(`Restaurant with ID ${id} not found`);
    }
    return restaurant;
  }

  async getRestaurantBySlug(slug: string) {
    const restaurant = await restaurantRepository.findBySlug(slug);
    if (!restaurant) {
      throw AppError.notFound(`Restaurant with slug ${slug} not found`);
    }
    return restaurant;
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
