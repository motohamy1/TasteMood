import { z } from 'zod';

export const TasteAttributeEnum = z.enum([
  'SPICY',
  'SWEET',
  'SAVORY',
  'SOUR',
  'BITTER',
  'CREAMY',
  'RICH',
  'REFRESHING',
]);

export const MealCharacteristicEnum = z.enum([
  'LIGHT',
  'HEAVY',
  'FILLING',
  'SNACK',
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'DESSERT',
  'BEVERAGE',
]);

export const DietaryPropertyEnum = z.enum([
  'VEGETARIAN',
  'VEGAN',
  'HALAL',
  'GLUTEN_FREE',
  'DAIRY_FREE',
  'NUT_FREE',
  'LOW_CARB',
]);

export const CreateDishSchema = z.object({
  menuId: z.string().uuid(),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().default('EGP'),
  imageUrl: z.string().url().optional(),
  categoryIds: z.array(z.string()).default([]),
  foodTagIds: z.array(z.string()).default([]),
  ingredientIds: z.array(z.string()).default([]),
  tasteAttributes: z.array(TasteAttributeEnum).default([]),
  textures: z.array(z.string()).default([]),
  mealCharacteristics: z.array(MealCharacteristicEnum).default([]),
  dietaryProperties: z.array(DietaryPropertyEnum).default([]),
  source: z.string().default('MANUAL'),
});

export const UpdateDishSchema = CreateDishSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']).optional(),
});

export const QueryDishSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  menuId: z.string().uuid().optional(),
  restaurantId: z.string().uuid().optional(),
  categoryId: z.string().optional(),
  cuisine: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  search: z.string().optional(),
  tasteAttribute: TasteAttributeEnum.optional(),
  mealCharacteristic: MealCharacteristicEnum.optional(),
  dietaryProperty: DietaryPropertyEnum.optional(),
  tag: z.string().optional(),
});

export type CreateDishInput = z.infer<typeof CreateDishSchema>;
export type UpdateDishInput = z.infer<typeof UpdateDishSchema>;
export type QueryDishInput = z.infer<typeof QueryDishSchema>;
