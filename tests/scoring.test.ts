import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/events';
import { checkThreshold, scoreClaim } from '../src/sim/scoring';
import { createGameState } from '../src/sim/state';

const state = () => {
  const s = createGameState({ width: 100, height: 100, seed: 1 });
  s.mode = 'playing';
  return s;
};

describe('claim scoring (PRD §4.4)', () => {
  it('fast claims score percent × 100 at 0.01% resolution', () => {
    const s = state();
    expect(scoreClaim(s, 5, 'fast')).toBe(500);
    expect(scoreClaim(s, 5.25, 'fast')).toBe(525);
    expect(s.score).toBe(1025);
  });

  it('slow claims score percent × 200', () => {
    const s = state();
    expect(scoreClaim(s, 5, 'slow')).toBe(1000);
    expect(scoreClaim(s, 0.07, 'slow')).toBe(14);
  });

  it('the global multiplier scales claim scores', () => {
    const s = state();
    s.multiplier = 3;
    expect(scoreClaim(s, 10, 'fast')).toBe(3000);
    expect(scoreClaim(s, 10, 'slow')).toBe(6000);
  });
});

describe('threshold (PRD §4.3–4.4)', () => {
  it('does nothing below the target', () => {
    const s = state();
    s.claimedCells = 74 * 100; // 74%
    const events: SimEvent[] = [];
    expect(checkThreshold(s, events)).toBe(false);
    expect(s.mode).toBe('playing');
    expect(events).toHaveLength(0);
  });

  it('ends the level at the target with (over − target) × 1000 bonus', () => {
    const s = state();
    s.claimedCells = 80 * 100 + 50; // 80.5%
    const events: SimEvent[] = [];
    expect(checkThreshold(s, events)).toBe(true);
    expect(s.mode).toBe('levelClear');
    expect(s.score).toBe(5000); // (80 − 75) × 1000
    const e = events.find((ev) => ev.type === 'levelClear');
    expect(e).toMatchObject({ bonus: 5000 });
  });

  it('awards zero bonus when finishing exactly at target', () => {
    const s = state();
    s.claimedCells = 75 * 100;
    const events: SimEvent[] = [];
    expect(checkThreshold(s, events)).toBe(true);
    expect(s.score).toBe(0);
  });

  it('applies the multiplier to the threshold bonus', () => {
    const s = state();
    s.multiplier = 2;
    s.claimedCells = 80 * 100;
    const events: SimEvent[] = [];
    checkThreshold(s, events);
    expect(s.score).toBe(10_000);
  });

  it('respects a custom operator target', () => {
    const s = state();
    s.targetPercent = 60;
    s.claimedCells = 62 * 100;
    const events: SimEvent[] = [];
    expect(checkThreshold(s, events)).toBe(true);
    expect(s.score).toBe(2000);
  });
});
