import { dishRepository } from '../dishes/repository.js';
import { CreateInteractionInput } from './schema.js';

export type TasteVector = {
  cuisine: Record<string, number>;
  tasteAttribute: Record<string, number>;
  mealCharacteristic: Record<string, number>;
};

// Taste-vector-relevant interaction types keyed by their net delta:
// LIKE / SAVED increment (+1), DISLIKE decrements (-1). VIEW/CLICK/SHARED and
// other non-taste types have no entry and are ignored by the write-back.
const DELTA_BY_INTERACTION_TYPE: Partial<Record<CreateInteractionInput['interactionType'], number>> = {
  LIKE: 1,
  SAVED: 1,
  DISLIKE: -1,
};

type EnrichedDish = {
  attributes?: { tasteAttributes?: string[]; mealCharacteristics?: string[] } | null;
  menu?: { restaurant?: { cuisines?: { cuisine?: { name?: string } }[] } } | null;
};

function emptyTasteVector(): TasteVector {
  return { cuisine: {}, tasteAttribute: {}, mealCharacteristic: {} };
}

/**
 * Mutates `preferences` in place: merges the dish's cuisine / taste-attribute /
 * meal-characteristic net counters into the structured `tasteVector` inside
 * inferredPreferences. `preferences` is the profile's inferredPreferences JSON
 * (already loaded by the caller). Existing keys — including the legacy flat
 * `dish:<id>` counters — are left untouched except the vector dimensions.
 * DISLIKE decrements; nothing is ever removed or filtered.
 */
export async function applyTasteVector(
  userId: string,
  input: CreateInteractionInput,
  preferences: Record<string, unknown>,
): Promise<void> {
  const delta = DELTA_BY_INTERACTION_TYPE[input.interactionType];
  // 0-falsy guard also covers PICKED and any new interaction type: no delta
  // specified for them yet means no vector write.
  if (!delta || !input.dishId) return;

  // One dish fetch per interaction carries attributes + menu -> restaurant ->
  // cuisines via dishDetailInclude. Without dishId there is nothing to derive.
  const dish = (await dishRepository.findById(input.dishId)) as unknown as EnrichedDish | null;
  if (!dish) return;

  const existing = preferences.tasteVector;
  const hasExistingVector =
    typeof existing === 'object' && existing !== null && typeof (existing as TasteVector).cuisine === 'object';

  const vector = hasExistingVector ? (existing as TasteVector) : emptyTasteVector();
  const cuisine = { ...vector.cuisine };
  const tasteAttribute = { ...vector.tasteAttribute };
  const mealCharacteristic = { ...vector.mealCharacteristic };

  for (const rc of dish.menu?.restaurant?.cuisines ?? []) {
    const name = rc.cuisine?.name;
    if (name) cuisine[name] = (cuisine[name] ?? 0) + delta;
  }
  for (const attr of dish.attributes?.tasteAttributes ?? []) {
    tasteAttribute[attr] = (tasteAttribute[attr] ?? 0) + delta;
  }
  for (const attr of dish.attributes?.mealCharacteristics ?? []) {
    mealCharacteristic[attr] = (mealCharacteristic[attr] ?? 0) + delta;
  }

  preferences.tasteVector = { cuisine, tasteAttribute, mealCharacteristic };
}
