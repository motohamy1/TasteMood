/**
 * Curated cuisine taxonomy + tag mapping for the place importer.
 *
 * Places come in with raw source tags (OSM `cuisine=*`, Overture category
 * strings, Foursquare category names). Everything is mapped onto this
 * canonical list; unknown tags fall back to `other`.
 */

export interface CuisineSeed {
  slug: string;
  name: string;
  nameAr: string;
  description: string;
}

export const CUISINES: CuisineSeed[] = [
  { slug: 'egyptian', name: 'Egyptian', nameAr: 'مصري', description: 'Traditional and modern authentic Egyptian cuisine' },
  { slug: 'oriental-grills', name: 'Oriental Grills', nameAr: 'مشويات شرقية', description: 'Kebab, kofta, and charcoal grills' },
  { slug: 'koshary', name: 'Koshary', nameAr: 'كشري', description: 'Egyptian rice, lentils, and pasta bowls' },
  { slug: 'foul-falafel', name: 'Foul & Falafel', nameAr: 'فول وفلافل', description: 'Fava bean and falafel breakfast spots' },
  { slug: 'shawarma', name: 'Shawarma & Sandwiches', nameAr: 'شاورما وساندويتشات', description: 'Shawarma and stuffed sandwiches' },
  { slug: 'burgers', name: 'Burgers', nameAr: 'برجر', description: 'Beef and chicken burger joints' },
  { slug: 'fast-food', name: 'Fast Food', nameAr: 'وجبات سريعة', description: 'Quick-service meals and combos' },
  { slug: 'fried-chicken', name: 'Fried Chicken', nameAr: 'دجاج مقلي', description: 'Crispy fried and broasted chicken' },
  { slug: 'pizza', name: 'Pizza', nameAr: 'بيتزا', description: 'Pizzerias and wood-fired ovens' },
  { slug: 'italian', name: 'Italian', nameAr: 'إيطالي', description: 'Handcrafted pasta, woodfired pizza, and risottos' },
  { slug: 'asian', name: 'Asian', nameAr: 'آسيوي', description: 'Pan-Asian wok noodles, sushi, and dumplings' },
  { slug: 'chinese', name: 'Chinese', nameAr: 'صيني', description: 'Chinese stir-fries, noodles, and rice' },
  { slug: 'indian', name: 'Indian', nameAr: 'هندي', description: 'Curries, tandoor, and biryani' },
  { slug: 'mexican', name: 'Mexican', nameAr: 'مكسيكي', description: 'Tacos, burritos, and nachos' },
  { slug: 'levantine', name: 'Levantine', nameAr: 'شامي', description: 'Levantine mezze, shawarma, and grills' },
  { slug: 'seafood', name: 'Seafood', nameAr: 'مأكولات بحرية', description: 'Fish, shrimp, and shellfish' },
  { slug: 'cafe-bakery', name: 'Café & Bakery', nameAr: 'كافيه ومخبوزات', description: 'Specialty coffee, artisanal pastries, and light bites' },
  { slug: 'juice', name: 'Juices & Drinks', nameAr: 'عصائر ومشروبات', description: 'Fresh juices, sugarcane, and drinks' },
  { slug: 'healthy', name: 'Healthy & Salads', nameAr: 'صحي وسلطات', description: 'Bowls, salads, and clean eating' },
  { slug: 'street-food', name: 'Street Food & Crepes', nameAr: 'أكل شوارع', description: 'Crepes, street sandwiches, and snacks' },
  { slug: 'other', name: 'Other', nameAr: 'أخرى', description: 'Everything that does not fit a category yet' },
];

export const CUISINE_BY_SLUG = new Map(CUISINES.map((c) => [c.slug, c]));

/** Fallback when a place has no cuisine info at all: what remains after every tag map misses. */
export const DEFAULT_CUISINE_SLUG = 'other';

/**
 * OSM `cuisine=*` tag → canonical slug. Keys are lowercase OSM values;
 * multiple tags are separated by `;` or `,` in source data and each part is
 * looked up independently.
 */
export const OSM_CUISINE_MAP: Record<string, string> = {
  egyptian: 'egyptian',
  regional: 'egyptian',
  kebab: 'oriental-grills',
  grill: 'oriental-grills',
  shish_kebab: 'oriental-grills',
  kofta: 'oriental-grills',
  koshary: 'koshary',
  kushari: 'koshary',
  foul: 'foul-falafel',
  falafel: 'foul-falafel',
  fava: 'foul-falafel',
  shawarma: 'shawarma',
  sandwich: 'shawarma',
  burger: 'burgers',
  hot_dog: 'fast-food',
  fries: 'fast-food',
  chicken: 'fried-chicken',
  fried_chicken: 'fried-chicken',
  broasted: 'fried-chicken',
  pizza: 'pizza',
  italian: 'italian',
  pasta: 'italian',
  sushi: 'asian',
  asian: 'asian',
  thai: 'asian',
  noodle: 'asian',
  ramen: 'asian',
  chinese: 'chinese',
  indian: 'indian',
  curry: 'indian',
  mexican: 'mexican',
  lebanese: 'levantine',
  syrian: 'levantine',
  arabic: 'levantine',
  middle_eastern: 'levantine',
  turkish: 'levantine',
  seafood: 'seafood',
  fish: 'seafood',
  shrimp: 'seafood',
  coffee_shop: 'cafe-bakery',
  donut: 'cafe-bakery',
  pastry: 'cafe-bakery',
  waffle: 'cafe-bakery',
  ice_cream: 'cafe-bakery',
  juice: 'juice',
  tea: 'juice',
  smoothie: 'juice',
  salad: 'healthy',
  vegan: 'healthy',
  vegetarian: 'healthy',
  crepe: 'street-food',
  pancake: 'street-food',
  american: 'american',
  international: 'other',
};

/**
 * OSM `amenity=*` (or `shop=*`) fallback → canonical slug, used when the
 * place carries no cuisine tag. A tag-less restaurant in Egypt is assumed
 * to serve Egyptian food.
 */
export const OSM_AMENITY_MAP: Record<string, string> = {
  restaurant: 'egyptian',
  cafe: 'cafe-bakery',
  fast_food: 'fast-food',
  ice_cream: 'cafe-bakery',
  food_court: 'other',
  bar: 'other',
  pub: 'other',
  bakery: 'cafe-bakery',
  pastry: 'cafe-bakery',
  coffee: 'cafe-bakery',
  confectionery: 'cafe-bakery',
  deli: 'other',
};

/** Keyword map for Overture category strings (e.g. "pizza_restaurant", "coffee_shop"). */
export const OVERTURE_CATEGORY_MAP: Array<[RegExp, string]> = [
  [/coffee|espresso/, 'cafe-bakery'],
  [/ice[_ ]?cream/, 'cafe-bakery'],
  [/bakery|pastry|dessert|donut/, 'cafe-bakery'],
  [/pizza/, 'pizza'],
  [/burger/, 'burgers'],
  [/shawarma|sandwich/, 'shawarma'],
  [/kebab|grill/, 'oriental-grills'],
  [/koshary/, 'koshary'],
  [/falafel|foul/, 'foul-falafel'],
  [/fried[_ ]?chicken|broast/, 'fried-chicken'],
  [/seafood|fish/, 'seafood'],
  [/chinese/, 'chinese'],
  [/sushi|asian|thai|japanese/, 'asian'],
  [/indian|curry/, 'indian'],
  [/mexican|taco/, 'mexican'],
  [/lebanese|levant|syrian|turkish/, 'levantine'],
  [/italian|pasta/, 'italian'],
  [/juice|beverage/, 'juice'],
  [/salad|healthy|vegan/, 'healthy'],
  [/fast[_ ]?food/, 'fast-food'],
  [/crepe/, 'street-food'],
  [/restaurant|dining|eatery/, 'egyptian'],
];

/** Keyword map for Foursquare category names (e.g. "Coffee Shop", "Burger Joint"). */
export const FOURSQUARE_CATEGORY_MAP: Array<[RegExp, string]> = OVERTURE_CATEGORY_MAP;

export type PlaceKind =
  | 'restaurant'
  | 'cafe'
  | 'fast_food'
  | 'ice_cream'
  | 'bakery'
  | 'bar'
  | 'food_court'
  | 'other';

/** Bilingual label used to synthesize names for places that have none. */
export const PLACE_KIND_LABELS: Record<PlaceKind, { ar: string; en: string }> = {
  restaurant: { ar: 'مطعم', en: 'Restaurant' },
  cafe: { ar: 'مقهى', en: 'Café' },
  fast_food: { ar: 'مطعم وجبات سريعة', en: 'Fast Food' },
  ice_cream: { ar: 'آيس كريم', en: 'Ice Cream' },
  bakery: { ar: 'مخبز', en: 'Bakery' },
  bar: { ar: 'كافيه', en: 'Café' },
  food_court: { ar: 'فود كورت', en: 'Food Court' },
  other: { ar: 'مطعم', en: 'Restaurant' },
};
