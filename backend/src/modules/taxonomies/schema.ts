import { z } from 'zod';

export const CreateCuisineSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
});

export const CreateTagSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
});

export const CreateAtmosphereSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
});
