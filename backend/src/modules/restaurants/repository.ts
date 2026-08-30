import { prisma } from '../../database/prisma.client.js';
import { CreateRestaurantInput, QueryRestaurantInput, UpdateRestaurantInput } from './schema.js';
import { Prisma } from '@prisma/client';

export class RestaurantRepository {
  async findMany(params: QueryRestaurantInput) {
    const { page, limit, cuisine, priceRange, search, status, verificationStatus } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.RestaurantWhereInput = {
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
    };

    const [total, items] = await Promise.all([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cuisines: {
            include: {
              cuisine: true,
            },
          },
          branches: {
            where: { status: 'ACTIVE' },
            include: {
              operatingHours: true,
              atmospheres: {
                include: {
                  atmosphereTag: true,
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
    return prisma.restaurant.findUnique({
      where: { id },
      include: {
        cuisines: {
          include: {
            cuisine: true,
          },
        },
        branches: {
          include: {
            operatingHours: true,
            atmospheres: {
              include: {
                atmosphereTag: true,
              },
            },
          },
        },
        menus: {
          include: {
            dishes: {
              include: {
                attributes: true,
                tags: { include: { tag: true } },
                categories: { include: { category: true } },
              },
            },
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return prisma.restaurant.findUnique({
      where: { slug },
      include: {
        cuisines: {
          include: {
            cuisine: true,
          },
        },
        branches: {
          include: {
            operatingHours: true,
            atmospheres: {
              include: {
                atmosphereTag: true,
              },
            },
          },
        },
      },
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
