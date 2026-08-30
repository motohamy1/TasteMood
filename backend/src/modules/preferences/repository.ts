import { prisma } from '../../database/prisma.client.js';
import { UpdatePreferencesInput } from './schema.js';
import { Prisma } from '@prisma/client';

export class PreferencesRepository {
  async findByUserId(userId: string) {
    return prisma.userPreferenceProfile.findUnique({
      where: { userId },
    });
  }

  async upsert(userId: string, data: UpdatePreferencesInput) {
    const { inferredPreferences, ...rest } = data;

    return prisma.userPreferenceProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...rest,
        inferredPreferences: inferredPreferences as Prisma.InputJsonValue | undefined,
      },
      update: {
        ...rest,
        ...(inferredPreferences
          ? { inferredPreferences: inferredPreferences as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}

export const preferencesRepository = new PreferencesRepository();
