import { prisma } from '../../database/prisma.client.js';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        preferenceProfile: true,
      },
    });
  }

  async findByAuthUserId(authUserId: string) {
    return prisma.user.findUnique({
      where: { authUserId },
      include: {
        preferenceProfile: true,
      },
    });
  }

  async update(id: string, data: { displayName?: string; avatarUrl?: string }) {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        preferenceProfile: true,
      },
    });
  }

  async findMany(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
}

export const userRepository = new UserRepository();
