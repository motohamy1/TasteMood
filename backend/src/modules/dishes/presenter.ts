/**
 * Dish presenter — maps raw Prisma dish rows (with the includes from the
 * dishes repository) into the flat DTO the mobile client consumes.
 * Fixes the nested-shape drift documented in REVIEW-mobile-vs-backend.md CR-02.
 */

interface DishLike {
  id: string;
  name: string;
  nameEn?: string | null;
  slug: string;
  description: string | null;
  descriptionEn?: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  status: string;
  verificationStatus: string;
  menuId: string;
  attributes?: {
    tasteAttributes: string[];
    mealCharacteristics: string[];
    dietaryProperties: string[];
  } | null;
  categories?: { category: { name: string } }[];
  tags?: { tag: { name: string } }[];
  ingredients?: { ingredient: { name: string } }[];
  menu?: {
    restaurantId: string;
    restaurant?: {
      id: string;
      name: string;
      nameEn?: string | null;
      cuisines?: { cuisine: { name: string } }[];
      branches?: { id: string; name: string }[];
    } | null;
  } | null;
}

export interface DishDTO {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  description: string | null;
  descriptionEn: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  status: string;
  verificationStatus: string;
  restaurantId: string;
  restaurantName: string;
  restaurantNameEn: string | null;
  branchId?: string;
  branchName?: string;
  menuId: string;
  category: string;
  cuisine: string;
  tasteAttributes: string[];
  mealCharacteristics: string[];
  dietaryProperties: string[];
  tags: string[];
  ingredients: string[];
}

export function presentDish(dish: DishLike): DishDTO {
  const restaurant = dish.menu?.restaurant;
  const firstBranch = restaurant?.branches?.[0];

  return {
    id: dish.id,
    name: dish.name,
    nameEn: dish.nameEn ?? null,
    slug: dish.slug,
    description: dish.description,
    descriptionEn: dish.descriptionEn ?? null,
    price: dish.price,
    currency: dish.currency,
    imageUrl: dish.imageUrl,
    status: dish.status,
    verificationStatus: dish.verificationStatus,
    restaurantId: restaurant?.id ?? dish.menu?.restaurantId ?? '',
    restaurantName: restaurant?.name ?? '',
    restaurantNameEn: restaurant?.nameEn ?? null,
    branchId: firstBranch?.id,
    branchName: firstBranch?.name,
    menuId: dish.menuId,
    category: dish.categories?.[0]?.category.name ?? '',
    cuisine: restaurant?.cuisines?.[0]?.cuisine.name ?? '',
    tasteAttributes: dish.attributes?.tasteAttributes ?? [],
    mealCharacteristics: dish.attributes?.mealCharacteristics ?? [],
    dietaryProperties: dish.attributes?.dietaryProperties ?? [],
    tags: dish.tags?.map((t) => t.tag.name) ?? [],
    ingredients: dish.ingredients?.map((i) => i.ingredient.name) ?? [],
  };
}

export function presentDishList(dishes: DishLike[]): DishDTO[] {
  return dishes.map(presentDish);
}
