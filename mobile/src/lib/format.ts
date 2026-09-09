/**
 * Pure display formatters. Kept out of components so they are unit-testable
 * and shared by every card/detail surface (previously duplicated inline in
 * dish-card, recommendation-card, featured-card and dish/[id]).
 */

export function formatPrice(value: number, currency: string): string {
  return `${value.toFixed(0)} ${currency}`;
}

export function formatDistance(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
