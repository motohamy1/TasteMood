import type { PrismaClient, RecordStatus } from '@prisma/client';
import { GOVERNORATES, GOVERNORATE_CITIES } from './geography.js';
import { CUISINES } from './taxonomy.js';
import { haversineKm, namesMatch, slugify } from './normalize.js';
import type { ImportSource, NormalizedPlace, PlaceGroup } from './types.js';

type Db = PrismaClient;

const PRICE_RANGE_BY_TIER: Record<number, 'BUDGET' | 'MODERATE' | 'EXPENSIVE' | 'LUXURY'> = {
  1: 'BUDGET',
  2: 'MODERATE',
  3: 'EXPENSIVE',
  4: 'LUXURY',
};

/** Idempotent upsert of cuisines, governorates, and the pre-defined cities. */
export async function ensureReferenceData(db: Db): Promise<void> {
  for (const cuisine of CUISINES) {
    await db.cuisine.upsert({
      where: { slug: cuisine.slug },
      create: cuisine,
      update: { name: cuisine.name, nameAr: cuisine.nameAr, description: cuisine.description },
    });
  }

  for (const gov of GOVERNORATES) {
    await db.governorate.upsert({
      where: { slug: gov.slug },
      create: gov,
      update: { nameEn: gov.nameEn, nameAr: gov.nameAr },
    });
  }

  for (const [govSlug, cities] of Object.entries(GOVERNORATE_CITIES)) {
    const governorate = await db.governorate.findUnique({ where: { slug: govSlug } });
    if (!governorate) continue;
    for (const city of cities) {
      const existing = await db.city.findFirst({
        where: { governorateId: governorate.id, slug: city.slug },
      });
      if (existing) {
        await db.city.update({ where: { id: existing.id }, data: city });
      } else {
        await db.city.create({ data: { ...city, governorateId: governorate.id } });
      }
    }
  }
}

interface ResolvedLocation {
  governorateId: string;
  governorateAr: string;
  cityId: string | null;
  cityAr: string;
  cityEn: string;
}

export interface GovernorateContext {
  governorateId: string;
  governorateSlug: string;
  governorateAr: string;
  governorateEn: string;
  cities: Array<{ id: string; nameAr: string; nameEn: string; latitude: number; longitude: number }>;
}

/** Load the governorate + its cities once per run; `resolveLocation` is then pure. */
export async function loadGovernorateContext(db: Db, governorateSlug: string): Promise<GovernorateContext> {
  const governorate = await db.governorate.findUniqueOrThrow({
    where: { slug: governorateSlug },
    include: { cities: true },
  });
  return {
    governorateId: governorate.id,
    governorateSlug: governorate.slug,
    governorateAr: governorate.nameAr,
    governorateEn: governorate.nameEn,
    cities: governorate.cities
      .filter((c): c is typeof c & { latitude: number; longitude: number } => c.latitude != null && c.longitude != null)
      .map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, latitude: c.latitude, longitude: c.longitude })),
  };
}

/** Nearest known city of the governorate within 25 km, else governorate-level. */
export function resolveLocation(ctx: GovernorateContext, latitude: number, longitude: number): ResolvedLocation {
  let best: { id: string; nameAr: string; nameEn: string; distanceKm: number } | null = null;
  for (const city of ctx.cities) {
    const distanceKm = haversineKm(latitude, longitude, city.latitude, city.longitude);
    if (!best || distanceKm < best.distanceKm) {
      best = { id: city.id, nameAr: city.nameAr, nameEn: city.nameEn, distanceKm };
    }
  }

  return {
    governorateId: ctx.governorateId,
    governorateAr: ctx.governorateAr,
    cityId: best && best.distanceKm <= 25 ? best.id : null,
    cityAr: best && best.distanceKm <= 25 ? best.nameAr : ctx.governorateAr,
    cityEn: best && best.distanceKm <= 25 ? best.nameEn : ctx.governorateEn,
  };
}

export interface UpsertOptions {
  publish: boolean;
}

export interface UpsertSummary {
  restaurantsCreated: number;
  restaurantsUpdated: number;
  branchesCreated: number;
  branchesUpdated: number;
  branchesDeactivated: number;
}

/** Upsert one brand group: the Restaurant row plus every place as a Branch. */
export async function upsertGroup(
  db: Db,
  group: PlaceGroup,
  ctx: GovernorateContext,
  options: UpsertOptions,
  summary: UpsertSummary
): Promise<void> {
  const preferred =
    group.places.find((p) => p.source === 'OSM' && p.name) ??
    group.places.find((p) => p.name) ??
    group.places[0];

  const rawName = preferred.name ?? preferred.nameEn ?? group.key;
  const nameEn = group.places.find((p) => p.nameEn)?.nameEn ?? null;

  const sample = group.places[0];
  const location = resolveLocation(ctx, sample.latitude, sample.longitude);

  const priceTier = group.places.find((p) => p.priceTier != null)?.priceTier ?? null;
  const priceRange = priceTier ? PRICE_RANGE_BY_TIER[priceTier] : undefined;
  const photo = group.places.find((p) => p.photoUrl);

  const status = options.publish ? 'ACTIVE' : 'DRAFT';
  const restaurant = await resolveRestaurant(db, rawName, location, nameEn);

  if (restaurant.created) summary.restaurantsCreated += 1;
  else summary.restaurantsUpdated += 1;

  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      nameEn: restaurant.nameEn ?? nameEn,
      source: preferred.source,
      status: options.publish ? ('ACTIVE' as const) : restaurant.status,
      ...(priceRange ? { priceRange } : {}),
      ...(photo ? { coverImageUrl: photo.photoUrl, photoAttribution: photo.photoAttribution } : {}),
    },
  });

  const cuisineSlugs = new Set(group.places.flatMap((p) => p.cuisineSlugs));
  if (cuisineSlugs.size > 0) {
    const cuisines = await db.cuisine.findMany({ where: { slug: { in: [...cuisineSlugs] } } });
    await db.restaurantCuisine.createMany({
      data: cuisines.map((c) => ({ restaurantId: restaurant.id, cuisineId: c.id })),
      skipDuplicates: true,
    });
  }

  for (const place of group.places) {
    const placeLocation = resolveLocation(ctx, place.latitude, place.longitude);
    const branchName = `فرع ${placeLocation.cityAr}`;
    const branchNameEn = `${placeLocation.cityEn} Branch`;

    const existing = place.externalId ? await db.branch.findUnique({ where: { externalId: place.externalId } }) : null;

    if (existing) {
      await db.branch.update({
        where: { id: existing.id },
        data: {
          status: options.publish ? ('ACTIVE' as const) : existing.status,
          phone: existing.phone ?? place.phone,
          nameEn: existing.nameEn ?? branchNameEn,
          governorateId: placeLocation.governorateId,
          cityId: placeLocation.cityId ?? existing.cityId,
        },
      });
      if (place.openingHours && existing.source === place.source) {
        await db.branchOperatingHour.deleteMany({ where: { branchId: existing.id } });
        await db.branchOperatingHour.createMany({
          data: place.openingHours.map((h) => ({ ...h, branchId: existing.id })),
        });
      }
      summary.branchesUpdated += 1;
    } else {
      await db.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: branchName,
          nameEn: branchNameEn,
          address: place.address ?? `${placeLocation.cityAr}، ${placeLocation.governorateAr}`,
          latitude: place.latitude,
          longitude: place.longitude,
          phone: place.phone,
          status,
          verificationStatus: 'UNVERIFIED',
          source: place.source,
          externalId: place.externalId || null,
          governorateId: placeLocation.governorateId,
          cityId: placeLocation.cityId,
          ...(place.openingHours
            ? { operatingHours: { create: place.openingHours } }
            : {}),
        },
      });
      summary.branchesCreated += 1;
    }
  }
}

/**
 * Find-or-create the Restaurant row for a brand. Slugs stay globally unique;
 * a name collision with a *different* brand falls back to `-<city>` and then
 * to a short hash suffix.
 */
async function resolveRestaurant(
  db: Db,
  name: string,
  location: ResolvedLocation,
  nameEn: string | null
): Promise<{ id: string; created: boolean; nameEn: string | null; status: RecordStatus }> {
  const base = slugify(name) || 'place';
  const candidates = [
    base,
    `${base}-${slugify(location.cityEn) || 'city'}`,
    `${base}-${Math.abs(hashCode(name + location.cityEn)).toString(36).slice(0, 6)}`,
  ];

  for (const slug of candidates) {
    const existing = await db.restaurant.findUnique({ where: { slug } });
    if (!existing) {
      const created = await db.restaurant.create({
        data: {
          name,
          nameEn,
          slug,
          status: 'DRAFT',
          verificationStatus: 'UNVERIFIED',
        },
      });
      return { id: created.id, created: true, nameEn: created.nameEn, status: created.status };
    }
    if (namesMatch(existing.name, name) || (nameEn && namesMatch(existing.nameEn ?? '', nameEn))) {
      return { id: existing.id, created: false, nameEn: existing.nameEn, status: existing.status };
    }
  }

  // Every candidate collided with a different brand — last resort hash slug.
  const slug = `${base}-${Date.now().toString(36)}`;
  const created = await db.restaurant.create({
    data: { name, nameEn, slug, status: 'DRAFT', verificationStatus: 'UNVERIFIED' },
  });
  return { id: created.id, created: true, nameEn: created.nameEn, status: created.status };
}

/**
 * Lifecycle rule: branches imported by the given sources that no longer
 * appear in the source data are marked INACTIVE (never deleted).
 */
export async function deactivateMissingBranches(
  db: Db,
  governorateSlug: string,
  sources: ImportSource[],
  seenExternalIds: Set<string>
): Promise<number> {
  const governorate = await db.governorate.findUnique({ where: { slug: governorateSlug } });
  if (!governorate) return 0;

  const stale = await db.branch.findMany({
    where: {
      governorateId: governorate.id,
      source: { in: sources },
      status: { not: 'INACTIVE' },
      externalId: { not: null },
    },
    select: { id: true, externalId: true },
  });

  const toDeactivate = stale
    .filter((b) => b.externalId && !seenExternalIds.has(b.externalId))
    .map((b) => b.id);

  if (toDeactivate.length === 0) return 0;
  const result = await db.branch.updateMany({
    where: { id: { in: toDeactivate } },
    data: { status: 'INACTIVE' },
  });
  return result.count;
}

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export type { NormalizedPlace };
