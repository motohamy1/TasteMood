import { prisma } from '../../database/prisma.client.js';
import { CreateBranchInput, QueryBranchInput, UpdateBranchInput } from './schema.js';

export class BranchRepository {
  async findMany(params: QueryBranchInput) {
    const { restaurantId } = params;

    return prisma.branch.findMany({
      where: {
        status: 'ACTIVE',
        ...(restaurantId ? { restaurantId } : {}),
      },
      include: {
        restaurant: {
          include: {
            cuisines: { include: { cuisine: true } },
          },
        },
        operatingHours: true,
        atmospheres: {
          include: { atmosphereTag: true },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.branch.findUnique({
      where: { id },
      include: {
        restaurant: {
          include: {
            cuisines: { include: { cuisine: true } },
          },
        },
        operatingHours: true,
        atmospheres: {
          include: { atmosphereTag: true },
        },
        menus: {
          where: { status: 'ACTIVE' },
          include: {
            dishes: {
              where: { status: 'ACTIVE' },
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

  async create(data: CreateBranchInput) {
    const { atmosphereTagIds, operatingHours, ...rest } = data;

    return prisma.branch.create({
      data: {
        ...rest,
        atmospheres: {
          create: atmosphereTagIds.map((tagId) => ({
            atmosphereTag: { connect: { id: tagId } },
          })),
        },
        operatingHours: {
          create: operatingHours,
        },
      },
      include: {
        operatingHours: true,
        atmospheres: {
          include: { atmosphereTag: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateBranchInput) {
    const { atmosphereTagIds, operatingHours, ...rest } = data;

    return prisma.branch.update({
      where: { id },
      data: {
        ...rest,
        ...(atmosphereTagIds
          ? {
              atmospheres: {
                deleteMany: {},
                create: atmosphereTagIds.map((tagId) => ({
                  atmosphereTag: { connect: { id: tagId } },
                })),
              },
            }
          : {}),
        ...(operatingHours
          ? {
              operatingHours: {
                deleteMany: {},
                create: operatingHours,
              },
            }
          : {}),
      },
      include: {
        operatingHours: true,
        atmospheres: {
          include: { atmosphereTag: true },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.branch.delete({
      where: { id },
    });
  }
}

export const branchRepository = new BranchRepository();
