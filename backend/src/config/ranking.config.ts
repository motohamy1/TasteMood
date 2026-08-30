export interface RankingWeights {
  preferenceMatch: number;
  priceMatch: number;
  distanceScore: number;
  tasteMatch: number;
  popularity: number;
  freshness: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  preferenceMatch: 0.30,
  priceMatch: 0.20,
  distanceScore: 0.15,
  tasteMatch: 0.15,
  popularity: 0.10,
  freshness: 0.10,
};

export const SURPRISE_MODE_WEIGHTS: RankingWeights = {
  preferenceMatch: 0.10,
  priceMatch: 0.20,
  distanceScore: 0.20,
  tasteMatch: 0.20,
  popularity: 0.10,
  freshness: 0.20,
};
