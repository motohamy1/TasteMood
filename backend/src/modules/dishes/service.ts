import { dishRepository } from './repository.js';
import { CreateDishInput, QueryDishInput, UpdateDishInput } from './schema.js';
import { AppError } from '../../common/errors/app-error.js';

export class DishService {
  async getDishes(params: QueryDishInput) {
    return dishRepository.findMany(params);
  }

  async getDishById(id: string) {
    const dish = await dishRepository.findById(id);
    if (!dish) {
      throw AppError.notFound(`Dish with ID ${id} not found`);
    }
    return dish;
  }

  async createDish(input: CreateDishInput) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return dishRepository.create({
      ...input,
      slug: `${slug}-${Date.now()}`,
    });
  }

  async updateDish(id: string, input: UpdateDishInput) {
    const existing = await this.getDishById(id);
    return dishRepository.update(id, input, existing.price);
  }

  async deleteDish(id: string) {
    await this.getDishById(id);
    return dishRepository.delete(id);
  }
}

export const dishService = new DishService();
