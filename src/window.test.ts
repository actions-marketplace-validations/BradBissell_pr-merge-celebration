import { describe, it, expect } from 'vitest';
import { computeEffectiveMergeWindow } from './window';

describe('computeEffectiveMergeWindow', () => {
  // Local-time construction so getDay() returns deterministic results
  // regardless of the runner's TZ. 2024-01-08 was a Monday.
  const monday = new Date(2024, 0, 8, 12, 0, 0);
  const tuesday = new Date(2024, 0, 9, 12, 0, 0);
  const friday = new Date(2024, 0, 12, 12, 0, 0);
  const saturday = new Date(2024, 0, 13, 12, 0, 0);
  const sunday = new Date(2024, 0, 14, 12, 0, 0);

  it('returns baseHours unchanged when catchup disabled, even on Monday', () => {
    expect(computeEffectiveMergeWindow(24, false, monday)).toBe(24);
    expect(computeEffectiveMergeWindow(12, false, monday)).toBe(12);
  });

  it('extends by 48h on Monday when catchup enabled', () => {
    expect(computeEffectiveMergeWindow(24, true, monday)).toBe(72);
    expect(computeEffectiveMergeWindow(12, true, monday)).toBe(60);
  });

  it('does not extend on Tuesday-Friday with catchup enabled', () => {
    expect(computeEffectiveMergeWindow(24, true, tuesday)).toBe(24);
    expect(computeEffectiveMergeWindow(24, true, friday)).toBe(24);
  });

  it('does not extend on Saturday or Sunday with catchup enabled', () => {
    expect(computeEffectiveMergeWindow(24, true, saturday)).toBe(24);
    expect(computeEffectiveMergeWindow(24, true, sunday)).toBe(24);
  });
});
