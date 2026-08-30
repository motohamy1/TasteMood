import { z } from 'zod';

export const OperatingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)'),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)'),
  isClosed: z.boolean().default(false),
  isSplitShift: z.boolean().default(false),
});

export const CreateBranchSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(2).max(100),
  address: z.string().min(5).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().optional(),
  atmosphereTagIds: z.array(z.string()).default([]),
  operatingHours: z.array(OperatingHourSchema).default([]),
});

export const UpdateBranchSchema = CreateBranchSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']).optional(),
});

export const QueryBranchSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  radiusKm: z.coerce.number().default(10),
  openNow: z.coerce.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>;
export type QueryBranchInput = z.infer<typeof QueryBranchSchema>;
export type OperatingHourInput = z.infer<typeof OperatingHourSchema>;
