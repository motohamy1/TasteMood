import { preferencesRepository } from './repository.js';
import { UpdatePreferencesInput } from './schema.js';

export class PreferencesService {
  async getUserPreferences(userId: string) {
    let profile = await preferencesRepository.findByUserId(userId);
    if (!profile) {
      profile = await preferencesRepository.upsert(userId, {
        preferredCuisines: [],
        dislikedCuisines: [],
        dietaryRestrictions: [],
        preferredMealTypes: [],
        atmospherePreferences: [],
      });
    }
    return profile;
  }

  async updatePreferences(userId: string, input: UpdatePreferencesInput) {
    return preferencesRepository.upsert(userId, input);
  }
}

export const preferencesService = new PreferencesService();
