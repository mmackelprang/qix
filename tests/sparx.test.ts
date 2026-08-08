import { describe, expect, it } from 'vitest';
import { TIMING } from '../src/config';
import type { SimEvent } from '../src/sim/events';
import { resolveDeath } from '../src/sim/levels';
import { snapSparxToWalls, sparxTouchesPlayer, updateSparx } from '../src/sim/sparx';
import { createGameState, IDLE_INPUT } from '../src/sim/state';
import { update } from '../src/sim/update';
import { runScript } from './helpers/script';

const freshGame = (seed = 3) => {
  const s = createGameState({ width: 32, height: 32, seed, speedPercent: 200 });
  for (let t = 0; t < TIMING.levelIntro; t += 1) update(s, IDLE_INPUT);
  s.qixes = []; // isolate sparx behavior
  s.qixCell = { x: 24, y: 8 };
  return s;
};

const bare = (seed = 3) => {
  const s = createGameState({ width: 32, height: 32, seed, speedPercent: 200 });
  s.mode = 'playing';
  s.qixes = [];
  s.qixCell = { x: 24, y: 8 };
  return s;
};

describe('sparx patrol', () => {
  it('spawns two at top-center heading opposite ways at level start', () => {
    const s = freshGame();
    expect(s.sparx).toHaveLength(2);
    for (let t = 0; t < 5; t += 1) update(s, IDLE_INPUT);
    const xs = s.sparx.map((sp) => sp.pos.x).sort((a, b) => a - b);
    expect(xs).toEqual([6, 26]); // 16 ± 10 along the top wall (2 units/tick at 200%)
    expect(s.sparx.every((sp) => sp.pos.y === 0)).toBe(true);
  });

  it('follows the border around corners without reversing', () => {
    const s = freshGame();
    // Right-going sparx at 2 units/tick: 16 units to the corner (32,0)
    // by tick 8, then 24 down the right wall by tick 20.
    for (let t = 0; t < 20; t += 1) update(s, IDLE_INPUT);
    const right = s.sparx.find((sp) => sp.pos.x === 32 || sp.pos.x > 16);
    expect(right).toBeDefined();
    expect(right?.pos).toEqual({ x: 32, y: 24 });
  });

  it('kills the player on contact, including same-tick swaps', () => {
    const s = bare();
    s.sparx = [{ pos: { x: 16, y: 32 }, prev: { x: 17, y: 32 }, isSuper: false, stixIndex: null }];
    const events: SimEvent[] = [];
    expect(sparxTouchesPlayer(s, events)).toBe(true);
    expect(events).toContainEqual({ type: 'death', cause: 'sparx' });

    // Swap: sparx moved through the marker while the marker moved through it.
    const s2 = bare();
    s2.marker = { x: 10, y: 32 };
    s2.markerPrev = { x: 11, y: 32 };
    s2.sparx = [{ pos: { x: 11, y: 32 }, prev: { x: 10, y: 32 }, isSuper: false, stixIndex: null }];
    const events2: SimEvent[] = [];
    expect(sparxTouchesPlayer(s2, events2)).toBe(true);
  });
});

describe('sparx time line (PRD §4.6)', () => {
  it('spawns a new wave when the timer expires', () => {
    const s = freshGame();
    s.sparxTimer = 3;
    const events: SimEvent[] = [];
    updateSparx(s, events);
    updateSparx(s, events);
    updateSparx(s, events);
    expect(s.sparx).toHaveLength(4);
    expect(s.sparxExpiries).toBe(1);
    expect(s.sparxTimer).toBe(s.sparxTimeS * 60);
    expect(events).toContainEqual({ type: 'sparxSpawn', count: 2, isSuper: false });
    expect(s.sparx.every((sp) => !sp.isSuper)).toBe(true);
  });

  it('turns all sparx Super on the second expiry', () => {
    const s = freshGame();
    s.sparxExpiries = 1;
    s.sparxTimer = 1;
    const events: SimEvent[] = [];
    updateSparx(s, events);
    expect(events).toContainEqual({ type: 'superSparx' });
    expect(s.sparx.every((sp) => sp.isSuper)).toBe(true);
    expect(s.sparx).toHaveLength(4);
  });

  it('death despawns extra sparx and restarts the timer', () => {
    const s = freshGame();
    s.sparxTimer = 1;
    updateSparx(s, []);
    expect(s.sparx).toHaveLength(4);
    s.sparxTimer = 500;
    s.drawing = null;
    resolveDeath(s, []);
    expect(s.sparx).toHaveLength(2);
    expect(s.sparxTimer).toBe(s.sparxTimeS * 60);
    expect(s.sparxExpiries).toBe(0);
    expect(s.lives).toBe(2);
  });
});

describe('super sparx stix chase (TD §5.6)', () => {
  it('transfers onto the incomplete stix and hunts down the marker', () => {
    const s = bare();
    runScript(s, [{ dir: 'up', fast: true, ticks: 4 }]); // path (16,32) → (16,24)
    expect(s.drawing?.path).toHaveLength(9);
    s.sparx = [{ pos: { x: 16, y: 32 }, prev: { x: 17, y: 32 }, isSuper: true, stixIndex: null }];
    // The chaser advances 1/tick along the 8-edge path; the marker stalls.
    let dead = false;
    for (let t = 0; t < 12 && !dead; t += 1) {
      const events = update(s, IDLE_INPUT);
      dead = events.some((e) => e.type === 'death' && e.cause === 'sparx');
    }
    expect(dead).toBe(true);
    expect(s.mode).toBe('death');
  });

  it('normal sparx never walk the stix', () => {
    const s = bare();
    runScript(s, [{ dir: 'up', fast: true, ticks: 4 }]);
    s.sparx = [{ pos: { x: 16, y: 32 }, prev: { x: 17, y: 32 }, isSuper: false, stixIndex: null }];
    for (let t = 0; t < 6; t += 1) update(s, IDLE_INPUT);
    const sp = s.sparx[0];
    expect(sp?.stixIndex).toBeNull();
    expect(sp?.pos.y).toBe(32); // still on the bottom wall
  });
});

describe('sparx wall-snap after capture (TD §12)', () => {
  it('re-homes a sparx whose wall vanished into a claim', () => {
    const s = bare();
    // Claim the left half: line up at x=16 with the qix on the right.
    runScript(s, [{ dir: 'up', fast: true, ticks: 16 }]);
    expect(s.claimedCells).toBe(16 * 32);
    // Plant a sparx inside the claimed region (its wall vanished).
    s.sparx = [{ pos: { x: 2, y: 8 }, prev: { x: 2, y: 8 }, isSuper: false, stixIndex: null }];
    snapSparxToWalls(s);
    const sp = s.sparx[0];
    expect(sp).toBeDefined();
    if (sp) expect(s.grid.isOnWall(sp.pos)).toBe(true);
  });
});
