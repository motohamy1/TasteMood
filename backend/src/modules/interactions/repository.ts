import { prisma } from '../../database/prisma.client.js';
import { CreateInteractionInput, QueryInteractionsInput } from './schema.js';
import { Prisma } from '@prisma/client';

export class InteractionRepository {
  async create(userId: string, data: CreateInteractionInput) {
    const { metadata, ...rest } = data;
    return prisma.userInteraction.create({
      data: {
        userId,
        ...rest,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findManyByUserId(userId: string, params: QueryInteractionsInput) {
    const { page, limit, interactionType } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserInteractionWhereInput = {
      userId,
      ...(interactionType ? { interactionType } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.userInteraction.count({ where }),
      prisma.userInteraction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          restaurant: true,
          branch: true,
          dish: true,
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
}

export const interactionRepository = new InteractionRepository();
