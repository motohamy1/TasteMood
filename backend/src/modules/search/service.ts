import { prisma } from '../../database/prisma.client.js';
import { SearchDishesInput, SearchRestaurantsInput } from './schema.js';
import { closestBranchSummary } from '../branches/availability.js';
import { dishRepository } from '../dishes/repository.js';
import { presentDish } from '../dishes/presenter.js';
import { Prisma } from '@prisma/client';
import { QueryDishInput } from '../dishes/schema.js';
import { Coordinates } from '../../common/utils/geo.utils.js';

function toOrigin(lat?: number, lng?: number): Coordinates | undefined {
  return lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : undefined;
}

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

    const origin = toOrigin(lat, lng);
    const enriched = restaurants.map((r) => {
      const { hasOpenBranch, closestDistanceKm } = closestBranchSummary(r.branches, origin);
      return {
        ...r,
        hasOpenBranch,
        closestDistanceKm,
      };
    });

    const withinRadius = enriched.filter((r) => {
      if (origin) {
        return r.closestDistanceKm !== undefined && r.closestDistanceKm <= radiusKm;
      }
      return true;
    });
    if (origin) {
      withinRadius.sort((a, b) => (a.closestDistanceKm || 0) - (b.closestDistanceKm || 0));
    }

    const openFiltered = openNow ? withinRadius.filter((r) => r.hasOpenBranch) : withinRadius;

    const total = openFiltered.length;
    const paginated = openFiltered.slice((page - 1) * limit, page * limit);

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

    // Same filter semantics as GET /dishes — the where-builder lives in the
    // dish repository; the relation graph is the shared search include.
    const repoParams: QueryDishInput = {
      page: 1,
      limit: 100,
      search: q,
      cuisine,
      minPrice,
      maxPrice,
      tasteAttribute: taste,
      mealCharacteristic: mealType,
      dietaryProperty: dietary,
      tag,
    };

    const dishes = await dishRepository.searchMatching(repoParams);
    const origin = toOrigin(lat, lng);

    // Enrich rows with open-now + closest-branch distance, then filter/sort in
    // memory: radius and open-now are branch-level facts the DB query can't see.
    const enriched = dishes.map((dish) => {
      const { hasOpenBranch, closestDistanceKm } = closestBranchSummary(
        dish.menu?.restaurant?.branches,
        origin
      );
      return { dish, hasOpenBranch, closestDistanceKm };
    });

    let filtered = enriched;
    if (origin) {
      filtered = filtered.filter(
        (entry) => entry.closestDistanceKm !== undefined && entry.closestDistanceKm <= radiusKm
      );
      filtered.sort((a, b) => (a.closestDistanceKm || 0) - (b.closestDistanceKm || 0));
    }

    if (openNow) {
      filtered = filtered.filter((entry) => entry.hasOpenBranch);
    }

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Every dish leaves through the same presenter as GET /dishes — one wire shape.
    const items = paginated.map(({ dish, hasOpenBranch, closestDistanceKm }) => ({
      ...presentDish(dish),
      hasOpenBranch,
      closestDistanceKm,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const searchService = new SearchService();
