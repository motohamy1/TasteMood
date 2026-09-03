import { prisma } from '../../database/prisma.client.js';
import { CreateDishInput, QueryDishInput, UpdateDishInput } from './schema.js';
import { Prisma } from '@prisma/client';

export class DishRepository {
  async findMany(params: QueryDishInput) {
    const {
      page,
      limit,
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

    const skip = (page - 1) * limit;

    const where: Prisma.DishWhereInput = {
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

    const [total, items] = await Promise.all([
      prisma.dish.count({ where }),
      prisma.dish.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          attributes: true,
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
          ingredients: { include: { ingredient: true } },
          menu: {
            include: {
              restaurant: {
                include: {
                  cuisines: { include: { cuisine: true } },
                  branches: {
                    where: { status: 'ACTIVE' },
                    orderBy: { createdAt: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
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
      include: {
        attributes: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        ingredients: { include: { ingredient: true } },
        priceHistory: {
          orderBy: { effectiveFrom: 'desc' },
        },
        menu: {
          include: {
            restaurant: {
              include: {
                cuisines: { include: { cuisine: true } },
                branches: {
                  where: { status: 'ACTIVE' },
                  include: {
                    operatingHours: true,
                  },
                },
              },
            },
          },
        },
      },
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
}

export const dishRepository = new DishRepository();
