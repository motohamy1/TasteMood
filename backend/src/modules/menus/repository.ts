import { prisma } from '../../database/prisma.client.js';
import { CreateMenuInput, UpdateMenuInput } from './schema.js';

export class MenuRepository {
  async findMany(restaurantId?: string, branchId?: string) {
    return prisma.menu.findMany({
      where: {
        status: 'ACTIVE',
        ...(restaurantId ? { restaurantId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: {
        dishes: {
          where: { status: 'ACTIVE' },
          include: {
            attributes: true,
            tags: { include: { tag: true } },
            categories: { include: { category: true } },
            ingredients: { include: { ingredient: true } },
          },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.menu.findUnique({
      where: { id },
      include: {
        dishes: {
          where: { status: 'ACTIVE' },
          include: {
            attributes: true,
            tags: { include: { tag: true } },
            categories: { include: { category: true } },
            ingredients: { include: { ingredient: true } },
            priceHistory: {
              orderBy: { effectiveFrom: 'desc' },
              take: 5,
            },
          },
        },
      },
    });
  }

  async create(data: CreateMenuInput) {
    return prisma.menu.create({ data });
  }

  async update(id: string, data: UpdateMenuInput) {
    return prisma.menu.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.menu.delete({
      where: { id },
    });
  }
}

export const menuRepository = new MenuRepository();
