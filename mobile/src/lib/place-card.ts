/**
 * Place-card helpers. Pure functions plus one hook, kept out of the component
 * so the browse screen and any future place surface label places identically.
 *
 * The governing rule: a place is identified by WHAT IT IS and WHERE IT IS.
 * Rating is optional decoration that most of the catalogue does not have, so it
 * must never decide layout, prominence, or whether a place is shown.
 */

import type { Lang, TranslationKey } from "@/i18n/dictionaries";
import { displayName, pickLabel, useLang, useT } from "@/i18n";
import type { PlaceKind, RestaurantCardItem } from "@/types/restaurant";

/** The kinds the importer writes. Anything else is treated as unclassified. */
export const PLACE_KINDS: PlaceKind[] = [
  "restaurant",
  "cafe",
  "fast_food",
  "bakery",
  "ice_cream",
  "bar",
  "food_court",
];

/** True when `value` is one of the kinds the API can report. */
export function isPlaceKind(value: string | null | undefined): value is PlaceKind {
  return !!value && (PLACE_KINDS as string[]).includes(value);
}

/**
 * Bilingual kind label, or `null` when the kind is missing or unrecognised so
 * the caller renders nothing rather than leaking a raw slug like "fast_food".
 */
export function placeKindLabel(
  kind: PlaceKind | string | null | undefined,
  lang: Lang
): string | null {
  if (!isPlaceKind(kind)) return null;
  const dictionary = KIND_LABELS[lang];
  return dictionary[kind];
}

/**
 * Bilingual labels kept here rather than in the i18n dictionaries because they
 * are data-derived vocabulary: a kind label must exist wherever a kind can
 * appear, and the API may report a kind the UI has never seen.
 */
const KIND_LABELS: Record<Lang, Record<PlaceKind, string>> = {
  en: {
    restaurant: "Restaurant",
    cafe: "Coffee shop",
    fast_food: "Fast food",
    bakery: "Bakery",
    ice_cream: "Ice cream",
    bar: "Cafe & lounge",
    food_court: "Food court",
  },
  ar: {
    restaurant: "مطعم",
    cafe: "كافيه",
    fast_food: "أكل سريع",
    bakery: "مخبز",
    ice_cream: "آيس كريم",
    bar: "مقهى",
    food_court: "فود كورت",
  },
};

/** Translation keys for the i18n dictionaries, for screens that use `useT`. */
export function placeKindTranslationKey(kind: PlaceKind | string | null | undefined) {
  return isPlaceKind(kind) ? (`kind.${kind}` as TranslationKey) : null;
}

/**
 * Glyph shown when a place has no photo. Chosen per kind so a list of places
 * without photos still reads as a mix of coffee shops and restaurants rather
 * than a wall of identical placeholders.
 */
export function placeKindGlyph(kind: PlaceKind | string | null | undefined): string {
  switch (kind) {
    case "cafe":
      return "☕";
    case "bakery":
      return "🥐";
    case "ice_cream":
      return "🍦";
    case "fast_food":
      return "🍔";
    case "bar":
      return "🥂";
    case "food_court":
      return "🍱";
    default:
      return "🍽";
  }
}

/**
 * The single descriptor line on a card: kind first, then cuisines.
 *
 * One line always, whatever the data, so every card is the same height whether
 * or not the place carries a rating.
 */
export function describePlace(
  item: RestaurantCardItem,
  lang: Lang,
  kindLabel: string | null
): string | null {
  const cuisines = item.cuisines
    .slice(0, 2)
    .map((cuisine) => pickLabel(lang, cuisine.name, cuisine.nameAr ?? undefined))
    .filter(Boolean);

  const parts = [kindLabel, ...cuisines].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The rating string, or `null`.
 *
 * Returning `null` for "no rating" (rather than "—", "0.0" or an empty string)
 * is what lets every caller skip the element entirely and keep the card
 * identical to a rated one.
 */
export function formatPlaceRating(
  rating: number | null | undefined,
  reviewsCount: number | null | undefined
): string | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const base = rating.toFixed(1);
  if (typeof reviewsCount === "number" && reviewsCount > 0) {
    return `${base} (${reviewsCount})`;
  }
  return base;
}

/** Everything a place card needs, in one call. */
export function usePlaceCardText(item: RestaurantCardItem) {
  const lang = useLang();
  const kindLabel = placeKindLabel(item.placeKind, lang);
  return {
    lang,
    name: displayName(lang, item),
    glyph: placeKindGlyph(item.placeKind),
    descriptor: describePlace(item, lang, kindLabel),
    rating: formatPlaceRating(item.rating, item.reviewsCount),
  };
}