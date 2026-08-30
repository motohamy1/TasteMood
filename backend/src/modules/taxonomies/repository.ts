import { prisma } from '../../database/prisma.client.js';

export class TaxonomyRepository {
  async getCuisines() {
    return prisma.cuisine.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getCategories() {
    return prisma.dishCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getFoodTags() {
    return prisma.foodTag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getAtmosphereTags() {
    return prisma.atmosphereTag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getIngredients() {
    return prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createCuisine(data: { name: string; slug: string; description?: string }) {
    return prisma.cuisine.create({ data });
  }

  async createCategory(data: { name: string; slug: string; description?: string }) {
    return prisma.dishCategory.create({ data });
  }

  async createFoodTag(data: { name: string; slug: string; description?: string }) {
    return prisma.foodTag.create({ data });
  }

  async createAtmosphereTag(data: { name: string; slug: string; description?: string }) {
    return prisma.atmosphereTag.create({ data });
  }
}

export const taxonomyRepository = new TaxonomyRepository();
