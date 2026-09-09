import { prisma } from '../../database/prisma.client.js';
import { CreateDishInput, QueryDishInput, UpdateDishInput } from './schema.js';
import { Prisma } from '@prisma/client';
import {
  dishBrowseInclude,
  dishDetailInclude,
  dishRankingInclude,
  dishSearchInclude,
} from './includes.js';

/**
 * Single dish where-clause builder — shared by the paginated list query and
 * the unbounded search/ranking reads so filter semantics never drift.
 */
function buildDishWhere(params: QueryDishInput): Prisma.DishWhereInput {
  const {
    menuId,
    restaurantId,
    categoryId,
    cuisine,
    minPrice,
    maxPrice,
    search,
    tasteAttribute,
    mealCharacteristic,
    dietaryProperty,
    tag,
  } = params;

  return {
    status: 'ACTIVE',
    ...(menuId ? { menuId } : {}),
    ...(restaurantId ? { menu: { restaurantId } } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(categoryId
      ? {
          categories: {
            some: { categoryId },
          },
        }
      : {}),
    ...(cuisine
      ? {
          menu: {
            restaurant: {
              cuisines: {
                some: {
                  cuisine: {
                    OR: [
                      { name: { contains: cuisine, mode: 'insensitive' } },
                      { slug: { contains: cuisine, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          },
        }
      : {}),
    ...(tag
      ? {
          tags: {
            some: {
              tag: {
                OR: [
                  { name: { contains: tag, mode: 'insensitive' } },
                  { slug: { contains: tag, mode: 'insensitive' } },
                ],
              },
            },
          },
        }
      : {}),
    ...(tasteAttribute
      ? {
          attributes: {
            tasteAttributes: { has: tasteAttribute },
          },
        }
      : {}),
    ...(mealCharacteristic
      ? {
          attributes: {
            mealCharacteristics: { has: mealCharacteristic },
          },
        }
      : {}),
    ...(dietaryProperty
      ? {
          attributes: {
            dietaryProperties: { has: dietaryProperty },
          },
        }
      : {}),
  };
}

export class DishRepository {
  async findMany(params: QueryDishInput) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const where = buildDishWhere(params);

    const [total, items] = await Promise.all([
      prisma.dish.count({ where }),
      prisma.dish.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: dishBrowseInclude,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    return prisma.dish.findUnique({
      where: { id },
      include: dishDetailInclude,
    });
  }

  /**
   * Unpaginated dish read for in-memory enrichment (search, geo filtering).
   * Branches carry operating hours so open-now can be evaluated per row.
   */
  async searchMatching(params: QueryDishInput) {
    return prisma.dish.findMany({
      where: buildDishWhere(params),
      orderBy: { createdAt: 'desc' },
      include: dishSearchInclude,
    });
  }

  /**
   * Unpaginated candidate read for the ranking pipeline. Callers provide the
   * hard-constraint where clause; the relation graph lives here.
   */
  async findRankingPool(where: Prisma.DishWhereInput) {
    return prisma.dish.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: dishRankingInclude,
    });
  }

  async create(data: CreateDishInput & { slug: string }) {
    const {
      categoryIds,
      foodTagIds,
      ingredientIds,
      tasteAttributes,
      textures,
      mealCharacteristics,
      dietaryProperties,
      ...rest
    } = data;

    return prisma.$transaction(async (tx) => {
      const dish = await tx.dish.create({
        data: {
          ...rest,
          attributes: {
            create: {
              tasteAttributes,
              textures,
              mealCharacteristics,
              dietaryProperties,
            },
          },
          categories: {
            create: categoryIds.map((cId) => ({ categoryId: cId })),
          },
          tags: {
            create: foodTagIds.map((tId) => ({ tagId: tId })),
          },
          ingredients: {
            create: ingredientIds.map((iId) => ({ ingredientId: iId })),
          },
          priceHistory: {
            create: {
              price: rest.price,
              currency: rest.currency,
              source: rest.source,
            },
          },
        },
        include: {
          attributes: true,
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
          ingredients: { include: { ingredient: true } },
        },
      });

      return dish;
    });
  }

  async update(id: string, data: UpdateDishInput, existingPrice: number) {
    const {
      categoryIds,
      foodTagIds,
      ingredientIds,
      tasteAttributes,
      textures,
      mealCharacteristics,
      dietaryProperties,
      ...rest
    } = data;

    return prisma.$transaction(async (tx) => {
      // If price changed, record price history
      if (rest.price !== undefined && rest.price !== existingPrice) {
        await tx.dishPriceHistory.create({
          data: {
            dishId: id,
            price: rest.price,
            currency: rest.currency || 'EGP',
            source: rest.source || 'PRICE_UPDATE',
          },
        });
      }

      const dish = await tx.dish.update({
        where: { id },
        data: {
          ...rest,
          ...(tasteAttributes || textures || mealCharacteristics || dietaryProperties
            ? {
                attributes: {
                  upsert: {
                    create: {
                      tasteAttributes: tasteAttributes || [],
                      textures: textures || [],
                      mealCharacteristics: mealCharacteristics || [],
                      dietaryProperties: dietaryProperties || [],
                    },
                    update: {
                      ...(tasteAttributes ? { tasteAttributes } : {}),
                      ...(textures ? { textures } : {}),
                      ...(mealCharacteristics ? { mealCharacteristics } : {}),
                      ...(dietaryProperties ? { dietaryProperties } : {}),
                    },
                  },
                },
              }
            : {}),
          ...(categoryIds
            ? {
                categories: {
                  deleteMany: {},
                  create: categoryIds.map((cId) => ({ categoryId: cId })),
                },
              }
            : {}),
          ...(foodTagIds
            ? {
                tags: {
                  deleteMany: {},
                  create: foodTagIds.map((tId) => ({ tagId: tId })),
                },
              }
            : {}),
          ...(ingredientIds
            ? {
                ingredients: {
                  deleteMany: {},
                  create: ingredientIds.map((iId) => ({ ingredientId: iId })),
                },
              }
            : {}),
        },
        include: {
          attributes: true,
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
          ingredients: { include: { ingredient: true } },
        },
      });

      return dish;
    });
  }

  async delete(id: string) {
    return prisma.dish.delete({
      where: { id },
    });
  }

  /** Cuisines that actually have restaurants — drives the mobile filter pills. */
  async findCuisines() {
    return prisma.cuisine.findMany({
      where: { restaurants: { some: {} } },
      select: { slug: true, name: true, nameAr: true },
      orderBy: { name: 'asc' },
    });
  }
}

export const dishRepository = new DishRepository();
