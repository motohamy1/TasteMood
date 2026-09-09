import { namesMatch, normalizeNameKey } from './normalize.js';
import type { NormalizedPlace, PlaceGroup } from './types.js';

/**
 * Cluster normalized places into brand groups (Restaurant + Branch[]).
 *
 * A place joins an existing group when its primary or English name matches
 * any name already collected for that group (exact, containment, or fuzzy).
 * Unnamed places are synthesized *before* grouping, so every place entering
 * here has a name.
 */
export function groupPlaces(places: NormalizedPlace[]): PlaceGroup[] {
  const groups: Array<PlaceGroup & { keys: string[] }> = [];

  for (const place of places) {
    const names = [place.name, place.nameEn].filter((n): n is string => Boolean(n));
    if (names.length === 0) continue;

    let matched: (PlaceGroup & { keys: string[] }) | undefined;
    for (const group of groups) {
      if (names.some((name) => group.keys.some((key) => namesMatch(key, name)))) {
        matched = group;
        break;
      }
    }

    if (matched) {
      matched.places.push(place);
      for (const name of names) {
        const key = normalizeNameKey(name);
        if (!matched.keys.includes(key)) matched.keys.push(key);
      }
    } else {
      groups.push({
        key: normalizeNameKey(names[0]),
        keys: names.map((n) => normalizeNameKey(n)),
        places: [place],
      });
    }
  }

  return groups.map(({ key, places: groupPlaces }) => ({ key, places: groupPlaces }));
}
