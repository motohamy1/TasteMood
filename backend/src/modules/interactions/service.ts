import { interactionRepository } from './repository.js';
import { CreateInteractionInput, QueryInteractionsInput } from './schema.js';
import { preferencesRepository } from '../preferences/repository.js';

export class InteractionService {
  async recordInteraction(userId: string, input: CreateInteractionInput) {
    // SAVED is idempotent per dish: a repeat save returns the existing row
    // instead of duplicating it (CR-05).
    if (input.interactionType === 'SAVED' && input.dishId) {
      const existing = await interactionRepository.findSaved(userId, input.dishId);
      if (existing) return existing;
    }

    const interaction = await interactionRepository.create(userId, input);

    // Optional background inferred preference enrichment (non-blocking)
    if (input.interactionType === 'LIKE' || input.interactionType === 'SAVED') {
      try {
        const profile = await preferencesRepository.findByUserId(userId);
        const currentInferred = (profile?.inferredPreferences as Record<string, number>) || {};
        const key = input.dishId ? `dish:${input.dishId}` : input.restaurantId ? `restaurant:${input.restaurantId}` : null;

        if (key) {
          currentInferred[key] = (currentInferred[key] || 0) + 1;
          await preferencesRepository.upsert(userId, { inferredPreferences: currentInferred });
        }
      } catch {
        // Inferred preference failure should never break interaction logging
      }
    }

    return interaction;
  }

  async removeSavedInteraction(userId: string, dishId: string) {
    const removed = await interactionRepository.removeSaved(userId, dishId);
    return { removed };
  }

  async getUserInteractions(userId: string, params: QueryInteractionsInput) {
    return interactionRepository.findManyByUserId(userId, params);
  }
}

export const interactionService = new InteractionService();
