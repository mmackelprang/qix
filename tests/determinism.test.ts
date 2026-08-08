import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng';
import { type Dir, UNCLAIMED } from '../src/sim/grid';
import { claimedPercent, createGameState, type InputSnapshot } from '../src/sim/state';
import { update } from '../src/sim/update';
import { renderAscii } from './helpers/ascii';
import { runScript, type ScriptStep } from './helpers/script';

const SCRIPT: ScriptStep[] = [
  { dir: 'left', ticks: 3 },
  { dir: 'up', fast: true, ticks: 3 },
  { dir: 'right', fast: true, ticks: 2 },
  { dir: 'up', fast: true, ticks: 2 },
  { dir: 'left', fast: true, ticks: 6 }, // completes on the left wall
  { dir: 'down', ticks: 2 },
  { dir: 'right', slow: true, ticks: 4 },
  { dir: 'down', slow: true, ticks: 8 },
  { dir: 'right', fast: true, ticks: 4 },
];

describe('determinism', () => {
  it('identical seeds and inputs produce identical final states', () => {
    const runOnce = (): { ascii: string; claimed: number; percent: number } => {
      const s = createGameState({ width: 16, height: 16, seed: 42 });
      s.mode = 'playing';
      s.qixCell = { x: 12, y: 12 };
      runScript(s, SCRIPT);
      return { ascii: renderAscii(s), claimed: s.claimedCells, percent: claimedPercent(s) };
    };
    const a = runOnce();
    const b = runOnce();
    expect(a.ascii).toBe(b.ascii);
    expect(a.claimed).toBe(b.claimed);
    expect(a.claimed).toBeGreaterThan(0);
  });
});

describe('fuzz invariants', () => {
  it('random legal play upholds core invariants for 5000 ticks', () => {
    const s = createGameState({ width: 12, height: 12, seed: 1234 });
    s.mode = 'playing';
    s.qixCell = { x: 6, y: 6 };
    // Unreachable target: keep the fuzz in 'playing' (level resets would
    // legitimately drop claimedCells and break the monotonicity check).
    s.targetPercent = 101;
    const driver = new Rng(999);
    const dirs: Dir[] = ['up', 'down', 'left', 'right'];
    let input: InputSnapshot = { dir: 'left', fast: false, slow: false };
    let lastClaimed = 0;
    for (let t = 0; t < 5000; t += 1) {
      // Re-roll held input every few ticks.
      if (driver.chance(0.2)) {
        input = {
          dir: driver.chance(0.9) ? (dirs[driver.int(4)] as Dir) : null,
          fast: driver.chance(0.5),
          slow: driver.chance(0.3),
        };
      }
      update(s, input);
      // Claimed area never decreases and matches the grid's cell count.
      expect(s.claimedCells).toBeGreaterThanOrEqual(lastClaimed);
      lastClaimed = s.claimedCells;
      // The stand-in Qix cell is never claimed (flood starts there).
      expect(s.grid.cell(s.qixCell.x, s.qixCell.y)).toBe(UNCLAIMED);
      // The marker is on a wall whenever it isn't drawing.
      if (s.drawing === null) {
        expect(s.grid.isOnWall(s.marker)).toBe(true);
      }
      // The marker stays in bounds.
      expect(s.grid.inPointBounds(s.marker)).toBe(true);
    }
    expect(s.claimedCells).toBe(s.grid.claimedCount());
  });
});
