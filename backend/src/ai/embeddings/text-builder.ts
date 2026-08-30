export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

export function buildDishEmbeddingText(dish: {
  name: string;
  description?: string | null;
  cuisineName?: string;
  tasteAttributes?: string[];
  mealCharacteristics?: string[];
  dietaryProperties?: string[];
  tags?: string[];
  ingredients?: string[];
}): string {
  const parts: string[] = [
    `Dish: ${dish.name}`,
    dish.description ? `Description: ${dish.description}` : '',
    dish.cuisineName ? `Cuisine: ${dish.cuisineName}` : '',
    dish.tasteAttributes && dish.tasteAttributes.length > 0
      ? `Taste: ${dish.tasteAttributes.join(', ')}`
      : '',
    dish.mealCharacteristics && dish.mealCharacteristics.length > 0
      ? `Meal Characteristics: ${dish.mealCharacteristics.join(', ')}`
      : '',
    dish.dietaryProperties && dish.dietaryProperties.length > 0
      ? `Dietary: ${dish.dietaryProperties.join(', ')}`
      : '',
    dish.tags && dish.tags.length > 0 ? `Tags: ${dish.tags.join(', ')}` : '',
    dish.ingredients && dish.ingredients.length > 0
      ? `Ingredients: ${dish.ingredients.join(', ')}`
      : '',
  ];

  return parts.filter(Boolean).join('. ');
}
