import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/sim/state';
import { runScript } from './helpers/script';

// Small 6×4 field. Marker spawns bottom-center at (3,4). Speed is 2/tick.
const smallState = () => createGameState({ width: 6, height: 4, seed: 1 });

describe('marker on walls', () => {
  it('slides along walls at full speed', () => {
    const s = smallState();
    runScript(s, [{ dir: 'left', ticks: 1 }]);
    expect(s.marker).toEqual({ x: 1, y: 4 });
  });

  it('stops at corners and can turn along the border', () => {
    const s = smallState();
    runScript(s, [
      { dir: 'left', ticks: 5 }, // reaches (0,4) and holds
      { dir: 'up', ticks: 1 },
    ]);
    expect(s.marker).toEqual({ x: 0, y: 2 });
  });

  it('cannot leave the wall without a draw button', () => {
    const s = smallState();
    runScript(s, [{ dir: 'up', ticks: 3 }]);
    expect(s.marker).toEqual({ x: 3, y: 4 });
    expect(s.drawing).toBeNull();
  });
});

describe('drawing', () => {
  it('starts a fast draw off the wall and records the path', () => {
    const s = smallState();
    const events = runScript(s, [{ dir: 'up', fast: true, ticks: 1 }]);
    expect(s.marker).toEqual({ x: 3, y: 2 });
    expect(s.drawing?.path).toEqual([
      { x: 3, y: 4 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
    ]);
    expect(s.drawing?.classes).toEqual(['fast', 'fast']);
    expect(events.some((e) => e.type === 'drawStart')).toBe(true);
  });

  it('slow draw moves at half speed from the first tick', () => {
    const s = smallState();
    runScript(s, [{ dir: 'up', slow: true, ticks: 1 }]);
    expect(s.marker).toEqual({ x: 3, y: 3 });
    expect(s.drawing?.classes).toEqual(['slow']);
  });

  it('halts when the draw button is released mid-draw', () => {
    const s = smallState();
    runScript(s, [
      { dir: 'up', fast: true, ticks: 1 },
      { dir: 'up', ticks: 2 }, // button released
    ]);
    expect(s.marker).toEqual({ x: 3, y: 2 });
    expect(s.drawing).not.toBeNull();
    expect(s.drawing?.stalledTicks).toBe(2);
  });

  it('cannot retrace or cross its own path', () => {
    const s = smallState();
    runScript(s, [
      { dir: 'up', fast: true, ticks: 1 }, // at (3,2), path down to (3,4)
      { dir: 'down', fast: true, ticks: 2 }, // retrace: illegal, stays put
    ]);
    expect(s.marker).toEqual({ x: 3, y: 2 });
    expect(s.drawing?.stalledTicks).toBe(2);
  });

  it('a stalled marker resumes when movement becomes legal again', () => {
    const s = smallState();
    runScript(s, [
      { dir: 'up', fast: true, ticks: 1 },
      { dir: 'up', ticks: 3 },
      { dir: 'left', fast: true, ticks: 1 },
    ]);
    expect(s.marker).toEqual({ x: 1, y: 2 });
    expect(s.drawing?.stalledTicks).toBe(0);
  });
});
