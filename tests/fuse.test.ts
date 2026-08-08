import { describe, expect, it } from 'vitest';
import { FUSE } from '../src/config';
import type { SimEvent } from '../src/sim/events';
import { hasLegalDrawMove } from '../src/sim/player';
import { createGameState, IDLE_INPUT, type InputSnapshot } from '../src/sim/state';
import { update } from '../src/sim/update';
import { runScript } from './helpers/script';

const bare = (seed = 3) => {
  const s = createGameState({ width: 32, height: 32, seed });
  s.mode = 'playing';
  s.qixes = [];
  s.sparx = [];
  s.qixCell = { x: 24, y: 8 };
  return s;
};

const collect = (s: ReturnType<typeof bare>, ticks: number, input: InputSnapshot = IDLE_INPUT) => {
  const events: SimEvent[] = [];
  for (let t = 0; t < ticks; t += 1) events.push(...update(s, input));
  return events;
};

describe('the fuse (TD §5.7)', () => {
  it('hisses immediately on stall but only ignites after ~1 second', () => {
    const s = bare();
    runScript(s, [{ dir: 'up', fast: true, ticks: 5 }]); // drawing, then stall
    const first = collect(s, 1);
    expect(first).toContainEqual({ type: 'fuseStart' });
    expect(s.fuse?.burning).toBe(false);
    const later = collect(s, FUSE.igniteTicks);
    expect(later).toContainEqual({ type: 'fuseIgnite' });
    expect(s.fuse?.burning).toBe(true);
  });

  it('burns along the path and kills the stalled player', () => {
    const s = bare();
    runScript(s, [{ dir: 'up', fast: true, ticks: 5 }]); // 10-edge path
    const events = collect(s, FUSE.igniteTicks + 10 * FUSE.stepDiv + 2);
    expect(events).toContainEqual({ type: 'death', cause: 'fuse' });
    expect(s.mode).toBe('death');
  });

  it('pauses when the player moves and resumes from where it stopped', () => {
    const s = bare();
    runScript(s, [{ dir: 'up', fast: true, ticks: 6 }]);
    // Stall long enough to burn a few edges.
    collect(s, FUSE.igniteTicks + 6);
    const progress = s.fuse?.edgeIndex ?? 0;
    expect(progress).toBeGreaterThan(0);
    expect(s.fuse?.burning).toBe(true);
    // Move again: fuse hides but retains progress.
    const moveEvents = collect(s, 2, { dir: 'up', fast: true, slow: false });
    expect(moveEvents).toContainEqual({ type: 'fuseStop' });
    expect(s.fuse?.burning).toBe(false);
    expect(s.fuse?.edgeIndex).toBe(progress);
    // Stall again: it resumes burning from the retained position at once.
    collect(s, FUSE.stepDiv + 1);
    expect(s.fuse?.burning).toBe(true);
    expect(s.fuse?.edgeIndex).toBeGreaterThan(progress);
  });

  it('is extinguished for good by completing the claim', () => {
    const s = bare();
    runScript(s, [{ dir: 'up', fast: true, ticks: 5 }]);
    collect(s, FUSE.igniteTicks + 4); // burning
    expect(s.fuse?.burning).toBe(true);
    // Finish the line to the top wall.
    const events = collect(s, 20, { dir: 'up', fast: true, slow: false });
    expect(events.some((e) => e.type === 'claim')).toBe(true);
    expect(s.fuse).toBeNull();
    expect(s.mode).toBe('playing');
  });
});

describe('spiral death trap (PRD §4.6)', () => {
  it('a self-sealed marker has no legal moves and dies to the fuse', () => {
    const s = bare();
    // Spiral into a dead end: up, left, down, right (blocked short), up
    // (blocked short) — every direction now touches the path.
    runScript(s, [
      { dir: 'up', fast: true, ticks: 2 }, // (16,32) → (16,28)
      { dir: 'left', fast: true, ticks: 1 }, // → (14,28)
      { dir: 'down', fast: true, ticks: 1 }, // → (14,30)
      { dir: 'right', fast: true, ticks: 1 }, // → (15,30): (16,30) is path
      { dir: 'up', fast: true, ticks: 1 }, // → (15,29): (15,28)? no — (14..16,28) row blocks
    ]);
    expect(s.drawing).not.toBeNull();
    expect(hasLegalDrawMove(s)).toBe(false);
    // Trying every direction moves nothing…
    const stuckEvents: SimEvent[] = [];
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      stuckEvents.push(...collect(s, 2, { dir, fast: true, slow: false }));
    }
    // …and the fuse finishes the job.
    const events = collect(s, FUSE.igniteTicks + 40 * FUSE.stepDiv);
    const all = [...stuckEvents, ...events];
    expect(all).toContainEqual({ type: 'death', cause: 'fuse' });
    expect(s.mode).toBe('death');
  });
});
