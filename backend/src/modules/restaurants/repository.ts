import { prisma } from '../../database/prisma.client.js';
import { CreateRestaurantInput, QueryRestaurantInput, UpdateRestaurantInput } from './schema.js';
import { Prisma } from '@prisma/client';
import { dishBrowseInclude } from '../dishes/includes.js';
import type { RestaurantCityRowLike, RestaurantRowLike } from './presenter.js';

/** ACTIVE branches with everything the browse presenter needs (city included). */
const browseBranchesInclude = {
  where: { status: 'ACTIVE' },
  orderBy: { createdAt: 'asc' },
  include: {
    operatingHours: true,
    city: { select: { slug: true, nameEn: true, nameAr: true } },
    atmospheres: { include: { atmosphereTag: true } },
  },
} as const;

/** Browse row: cuisines + ACTIVE branches, no menus. */
const browseRowInclude = {
  cuisines: { include: { cuisine: true } },
  branches: browseBranchesInclude,
} as const;

/**
 * Detail row: browse row plus ACTIVE menus → ACTIVE dishes. Dishes use the
 * canonical dish include graph (attributes/tags/categories/ingredients plus
 * menu → restaurant → cuisines/branches) so `presentDish` can fill every field.
 */
const detailRowInclude = {
  ...browseRowInclude,
  menus: {
    where: { status: 'ACTIVE' },
    include: {
      dishes: {
        where: { status: 'ACTIVE' },
        include: dishBrowseInclude,
      },
    },
  },
} as const;

/**
 * `coffee` is the word users and the app use; `cafe` is what the importer
 * stores. Aliasing here keeps the vocabulary of the query param friendly
 * without inventing a second kind in the data.
 */
const PLACE_KIND_ALIASES: Record<string, string> = {
  coffee: 'cafe',
};

function buildWhere(params: QueryRestaurantInput): Prisma.RestaurantWhereInput {
  const { cuisine, priceRange, search, status, verificationStatus, governorate, city, placeKind } =
    params;

  return {
    ...(status ? { status } : { status: 'ACTIVE' }),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(priceRange ? { priceRange } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
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
    // Location filters match a restaurant that HAS an ACTIVE branch there.
    ...(governorate || city || placeKind
      ? {
          branches: {
            some: {
              status: 'ACTIVE',
              ...(city ? { city: { slug: city } } : {}),
              ...(governorate ? { governorate: { slug: governorate } } : {}),
              // A multi-valued filter is one AND-ed condition, not several `some`
              // clauses: separate `some`s would let branch A match the city and
              // branch B match the kind, admitting places that satisfy neither
              // area nor kind in a single location.
              ...(placeKind ? { placeKind: PLACE_KIND_ALIASES[placeKind] ?? placeKind } : {}),
            },
          },
        }
      : {}),
  };
}

export class RestaurantRepository {
  /**
   * Browse rows. In geo mode the caller must see every match before filtering,
   * so pagination is NOT applied here — the service slices in memory after the
   * distance filter/sort (Prisma cannot order by a computed relation distance).
   * Without coordinates the usual DB-side skip/take pagination is kept.
   */
  async findMany(
    params: QueryRestaurantInput
  ): Promise<{ items: RestaurantRowLike[]; total: number }> {
    const { page, limit, latitude, longitude, sort } = params;
    const geoMode = latitude !== undefined && longitude !== undefined;

    const where = buildWhere(params);
    const orderBy: Prisma.RestaurantOrderByWithRelationInput =
      sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' };

    if (geoMode) {
      const items = await prisma.restaurant.findMany({ where, orderBy, include: browseRowInclude });
      return { items, total: items.length };
    }

    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({ where, skip, take: limit, orderBy, include: browseRowInclude }),
    ]);

    return { items, total };
  }

  /** Cities (with coordinates) that may hold branches, optionally one governorate. */
  async findCities(governorate?: string): Promise<RestaurantCityRowLike[]> {
    return prisma.city.findMany({
      where: governorate ? { governorate: { slug: governorate } } : {},
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameAr: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { nameEn: 'asc' },
    });
  }

  /**
   * What kinds of place the catalogue actually holds, with counts.
   *
   * Branch kinds, not brand kinds: a chain can be a cafe on one street and a
   * restaurant on another, and the browse filter reads better as "coffee
   * shops near me" than as a brand-level single label. Kinds with no ACTIVE
   * branches are omitted so the filter never offers an empty result.
   */
  async findActiveBranchKindCounts(
    governorate?: string
  ): Promise<Array<{ placeKind: string; branchCount: number }>> {
    const grouped = await prisma.branch.groupBy({
      by: ['placeKind'],
      where: {
        status: 'ACTIVE',
        restaurant: { status: 'ACTIVE' },
        placeKind: { not: null },
        ...(governorate ? { governorate: { slug: governorate } } : {}),
      },
      _count: { _all: true },
    });

    return grouped
      .filter((row): row is typeof row & { placeKind: string } => row.placeKind !== null)
      .map((row) => ({ placeKind: row.placeKind, branchCount: row._count._all }))
      .sort((a, b) => b.branchCount - a.branchCount);
  }

  /** `(restaurant, city)` pairs of ACTIVE branches of ACTIVE restaurants. */
  async findActiveRestaurantCityPairs(
    governorate?: string
  ): Promise<{ restaurantId: string; cityId: string | null }[]> {
    return prisma.branch.findMany({
      where: {
        status: 'ACTIVE',
        restaurant: { status: 'ACTIVE' },
        ...(governorate ? { city: { governorate: { slug: governorate } } } : {}),
      },
      select: { restaurantId: true, cityId: true },
      distinct: ['restaurantId', 'cityId'],
    });
  }

  async findById(id: string) {
    return prisma.restaurant.findUnique({
      where: { id },
      include: detailRowInclude,
    });
  }

  async findBySlug(slug: string) {
    return prisma.restaurant.findUnique({
      where: { slug },
      include: detailRowInclude,
    });
  }

  async create(data: CreateRestaurantInput & { slug: string }) {
    const { cuisineIds, ...rest } = data;
    return prisma.restaurant.create({
      data: {
        ...rest,
        cuisines: {
          create: cuisineIds.map((id) => ({
            cuisine: { connect: { id } },
          })),
        },
      },
      include: {
        cuisines: {
          include: {
            cuisine: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateRestaurantInput) {
    const { cuisineIds, ...rest } = data;

    return prisma.restaurant.update({
      where: { id },
      data: {
        ...rest,
        ...(cuisineIds
          ? {
              cuisines: {
                deleteMany: {},
                create: cuisineIds.map((cId) => ({
                  cuisine: { connect: { id: cId } },
                })),
              },
            }
          : {}),
      },
      include: {
        cuisines: {
          include: {
            cuisine: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.restaurant.delete({
      where: { id },
    });
  }
}

export const restaurantRepository = new RestaurantRepository();
