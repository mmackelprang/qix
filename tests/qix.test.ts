import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/events';
import { UNCLAIMED } from '../src/sim/grid';
import { createQix, qixTouchesPlayer, updateQix } from '../src/sim/qix';
import { createGameState } from '../src/sim/state';

const playingState = (seed = 5) => {
  const s = createGameState({ width: 64, height: 64, seed });
  s.mode = 'playing';
  return s;
};

describe('Qix motion', () => {
  it('stays inside the unclaimed region for 2000 ticks', () => {
    const s = playingState();
    const qix = createQix(s, { x: 32, y: 16 });
    s.qixes = [qix];
    for (let t = 0; t < 2000; t += 1) {
      updateQix(s, qix);
      for (const ep of [qix.a, qix.b]) {
        const cx = Math.min(63, Math.max(0, Math.floor(ep.x)));
        const cy = Math.min(63, Math.max(0, Math.floor(ep.y)));
        expect(s.grid.cell(cx, cy)).toBe(UNCLAIMED);
      }
      expect(s.grid.cell(s.qixCell.x, s.qixCell.y)).toBe(UNCLAIMED);
    }
  });

  it('is deterministic under a fixed seed', () => {
    const run = (): string => {
      const s = playingState(77);
      const qix = createQix(s, { x: 32, y: 16 });
      for (let t = 0; t < 500; t += 1) updateQix(s, qix);
      return JSON.stringify([qix.a, qix.b, qix.colorIdx]);
    };
    expect(run()).toBe(run());
  });

  it('builds a bounded trail', () => {
    const s = playingState();
    const qix = createQix(s, { x: 32, y: 16 });
    for (let t = 0; t < 100; t += 1) updateQix(s, qix);
    expect(qix.trail.length).toBeGreaterThan(0);
    expect(qix.trail.length).toBeLessThanOrEqual(12);
  });
});

describe('Qix collision', () => {
  it('kills when its line crosses the incomplete stix', () => {
    const s = playingState();
    const qix = createQix(s, { x: 32, y: 32 });
    // Player drawing a vertical line at x=20, y from 64 up to 30.
    const path = [];
    for (let y = 64; y >= 30; y -= 1) path.push({ x: 20, y });
    s.drawing = { path, classes: new Array(path.length - 1).fill('fast'), stalledTicks: 0 };
    s.marker = { x: 20, y: 30 };
    // Force the qix line to lie across the stix.
    qix.a = { ...qix.a, x: 10, y: 40 };
    qix.b = { ...qix.b, x: 30, y: 40 };
    const events: SimEvent[] = [];
    expect(qixTouchesPlayer(s, qix, events)).toBe(true);
    expect(events).toContainEqual({ type: 'death', cause: 'qix' });
  });

  it('kills when its line touches the marker itself', () => {
    const s = playingState();
    const qix = createQix(s, { x: 32, y: 32 });
    s.drawing = {
      path: [
        { x: 20, y: 64 },
        { x: 20, y: 63 },
      ],
      classes: ['fast'],
      stalledTicks: 0,
    };
    s.marker = { x: 20, y: 63 };
    qix.a = { ...qix.a, x: 10, y: 63 };
    qix.b = { ...qix.b, x: 30, y: 63 };
    const events: SimEvent[] = [];
    expect(qixTouchesPlayer(s, qix, events)).toBe(true);
  });

  it('is harmless while the player rides walls', () => {
    const s = playingState();
    const qix = createQix(s, { x: 32, y: 32 });
    s.drawing = null;
    s.marker = { x: 32, y: 64 };
    qix.a = { ...qix.a, x: 32, y: 60 };
    qix.b = { ...qix.b, x: 32, y: 64 }; // touching the marker's position
    const events: SimEvent[] = [];
    expect(qixTouchesPlayer(s, qix, events)).toBe(false);
    expect(events).toHaveLength(0);
  });
});
