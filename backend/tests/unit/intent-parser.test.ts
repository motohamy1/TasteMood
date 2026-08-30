import { describe, it, expect } from 'vitest';
import { intentService } from '../../src/ai/intent/intent.service.js';

describe('AI Intent Parser & Fallback Extraction', () => {
  it('extracts spicy taste and price budget from natural language', async () => {
    const query = 'I want something spicy and filling under 200 EGP';
    const intent = await intentService.extractIntent(query);

    expect(intent.tasteAttributes).toContain('SPICY');
    expect(intent.mealTypes).toContain('FILLING');
    expect(intent.maxPrice).toBe(200);
    expect(intent.surpriseMe).toBe(false);
  });

  it('detects surprise me intent', async () => {
    const query = 'Surprise me with dinner tonight';
    const intent = await intentService.extractIntent(query);

    expect(intent.surpriseMe).toBe(true);
    expect(intent.mealTypes).toContain('DINNER');
  });

  it('extracts dietary restrictions and atmosphere preferences', async () => {
    const query = 'I want a quiet vegetarian café with iced coffee';
    const intent = await intentService.extractIntent(query);

    expect(intent.dietaryRestrictions).toContain('VEGETARIAN');
    expect(intent.atmosphere).toContain('quiet');
    expect(intent.mealTypes).toContain('BEVERAGE');
  });

  it('extracts excluded ingredients', async () => {
    const query = 'I want chicken pasta without mushrooms';
    const intent = await intentService.extractIntent(query);

    expect(intent.excludedIngredients).toContain('mushrooms');
  });
});
