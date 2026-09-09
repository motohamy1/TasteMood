import { z } from 'zod';

const TASTE_ATTRIBUTES = ['SPICY', 'SWEET', 'SAVORY', 'SOUR', 'BITTER', 'CREAMY', 'RICH', 'REFRESHING'] as const;
const MEAL_CHARACTERISTICS = ['LIGHT', 'HEAVY', 'FILLING', 'SNACK', 'BREAKFAST', 'LUNCH', 'DINNER', 'DESSERT', 'BEVERAGE'] as const;
const DIETARY_PROPERTIES = ['VEGETARIAN', 'VEGAN', 'HALAL', 'GLUTEN_FREE', 'DAIRY_FREE', 'NUT_FREE', 'LOW_CARB'] as const;

export const DISH_CATEGORIES = [
  'main-courses',
  'grills',
  'burgers-sandwiches',
  'pasta-pizza',
  'appetizers',
  'desserts',
  'beverages',
  'salads-bowls',
] as const;

export const FOOD_TAGS = [
  'comfort-food',
  'budget-friendly',
  'late-night',
  'quick-bite',
  'indulgent',
  'healthy',
  'date-night',
  'specialty-coffee',
  'street-food',
] as const;

export const ATMOSPHERE_SLUGS = [
  'quiet',
  'casual',
  'study-friendly',
  'romantic',
  'outdoor-seating',
  'family-friendly',
  'vibrant',
] as const;

export const EnrichmentDishSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().min(1),
  description: z.string().min(1),
  descriptionEn: z.string().min(1),
  priceEstimateEGP: z.number().positive().max(3000),
  categorySlugs: z.array(z.enum(DISH_CATEGORIES)).min(1),
  tasteAttributes: z.array(z.enum(TASTE_ATTRIBUTES)).max(8).default([]),
  textures: z.array(z.string()).max(4).default([]),
  mealCharacteristics: z.array(z.enum(MEAL_CHARACTERISTICS)).max(6).default([]),
  dietaryProperties: z.array(z.enum(DIETARY_PROPERTIES)).max(7).default([]),
  foodTagSlugs: z.array(z.enum(FOOD_TAGS)).max(5).default([]),
  ingredients: z.array(z.string()).max(10).default([]),
});

export const EnrichmentDraftSchema = z.object({
  description: z.string().min(1),
  descriptionEn: z.string().min(1),
  cuisineSlugs: z.array(z.string()).min(1),
  priceRange: z.enum(['BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY']),
  atmosphereSlugs: z.array(z.enum(ATMOSPHERE_SLUGS)).max(4).default([]),
  dishes: z.array(EnrichmentDishSchema).min(3).max(12),
});

export type EnrichmentDraft = z.infer<typeof EnrichmentDraftSchema>;
export type EnrichmentDish = z.infer<typeof EnrichmentDishSchema>;

export interface EnrichmentInput {
  restaurantName: string;
  restaurantNameEn: string | null;
  cityAr: string;
  cityEn: string;
  governorateAr: string;
  mappedCuisineSlugs: string[];
  cuisineNames: Array<{ slug: string; name: string }>;
  priceTier: number | null;
  ingredientNames: string[];
  cuisineSlugList: Array<{ slug: string; name: string }>;
}

export function buildEnrichmentPrompt(input: EnrichmentInput): { system: string; user: string } {
  const system = [
    'You are a menu data specialist for an Egyptian food-discovery app.',
    'You draft realistic typical menus for Egyptian restaurants and cafés.',
    'Respond with valid JSON only, no markdown fences.',
  ].join(' ');

  const cuisineList = input.cuisineSlugList.map((c) => `${c.slug} (${c.name})`).join(', ');
  const categoryList = DISH_CATEGORIES.join(', ');
  const tagList = FOOD_TAGS.join(', ');
  const ingredientList = input.ingredientNames.join(', ');
  const priceHint = input.priceTier
    ? `Foursquare price tier ${input.priceTier} (1=budget … 4=luxury).`
    : 'Price tier unknown — infer from the place type.';

  const user = `Draft a typical menu for this place in ${input.cityEn} (${input.cityAr}), ${input.governorateAr} governorate, Egypt.

Place: "${input.restaurantName}"${input.restaurantNameEn ? ` (English: "${input.restaurantNameEn}")` : ''}
Currently mapped cuisines: ${input.mappedCuisineSlugs.join(', ') || 'unknown'}
${priceHint}

Rules:
- The menu must contain 5-9 items this kind of place in Egypt typically serves. For international chains, use their real, well-known Egypt menu items. For local places, use authentic local favorites.
- Prices are realistic 2025 Egyptian pounds for Dakahlia governorate (street/local spots 20-90 EGP, cafés 25-120 EGP, mid-range restaurants 80-350 EGP).
- Every dish needs an authentic Arabic name ("name") and a natural English name ("nameEn"), plus Arabic and English descriptions.
- All items are HALAL by default; add dietaryProperties only when clearly true.
- Pick cuisineSlugs ONLY from: ${cuisineList}
- Pick categorySlugs ONLY from: ${categoryList}
- Pick foodTagSlugs ONLY from: ${tagList}
- Pick ingredients ONLY from this list (may be empty): ${ingredientList}
- atmosphereSlugs from: ${ATMOSPHERE_SLUGS.join(', ')}
- tasteAttributes from: SPICY, SWEET, SAVORY, SOUR, BITTER, CREAMY, RICH, REFRESHING
- mealCharacteristics from: LIGHT, HEAVY, FILLING, SNACK, BREAKFAST, LUNCH, DINNER, DESSERT, BEVERAGE

JSON shape:
{
  "description": string (Arabic, one sentence about the place),
  "descriptionEn": string,
  "cuisineSlugs": string[],
  "priceRange": "BUDGET" | "MODERATE" | "EXPENSIVE" | "LUXURY",
  "atmosphereSlugs": string[],
  "dishes": [{
    "name": string, "nameEn": string,
    "description": string, "descriptionEn": string,
    "priceEstimateEGP": number,
    "categorySlugs": string[],
    "tasteAttributes": string[], "textures": string[],
    "mealCharacteristics": string[], "dietaryProperties": string[],
    "foodTagSlugs": string[], "ingredients": string[]
  }]
}`;

  return { system, user };
}
