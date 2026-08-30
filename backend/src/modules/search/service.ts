import { prisma } from '../../database/prisma.client.js';
import { SearchDishesInput, SearchRestaurantsInput } from './schema.js';
import { calculateHaversineDistanceKm } from '../../common/utils/geo.utils.js';
import { branchService } from '../branches/service.js';
import { Prisma } from '@prisma/client';

export class SearchService {
  async searchRestaurants(params: SearchRestaurantsInput) {
    const { q, cuisine, priceRange, lat, lng, radiusKm, atmosphere, openNow, page, limit } = params;

    const where: Prisma.RestaurantWhereInput = {
      status: 'ACTIVE',
      ...(priceRange ? { priceRange } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cuisine
        ? {
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
          }
        : {}),
      ...(atmosphere
        ? {
            branches: {
              some: {
                status: 'ACTIVE',
                atmospheres: {
                  some: {
                    atmosphereTag: {
                      OR: [
                        { name: { contains: atmosphere, mode: 'insensitive' } },
                        { slug: { contains: atmosphere, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            },
          }
        : {}),
    };

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        cuisines: { include: { cuisine: true } },
        branches: {
          where: { status: 'ACTIVE' },
          include: {
            operatingHours: true,
            atmospheres: { include: { atmosphereTag: true } },
          },
        },
      },
    });

    const now = new Date();
    let enriched = restaurants.map((r) => {
      // Find closest branch & open status
      let closestBranchDistance: number | undefined;
      let hasOpenBranch = false;

      r.branches.forEach((b) => {
        const isOpen = branchService.isBranchOpen(b.operatingHours, now);
        if (isOpen) hasOpenBranch = true;

        if (lat !== undefined && lng !== undefined) {
          const dist = calculateHaversineDistanceKm(lat, lng, b.latitude, b.longitude);
          if (closestBranchDistance === undefined || dist < closestBranchDistance) {
            closestBranchDistance = dist;
          }
        }
      });

      return {
        ...r,
        hasOpenBranch,
        closestDistanceKm:
          closestBranchDistance !== undefined
            ? Number(closestBranchDistance.toFixed(2))
            : undefined,
      };
    });

    if (lat !== undefined && lng !== undefined) {
      enriched = enriched.filter(
        (r) => r.closestDistanceKm !== undefined && r.closestDistanceKm <= radiusKm
      );
      enriched.sort((a, b) => (a.closestDistanceKm || 0) - (b.closestDistanceKm || 0));
    }

    if (openNow) {
      enriched = enriched.filter((r) => r.hasOpenBranch);
    }

    const total = enriched.length;
    const paginated = enriched.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchDishes(params: SearchDishesInput) {
    const {
      q,
      cuisine,
      minPrice,
      maxPrice,
      lat,
      lng,
      radiusKm,
      taste,
      mealType,
      dietary,
      tag,
      openNow,
      page,
      limit,
    } = params;

    const where: Prisma.DishWhereInput = {
      status: 'ACTIVE',
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
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
      ...(taste
        ? {
            attributes: {
              tasteAttributes: { has: taste },
            },
          }
        : {}),
      ...(mealType
        ? {
            attributes: {
              mealCharacteristics: { has: mealType },
            },
          }
        : {}),
      ...(dietary
        ? {
            attributes: {
              dietaryProperties: { has: dietary },
            },
          }
        : {}),
    };

    const dishes = await prisma.dish.findMany({
      where,
      include: {
        attributes: true,
        tags: { include: { tag: true } },
        categories: { include: { category: true } },
        ingredients: { include: { ingredient: true } },
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

    const now = new Date();
    let enriched = dishes.map((dish) => {
      const branches = dish.menu.restaurant.branches;
      let closestBranchDistance: number | undefined;
      let hasOpenBranch = false;

      branches.forEach((b) => {
        if (branchService.isBranchOpen(b.operatingHours, now)) {
          hasOpenBranch = true;
        }
        if (lat !== undefined && lng !== undefined) {
          const dist = calculateHaversineDistanceKm(lat, lng, b.latitude, b.longitude);
          if (closestBranchDistance === undefined || dist < closestBranchDistance) {
            closestBranchDistance = dist;
          }
        }
      });

      return {
        ...dish,
        hasOpenBranch,
        closestDistanceKm:
          closestBranchDistance !== undefined
            ? Number(closestBranchDistance.toFixed(2))
            : undefined,
      };
    });

    if (lat !== undefined && lng !== undefined) {
      enriched = enriched.filter(
        (d) => d.closestDistanceKm !== undefined && d.closestDistanceKm <= radiusKm
      );
      enriched.sort((a, b) => (a.closestDistanceKm || 0) - (b.closestDistanceKm || 0));
    }

    if (openNow) {
      enriched = enriched.filter((d) => d.hasOpenBranch);
    }

    const total = enriched.length;
    const paginated = enriched.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const searchService = new SearchService();
