import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { generateJson } from './client.js';
import {
  ATMOSPHERE_SLUGS,
  DISH_CATEGORIES,
  EnrichmentDraftSchema,
  FOOD_TAGS,
  buildEnrichmentPrompt,
  type EnrichmentDraft,
} from './prompt.js';
import { slugify } from '../../importer/normalize.js';
import { loadGovernorateContext, resolveLocation } from '../../importer/upsert.js';

/**
 * AI menu enrichment queue.
 *
 * Picks imported places (DRAFT, source OSM/OVERTURE/FOURSQUARE) that have no
 * AI menu yet — so re-runs resume where the last run stopped — drafts a full
 * menu + attributes via the free-tier provider chain, and writes everything
 * as DRAFT/UNVERIFIED for Prisma Studio review.
 *
 * Usage: npm run enrich:menus -- --governorate=dakahlia [--city=mansoura] [--limit=25] [--delay-ms=2500]
 */

const IMPORT_SOURCES = ['OSM', 'OVERTURE', 'FOURSQUARE'];

interface CliArgs {
  governorate: string;
  city: string | null;
  limit: number;
  delayMs: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { governorate: 'dakahlia', city: null, limit: 25, delayMs: 2500 };
  for (const arg of argv) {
    if (arg.startsWith('--governorate=')) args.governorate = arg.split('=')[1];
    else if (arg.startsWith('--city=')) args.city = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.split('=')[1]) || args.limit;
    else if (arg.startsWith('--delay-ms=')) args.delayMs = Number(arg.split('=')[1]) || args.delayMs;
  }
  return args;
}

// Batch script — use the session-mode connection (DIRECT_URL); see importer/run.ts.
const db = new PrismaClient(
  process.env.DIRECT_URL ? { datasourceUrl: process.env.DIRECT_URL } : undefined
);

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const ctx = await loadGovernorateContext(db, args.governorate);
  const ingredients = await db.ingredient.findMany({ select: { name: true } });
  const ingredientNames = ingredients.map((i) => i.name);

  const pending = await db.restaurant.findMany({
    where: {
      source: { in: IMPORT_SOURCES },
      menus: { none: { source: 'AI' } },
      branches: {
        some: {
          status: { not: 'INACTIVE' },
          ...(args.city ? { city: { slug: args.city } } : { governorateId: ctx.governorateId }),
        },
      },
    },
    include: {
      branches: {
        where: { status: { not: 'INACTIVE' } },
        include: { city: true },
        take: 1,
      },
      cuisines: { include: { cuisine: true } },
    },
    take: args.limit,
    orderBy: { createdAt: 'asc' },
  });

  if (pending.length === 0) {
    console.log('No pending places to enrich — every imported place already has a drafted menu.');
    return;
  }

  console.log(
    `Enriching ${pending.length} places` +
      (args.city ? ` in city "${args.city}"` : ` in ${ctx.governorateEn}`) +
      ` (resumable; ${args.delayMs}ms between calls).`
  );

  let ok = 0;
  let failed = 0;
  for (const restaurant of pending) {
    const branch = restaurant.branches[0];
    const cityAr = branch?.city?.nameAr ?? ctx.governorateAr;
    const cityEn = branch?.city?.nameEn ?? ctx.governorateEn;
    const location = branch ? resolveLocation(ctx, branch.latitude, branch.longitude) : null;

    process.stdout.write(`→ ${restaurant.name} … `);
    try {
      const { system, user } = buildEnrichmentPrompt({
        restaurantName: restaurant.name,
        restaurantNameEn: restaurant.nameEn,
        cityAr: location?.cityAr ?? cityAr,
        cityEn: location?.cityEn ?? cityEn,
        governorateAr: ctx.governorateAr,
        mappedCuisineSlugs: restaurant.cuisines.map((rc) => rc.cuisine.slug),
        cuisineNames: restaurant.cuisines.map((rc) => ({ slug: rc.cuisine.slug, name: rc.cuisine.name })),
        priceTier: null,
        ingredientNames,
        cuisineSlugList: (await db.cuisine.findMany({ select: { slug: true, name: true } })).map((c) => ({
          slug: c.slug,
          name: c.name,
        })),
      });

      const draft = await generateJson({ system, user, temperature: 0.4 }, EnrichmentDraftSchema);
      await writeDraft(restaurant.id, draft);
      ok += 1;
      console.log(`ok (${draft.dishes.length} dishes)`);
    } catch (error) {
      failed += 1;
      console.log(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, args.delayMs));
  }

  console.log(
    `\nEnrichment done: ${ok} drafted, ${failed} failed (failed places are retried on the next run). ` +
      `All drafts are DRAFT/UNVERIFIED — review in \`npx prisma studio\`, flip dishes to ACTIVE/VERIFIED to publish.`
  );
}

async function writeDraft(restaurantId: string, draft: EnrichmentDraft): Promise<void> {
  await db.$transaction(async (tx) => {
    const menu = await tx.menu.create({
      data: {
        restaurantId,
        name: 'القائمة الرئيسية',
        description: 'AI-drafted typical menu — pending review',
        status: 'DRAFT',
        source: 'AI',
      },
    });

    const categories = await tx.dishCategory.findMany({
      where: { slug: { in: [...DISH_CATEGORIES] } },
    });
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
    const foodTags = await tx.foodTag.findMany({ where: { slug: { in: [...FOOD_TAGS] } } });
    const foodTagBySlug = new Map(foodTags.map((t) => [t.slug, t.id]));
    const atmospheres = await tx.atmosphereTag.findMany({
      where: { slug: { in: [...ATMOSPHERE_SLUGS] } },
    });
    const atmosphereBySlug = new Map(atmospheres.map((a) => [a.slug, a.id]));
    const cuisineRows = await tx.cuisine.findMany({
      where: { slug: { in: draft.cuisineSlugs } },
    });
    const ingredientRows = await tx.ingredient.findMany();
    const ingredientByName = new Map(ingredientRows.map((i) => [i.name.toLowerCase(), i.id]));

    for (const dish of draft.dishes) {
      const slugBase = slugify(dish.nameEn || dish.name) || 'dish';
      await tx.dish.create({
        data: {
          menuId: menu.id,
          name: dish.name,
          nameEn: dish.nameEn,
          slug: slugBase,
          description: dish.description,
          descriptionEn: dish.descriptionEn,
          price: Math.round(dish.priceEstimateEGP),
          currency: 'EGP',
          status: 'DRAFT',
          verificationStatus: 'UNVERIFIED',
          source: 'AI',
          attributes: {
            create: {
              tasteAttributes: [...dish.tasteAttributes],
              textures: dish.textures,
              mealCharacteristics: [...dish.mealCharacteristics],
              dietaryProperties: [...dish.dietaryProperties, 'HALAL' as const].filter(
                (value, index, arr) => arr.indexOf(value) === index
              ),
            },
          },
          categories: {
            create: dish.categorySlugs
              .map((slug) => categoryBySlug.get(slug))
              .filter((id): id is string => Boolean(id))
              .map((categoryId) => ({ categoryId })),
          },
          tags: {
            create: dish.foodTagSlugs
              .map((slug) => foodTagBySlug.get(slug))
              .filter((id): id is string => Boolean(id))
              .map((tagId) => ({ tagId })),
          },
          ingredients: {
            create: dish.ingredients
              .map((name) => ingredientByName.get(name.toLowerCase()))
              .filter((id): id is string => Boolean(id))
              .map((ingredientId) => ({ ingredientId })),
          },
          priceHistory: {
            create: { price: Math.round(dish.priceEstimateEGP), currency: 'EGP', source: 'AI' },
          },
        },
      });
    }

    await tx.restaurantCuisine.createMany({
      data: cuisineRows.map((c) => ({ restaurantId, cuisineId: c.id })),
      skipDuplicates: true,
    });

    await tx.restaurant.update({
      where: { id: restaurantId },
      data: {
        priceRange: draft.priceRange,
        description: draft.description,
      },
    });

    const branch = await tx.branch.findFirst({
      where: { restaurantId, status: { not: 'INACTIVE' } },
      orderBy: { createdAt: 'asc' },
    });
    if (branch && draft.atmosphereSlugs.length > 0) {
      await tx.branchAtmosphere.createMany({
        data: draft.atmosphereSlugs
          .map((slug) => atmosphereBySlug.get(slug))
          .filter((id): id is string => Boolean(id))
          .map((atmosphereTagId) => ({ branchId: branch.id, atmosphereTagId })),
        skipDuplicates: true,
      });
    }
  });
}

main()
  .catch((error) => {
    console.error('Enrichment failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
