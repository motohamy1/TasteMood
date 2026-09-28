import { interactionRepository } from './repository.js';
import { CreateInteractionInput, QueryInteractionsInput } from './schema.js';
import { preferencesRepository } from '../preferences/repository.js';
import { applyTasteVector } from './taste-vector.js';

const VECTOR_INTERACTION_TYPES = ['LIKE', 'SAVED', 'DISLIKE', 'PICKED'];

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
    if (VECTOR_INTERACTION_TYPES.includes(input.interactionType)) {
      try {
        const profile = await preferencesRepository.findByUserId(userId);
        const currentInferred = (profile?.inferredPreferences as Record<string, unknown>) || {};

        // Legacy flat dish / restaurant counters — kept additively alongside
        // the structured taste vector (scenario 3).
        const key = input.dishId ? `dish:${input.dishId}` : input.restaurantId ? `restaurant:${input.restaurantId}` : null;

        // DISLIKE decrements; only non-zero deltas keep the key.
        const legacyDelta = input.interactionType === 'DISLIKE' ? -1 : 1;
        if (key) {
          const next = (typeof currentInferred[key] === 'number' ? currentInferred[key] : 0) + legacyDelta;
          if (next === 0) delete currentInferred[key];
          else currentInferred[key] = next;
        }

        // Structured net counters per cuisine / taste attribute / meal characteristic.
        await applyTasteVector(userId, input, currentInferred);

        await preferencesRepository.upsert(userId, { inferredPreferences: currentInferred });
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
