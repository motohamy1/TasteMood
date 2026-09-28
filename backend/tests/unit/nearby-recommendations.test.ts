import { describe, expect, it } from 'vitest';
import {
  selectRankedCandidates,
  type ScoredCandidate,
} from '../../src/modules/recommendations/ranking.service.js';

function candidate(
  dishId: string,
  branchName: string,
  distanceKm: number | undefined,
  score: number
): ScoredCandidate {
  return {
    dish: { id: dishId, name: dishId, price: 100 },
    restaurant: { name: 'Food place' },
    branch: { name: branchName },
    distanceKm,
    score,
    scoreBreakdown: {
      preferenceMatch: 0,
      priceMatch: 0,
      distanceScore: 0,
      tasteMatch: 0,
      popularity: 0,
      freshness: 0,
    },
  };
}

describe('nearby recommendation ordering', () => {
  it('selects the closest branch per dish before filling the requested count', () => {
    const selected = selectRankedCandidates(
      [
        candidate('far', 'Far branch', 8, 0.99),
        candidate('repeat', 'Further branch', 2, 0.9),
        candidate('repeat', 'Closest branch', 0.5, 0.2),
        candidate('middle', 'Middle branch', 1, 0.7),
      ],
      3,
      true
    );

    expect(selected.map((entry) => entry.dish.id)).toEqual(['repeat', 'middle', 'far']);
    expect(selected[0].branch.name).toBe('Closest branch');
  });

  it('keeps relevance ordering when nearest-first mode is off', () => {
    const selected = selectRankedCandidates(
      [candidate('far', 'Far branch', 8, 0.99), candidate('near', 'Near branch', 0.5, 0.2)],
      2
    );

    expect(selected.map((entry) => entry.dish.id)).toEqual(['far', 'near']);
  });
});
