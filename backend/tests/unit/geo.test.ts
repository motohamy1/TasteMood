import { describe, it, expect } from 'vitest';
import { calculateHaversineDistanceKm, getBoundingBox } from '../../src/common/utils/geo.utils.js';

describe('Geo Utilities', () => {
  it('correctly calculates distance between Zamalek and Maadi in Cairo (~11-13 km)', () => {
    const zamalek = { lat: 30.0609, lng: 31.2197 };
    const maadi = { lat: 29.9602, lng: 31.2825 };

    const distance = calculateHaversineDistanceKm(
      zamalek.lat,
      zamalek.lng,
      maadi.lat,
      maadi.lng
    );

    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(15);
  });

  it('returns 0 distance for identical coordinates', () => {
    const dist = calculateHaversineDistanceKm(30.0, 31.0, 30.0, 31.0);
    expect(dist).toBe(0);
  });

  it('generates a valid bounding box around Cairo center', () => {
    const box = getBoundingBox(30.0444, 31.2357, 5);
    expect(box.minLat).toBeLessThan(30.0444);
    expect(box.maxLat).toBeGreaterThan(30.0444);
    expect(box.minLng).toBeLessThan(31.2357);
    expect(box.maxLng).toBeGreaterThan(31.2357);
  });
});
