import { dishRepository } from './repository.js';
import { presentDish, presentDishList } from './presenter.js';
import { CreateDishInput, QueryDishInput, UpdateDishInput } from './schema.js';
import { AppError } from '../../common/errors/app-error.js';

export class DishService {
  async getDishes(params: QueryDishInput) {
    const result = await dishRepository.findMany(params);
    return { ...result, items: presentDishList(result.items) };
  }

  async getDishById(id: string) {
    const dish = await dishRepository.findById(id);
    if (!dish) {
      throw AppError.notFound(`Dish with ID ${id} not found`);
    }
    return presentDish(dish);
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
