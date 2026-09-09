/**
 * Canonical dish relation graph.
 *
 * Every read path that produces a "dish" for the client, for search, for
 * ranking or for recommendations crosses one of these includes, so a Prisma
 * schema change (new relation, renamed field, extra attribute) is made in one
 * place instead of six hand-maintained copies.
 */

const activeBranches = {
  where: { status: 'ACTIVE' },
  orderBy: { createdAt: 'asc' },
} as const;

const activeBranchesWithHours = {
  ...activeBranches,
  include: { operatingHours: true },
} as const;

const activeBranchesWithHoursAndAtmosphere = {
  ...activeBranches,
  include: {
    operatingHours: true,
    atmospheres: { include: { atmosphereTag: true } },
  },
} as const;

/** GET /dishes list rows — presenter only needs the first active branch. */
export const dishBrowseInclude = {
  attributes: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  ingredients: { include: { ingredient: true } },
  menu: {
    include: {
      restaurant: {
        include: {
          cuisines: { include: { cuisine: true } },
          branches: { ...activeBranches, take: 1 },
        },
      },
    },
  },
} as const;

/** GET /dishes/:id detail rows — adds price history and open-hours. */
export const dishDetailInclude = {
  attributes: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  ingredients: { include: { ingredient: true } },
  priceHistory: {
    orderBy: { effectiveFrom: 'desc' },
  },
  menu: {
    include: {
      restaurant: {
        include: {
          cuisines: { include: { cuisine: true } },
          branches: activeBranchesWithHours,
        },
      },
    },
  },
} as const;

/** Search rows — branches carry operating hours for open-now enrichment. */
export const dishSearchInclude = {
  attributes: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  ingredients: { include: { ingredient: true } },
  menu: {
    include: {
      restaurant: {
        include: {
          cuisines: { include: { cuisine: true } },
          branches: activeBranchesWithHours,
        },
      },
    },
  },
} as const;

/** Ranking candidate rows — interaction counts plus atmospheres for the AI path. */
export const dishRankingInclude = {
  attributes: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  ingredients: { include: { ingredient: true } },
  menu: {
    include: {
      restaurant: {
        include: {
          cuisines: { include: { cuisine: true } },
          branches: activeBranchesWithHoursAndAtmosphere,
        },
      },
    },
  },
  _count: {
    select: { interactions: true },
  },
} as const;
