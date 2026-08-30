import { menuRepository } from './repository.js';
import { CreateMenuInput, UpdateMenuInput } from './schema.js';
import { AppError } from '../../common/errors/app-error.js';

export class MenuService {
  async getMenus(restaurantId?: string, branchId?: string) {
    return menuRepository.findMany(restaurantId, branchId);
  }

  async getMenuById(id: string) {
    const menu = await menuRepository.findById(id);
    if (!menu) {
      throw AppError.notFound(`Menu with ID ${id} not found`);
    }
    return menu;
  }

  async createMenu(input: CreateMenuInput) {
    return menuRepository.create(input);
  }

  async updateMenu(id: string, input: UpdateMenuInput) {
    await this.getMenuById(id);
    return menuRepository.update(id, input);
  }

  async deleteMenu(id: string) {
    await this.getMenuById(id);
    return menuRepository.delete(id);
  }
}

export const menuService = new MenuService();
