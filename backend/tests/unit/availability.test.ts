import { describe, expect, it } from 'vitest';
import { isBranchOpenAt } from '../../src/modules/branches/availability.js';

describe('branch opening status', () => {
  const mondayAtNoon = new Date(2026, 8, 28, 12, 0);

  it('returns unknown when operating hours are absent', () => {
    expect(isBranchOpenAt(undefined, mondayAtNoon)).toBeNull();
    expect(isBranchOpenAt([], mondayAtNoon)).toBeNull();
  });

  it('checks a declared shift against the current local time', () => {
    const mondayHours = [
      { dayOfWeek: mondayAtNoon.getDay(), openTime: '09:00', closeTime: '17:00', isClosed: false },
    ];
    const outsideShift = new Date(2026, 8, 28, 18, 0);

    expect(isBranchOpenAt(mondayHours, mondayAtNoon)).toBe(true);
    expect(isBranchOpenAt(mondayHours, outsideShift)).toBe(false);
  });
});
