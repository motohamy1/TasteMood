/**
 * Chooses a representative food emoji for a dish or cuisine. Used as the
 * graceful placeholder behind dish photos while the catalog has no images —
 * the moment a real `imageUrl` is present the photo wins and this is unused.
 * Keyword matching runs over name/category/cuisine so it stays correct for
 * Arabic source names too (they still carry the same dish words).
 */

type EmojiSource = {
  name?: string | null;
  nameEn?: string | null;
  description?: string | null;
  category?: string | null;
  cuisine?: string | null;
};

const KEYWORDS: Array<[RegExp, string]> = [
  [/latte|coffee|espresso|cappuccino|americano|frapp|mocha|mashz|beverage|\bdrink\b/i, "☕"],
  [/tiramisu|cheesecake|cake|dessert|chocolate|brownie|croissant|pastry|muffin|bakery|cookie/i, "🍰"],
  [/burger|smash/i, "🍔"],
  [/pizza|pizza/i, "🍕"],
  [/pasta|spaghetti|fettuccine|penne|macaroni|linguine|lasagna|ravioli/i, "🍝"],
  [/shawarma|wrap|sandwich|\bsub\b|club\b/i, "🌯"],
  [/fried chicken|chicken|wing|tender/i, "🍗"],
  [/pigeon|hamam/i, "🍗"],
  [/koshary|koshari|molokhia|mulukhiyah|mahshi|stuffed|\brice\b|egyptian|ful\b/i, "🍲"],
  [/salad|veg|avocado|zucchini|grilled veg/i, "🥗"],
  [/seafood|fish|shrimp|prawn|sayad|samak|\btuna\b/i, "🦐"],
  [/curry|indian|biryani|masala|tandoori/i, "🍛"],
  [/taco|mexican|burrito|quesadilla|fajita|nachos/i, "🌮"],
  [/sushi|japan|ramen|noodle|chinese|chow mein/i, "🍜"],
  [/soup|broth/i, "🍜"],
  [/kebab|kabob|steak|grill|bbq|meat|kofta/i, "🍢"],
  [/breakfast|egg|falafel|taameya|omelet|foul/i, "🍳"],
  [/smoothie|juice|shake|milkshake/i, "🥤"],
];

const CUISINE: Record<string, string> = {
  italian: "🍝",
  american: "🍔",
  egyptian: "🍲",
  chinese: "🍜",
  indian: "🍛",
  mexican: "🌮",
  seafood: "🦐",
  pizza: "🍕",
  burgers: "🍔",
  "fast food": "🍔",
  "fried chicken": "🍗",
  "café & bakery": "🥐",
  "cafe & bakery": "🥐",
  "shawarma & sandwiches": "🌯",
  turkish: "🥙",
  spanish: "🥘",
};

export function foodEmoji(item: EmojiSource): string {
  const haystack = [
    item.name,
    item.nameEn,
    item.description,
    item.category,
    item.cuisine,
  ]
    .filter(Boolean)
    .join(" ");

  for (const [re, emoji] of KEYWORDS) {
    if (re.test(haystack)) return emoji;
  }

  const cuisine = (item.cuisine ?? "").trim().toLowerCase();
  return CUISINE[cuisine] ?? "🍽️";
}
