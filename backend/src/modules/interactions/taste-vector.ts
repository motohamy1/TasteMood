import { dishRepository } from '../dishes/repository.js';
import { z } from 'zod';
import { CreateInteractionInput } from './schema.js';

export type TasteVector = {
  cuisine: Record<string, number>;
  tasteAttribute: Record<string, number>;
  mealCharacteristic: Record<string, number>;
};

// Explicit feedback updates learned taste vectors. Views and other behavior
// signals are intentionally absent from this map.
const DELTA_BY_INTERACTION_TYPE: Partial<Record<CreateInteractionInput['interactionType'], number>> = {
  LIKE: 1,
  SAVED: 1,
  DISLIKE: -1,
};

type EnrichedDish = {
  attributes?: { tasteAttributes?: string[]; mealCharacteristics?: string[] } | null;
  menu?: { restaurant?: { cuisines?: { cuisine?: { name?: string } }[] } } | null;
};

const CONTEXT_FACTORS = ['weather', 'mealSlot', 'mood'] as const;

const NumberCountersSchema = z.record(z.number());
const TasteVectorInputSchema = z
  .object({
    cuisine: z.unknown().optional(),
    tasteAttribute: z.unknown().optional(),
    mealCharacteristic: z.unknown().optional(),
  })
  .passthrough();
const ContextTasteVectorSchema = z.record(z.record(z.unknown()));

function counterRecord(value: unknown): Record<string, number> {
  const parsed = NumberCountersSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function readTasteVector(value: unknown): TasteVector {
  const parsed = TasteVectorInputSchema.safeParse(value);
  const vector = parsed.success ? parsed.data : {};
  return {
    cuisine: counterRecord(vector.cuisine),
    tasteAttribute: counterRecord(vector.tasteAttribute),
    mealCharacteristic: counterRecord(vector.mealCharacteristic),
  };
}

function applyDishDelta(vector: TasteVector, dish: EnrichedDish, delta: number): TasteVector {
  const cuisine = { ...vector.cuisine };
  const tasteAttribute = { ...vector.tasteAttribute };
  const mealCharacteristic = { ...vector.mealCharacteristic };

  for (const restaurantCuisine of dish.menu?.restaurant?.cuisines ?? []) {
    const name = restaurantCuisine.cuisine?.name;
    if (name) cuisine[name] = (cuisine[name] ?? 0) + delta;
  }
  for (const attribute of dish.attributes?.tasteAttributes ?? []) {
    tasteAttribute[attribute] = (tasteAttribute[attribute] ?? 0) + delta;
  }
  for (const characteristic of dish.attributes?.mealCharacteristics ?? []) {
    mealCharacteristic[characteristic] = (mealCharacteristic[characteristic] ?? 0) + delta;
  }

  return { cuisine, tasteAttribute, mealCharacteristic };
}

/**
 * Mutates `preferences` in place: updates the global taste vector and each
 * active weather, meal-slot, and mood vector in inferredPreferences. Existing
 * unrelated preference keys remain untouched.
 */
export async function applyTasteVector(
  userId: string,
  input: CreateInteractionInput,
  preferences: Record<string, unknown>,
): Promise<void> {
  const delta = DELTA_BY_INTERACTION_TYPE[input.interactionType];
  if (!delta || !input.dishId) return;

  const dish = (await dishRepository.findById(input.dishId)) as unknown as EnrichedDish | null;
  if (!dish) return;

  preferences.tasteVector = applyDishDelta(readTasteVector(preferences.tasteVector), dish, delta);

  if (!input.personalityContext) return;
  const existingContexts = ContextTasteVectorSchema.safeParse(preferences.contextTasteVector);
  const contextTasteVector = existingContexts.success ? { ...existingContexts.data } : {};
  let hasContextFactor = false;

  for (const factor of CONTEXT_FACTORS) {
    const value = input.personalityContext[factor];
    if (!value) continue;

    hasContextFactor = true;
    const existingValues = contextTasteVector[factor] ?? {};
    const nextValues = { ...existingValues };
    nextValues[value] = applyDishDelta(readTasteVector(existingValues[value]), dish, delta);
    contextTasteVector[factor] = nextValues;
  }

  if (hasContextFactor) preferences.contextTasteVector = contextTasteVector;
}
