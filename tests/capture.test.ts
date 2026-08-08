import { describe, expect, it } from 'vitest';
import { CLAIMED_SLOW } from '../src/sim/grid';
import { claimedPercent, createGameState } from '../src/sim/state';
import { normalize, renderAscii } from './helpers/ascii';
import { runScript } from './helpers/script';

// 6×4 field, marker spawns bottom-center (3,4), speed 2/tick.
// Qix stand-in cell defaults to field center (3,2) — tests reposition it.
const smallState = () => {
  const s = createGameState({ width: 6, height: 4, seed: 1 });
  s.mode = 'playing';
  s.qixCell = { x: 4, y: 1 };
  return s;
};

describe('capture', () => {
  it('a straight line claims the side without the Qix', () => {
    const s = smallState();
    const events = runScript(s, [{ dir: 'up', fast: true, ticks: 2 }]);
    expect(renderAscii(s)).toBe(
      normalize(`
        + + + M#+#+#+
         F F F#. . .#
        + + + + + + +
         F F F#. Q .#
        + + + + + + +
         F F F#. . .#
        + + + + + + +
         F F F#. . .#
        + + + +#+#+#+
      `),
    );
    expect(s.claimedCells).toBe(12);
    expect(claimedPercent(s)).toBe(50);
    const claim = events.find((e) => e.type === 'claim');
    expect(claim).toMatchObject({ deltaCells: 12, cls: 'fast' });
  });

  it('an L-shaped path claims the enclosed corner box', () => {
    const s = smallState();
    s.qixCell = { x: 4, y: 0 };
    const events = runScript(s, [
      { dir: 'up', fast: true, ticks: 1 }, // (3,4) → (3,2)
      { dir: 'left', fast: true, ticks: 2 }, // → (0,2), completes on left wall
    ]);
    expect(renderAscii(s)).toBe(
      normalize(`
        +#+#+#+#+#+#+
        #. . . . Q .#
        + + + + + + +
        #. . . . . .#
        M#+#+#+ + + +
         F F F#. . .#
        + + + + + + +
         F F F#. . .#
        + + + +#+#+#+
      `),
    );
    expect(s.claimedCells).toBe(6);
    expect(claimedPercent(s)).toBe(25);
    expect(events.find((e) => e.type === 'claim')).toMatchObject({
      deltaCells: 6,
      cls: 'fast',
    });
  });

  it('any slow segment makes the whole claim slow (2x class)', () => {
    const s = smallState();
    const events = runScript(s, [
      { dir: 'up', slow: true, ticks: 1 }, // one slow edge
      { dir: 'up', fast: true, ticks: 2 }, // fast the rest of the way
    ]);
    expect(s.drawing).toBeNull();
    expect(events.find((e) => e.type === 'claim')).toMatchObject({ cls: 'slow' });
    expect(s.grid.cell(0, 0)).toBe(CLAIMED_SLOW);
  });

  it('claimed regions absorb old walls — even the field border', () => {
    const s = smallState();
    runScript(s, [{ dir: 'up', fast: true, ticks: 2 }]); // claim left half
    // Ride the top wall right, then draw down the x=5 line.
    runScript(s, [
      { dir: 'right', ticks: 1 }, // (3,0) → (5,0)
      { dir: 'down', fast: true, ticks: 2 }, // → (5,4), claims column x=5
    ]);
    expect(s.claimedCells).toBe(16);
    // New claim boundary is a wall...
    expect(s.grid.vWall(5, 1)).toBe(true);
    // ...but the old field border right of the claimed column is absorbed.
    expect(s.grid.vWall(6, 1)).toBe(false);
    // And the first claim's boundary at x=3 still stands (claimed|unclaimed).
    expect(s.grid.vWall(3, 1)).toBe(true);
  });

  it('claim percentage accumulates across claims', () => {
    const s = smallState();
    const first = runScript(s, [{ dir: 'up', fast: true, ticks: 2 }]);
    const second = runScript(s, [
      { dir: 'right', ticks: 1 },
      { dir: 'down', fast: true, ticks: 2 },
    ]);
    const p1 = first.find((e) => e.type === 'claim');
    const p2 = second.find((e) => e.type === 'claim');
    expect(p1?.type === 'claim' && p1.deltaPercent).toBeCloseTo(50);
    expect(p2?.type === 'claim' && p2.deltaPercent).toBeCloseTo(100 / 6);
    expect(claimedPercent(s)).toBeCloseTo(50 + 100 / 6);
  });

  it('the marker ends on the new unclaimed-region boundary after a claim', () => {
    const s = smallState();
    runScript(s, [{ dir: 'up', fast: true, ticks: 2 }]);
    expect(s.grid.isOnWall(s.marker)).toBe(true);
    expect(s.drawing).toBeNull();
  });
});
