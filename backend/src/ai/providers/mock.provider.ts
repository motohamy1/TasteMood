import { AIProvider, RecommendationFact, UserContext } from './ai-provider.interface.js';
import { StructuredIntent, StructuredIntentSchema } from '../intent/intent.schema.js';

export class MockAIProvider implements AIProvider {
  public readonly name = 'MockAIProvider';

  async extractIntent(rawQuery: string, userContext?: UserContext): Promise<StructuredIntent> {
    const query = rawQuery.toLowerCase();
    const intent: Partial<StructuredIntent> = {
      rawQuery,
      mealTypes: [],
      preferredCuisines: [],
      dislikedCuisines: userContext?.dislikedCuisines || [],
      preferredTags: [],
      tasteAttributes: [],
      dietaryRestrictions: (userContext?.dietaryRestrictions as any) || [],
      atmosphere: [],
      excludedIngredients: [],
      surpriseMe: query.includes('surprise') || query.includes('anything') || query.includes('random'),
    };

    // Price extraction: e.g. "under 250", "200 egp", "budget 150", "100-200"
    const priceMatch = query.match(/(?:under|less than|max|budget|within|up to)?\s*(\d+)\s*(?:egp|le|pounds)?/);
    if (priceMatch && priceMatch[1]) {
      const parsed = parseInt(priceMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 10000) {
        intent.maxPrice = parsed;
      }
    }

    // Taste attributes
    if (query.includes('spicy') || query.includes('hot')) intent.tasteAttributes!.push('SPICY');
    if (query.includes('sweet') || query.includes('sugar')) intent.tasteAttributes!.push('SWEET');
    if (query.includes('savory') || query.includes('salty')) intent.tasteAttributes!.push('SAVORY');
    if (query.includes('creamy')) intent.tasteAttributes!.push('CREAMY');
    if (query.includes('rich')) intent.tasteAttributes!.push('RICH');
    if (query.includes('refreshing')) intent.tasteAttributes!.push('REFRESHING');
    if (query.includes('sour')) intent.tasteAttributes!.push('SOUR');

    // Meal types & characteristics
    if (query.includes('light')) intent.mealTypes!.push('LIGHT');
    if (query.includes('heavy')) intent.mealTypes!.push('HEAVY');
    if (query.includes('filling')) intent.mealTypes!.push('FILLING');
    if (query.includes('snack') || query.includes('quick bite')) intent.mealTypes!.push('SNACK');
    if (query.includes('breakfast') || query.includes('morning')) intent.mealTypes!.push('BREAKFAST');
    if (query.includes('lunch')) intent.mealTypes!.push('LUNCH');
    if (query.includes('dinner') || query.includes('tonight')) intent.mealTypes!.push('DINNER');
    if (query.includes('dessert') || query.includes('sweet after dinner')) intent.mealTypes!.push('DESSERT');
    if (query.includes('drink') || query.includes('coffee') || query.includes('beverage')) intent.mealTypes!.push('BEVERAGE');

    // Dietary
    if (query.includes('vegetarian')) intent.dietaryRestrictions!.push('VEGETARIAN');
    if (query.includes('vegan')) intent.dietaryRestrictions!.push('VEGAN');
    if (query.includes('halal')) intent.dietaryRestrictions!.push('HALAL');
    if (query.includes('gluten-free') || query.includes('gluten free')) intent.dietaryRestrictions!.push('GLUTEN_FREE');
    if (query.includes('dairy-free') || query.includes('dairy free')) intent.dietaryRestrictions!.push('DAIRY_FREE');

    // Cuisines
    const knownCuisines = ['egyptian', 'italian', 'american', 'asian', 'mexican', 'indian', 'japanese', 'middle eastern'];
    for (const c of knownCuisines) {
      if (query.includes(c)) {
        intent.preferredCuisines!.push(c.charAt(0).toUpperCase() + c.slice(1));
      }
    }

    // Atmosphere
    if (query.includes('quiet')) intent.atmosphere!.push('quiet');
    if (query.includes('casual')) intent.atmosphere!.push('casual');
    if (query.includes('romantic') || query.includes('date')) intent.atmosphere!.push('romantic');
    if (query.includes('study') || query.includes('work')) intent.atmosphere!.push('study-friendly');
    if (query.includes('outdoor') || query.includes('patio')) intent.atmosphere!.push('outdoor-seating');

    // Excluded ingredients: "no X", "without X", "not fried"
    const noMatch = query.match(/(?:no|without|not)\s+([a-zA-Z]+)/g);
    if (noMatch) {
      for (const m of noMatch) {
        const item = m.replace(/^(no|without|not)\s+/, '').trim();
        if (item && item.length > 2) intent.excludedIngredients!.push(item);
      }
    }

    // Location coordinates from user context if available
    if (userContext?.latitude && userContext?.longitude) {
      intent.location = {
        latitude: userContext.latitude,
        longitude: userContext.longitude,
        radiusKm: 10,
      };
    }

    return StructuredIntentSchema.parse(intent);
  }

  async generateExplanation(_query: string, facts: RecommendationFact[]): Promise<string[]> {
    return facts.map((fact) => {
      const parts: string[] = [];
      if (fact.distanceKm !== undefined) {
        const distanceStr = fact.distanceKm < 1 ? `${Math.round(fact.distanceKm * 1000)}m` : `${fact.distanceKm.toFixed(1)} km`;
        parts.push(`located ${distanceStr} away at ${fact.restaurantName} (${fact.branchName})`);
      } else {
        parts.push(`from ${fact.restaurantName}`);
      }

      parts.push(`priced at ${fact.price} ${fact.currency}`);

      if (fact.tasteAttributes.length > 0) {
        parts.push(`offering a ${fact.tasteAttributes.join(', ').toLowerCase()} taste`);
      }

      return `Recommended ${fact.dishName} ${parts.join(', ')}.`;
    });
  }
}
