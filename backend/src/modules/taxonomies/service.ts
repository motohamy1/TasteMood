import { taxonomyRepository } from './repository.js';

export class TaxonomyService {
  async getAllTaxonomies() {
    const [cuisines, categories, tags, atmosphere, ingredients] = await Promise.all([
      taxonomyRepository.getCuisines(),
      taxonomyRepository.getCategories(),
      taxonomyRepository.getFoodTags(),
      taxonomyRepository.getAtmosphereTags(),
      taxonomyRepository.getIngredients(),
    ]);

    return {
      cuisines,
      categories,
      tags,
      atmosphere,
      ingredients,
    };
  }

  async getCuisines() {
    return taxonomyRepository.getCuisines();
  }

  async getCategories() {
    return taxonomyRepository.getCategories();
  }

  async getFoodTags() {
    return taxonomyRepository.getFoodTags();
  }

  async getAtmosphereTags() {
    return taxonomyRepository.getAtmosphereTags();
  }

  async createCuisine(name: string, description?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return taxonomyRepository.createCuisine({ name, slug, description });
  }

  async createCategory(name: string, description?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return taxonomyRepository.createCategory({ name, slug, description });
  }

  async createFoodTag(name: string, description?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return taxonomyRepository.createFoodTag({ name, slug, description });
  }

  async createAtmosphereTag(name: string, description?: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return taxonomyRepository.createAtmosphereTag({ name, slug, description });
  }
}

export const taxonomyService = new TaxonomyService();
