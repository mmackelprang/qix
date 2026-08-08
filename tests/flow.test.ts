import { describe, expect, it } from 'vitest';
import { TIMING } from '../src/config';
import { createGameState, IDLE_INPUT } from '../src/sim/state';
import { update } from '../src/sim/update';
import { runScript } from './helpers/script';

describe('game flow (TD §5.8)', () => {
  it('runs levelIntro then hands control to playing', () => {
    const s = createGameState({ width: 32, height: 32, seed: 3, speedPercent: 200 });
    for (let t = 0; t < TIMING.levelIntro; t += 1) update(s, IDLE_INPUT);
    expect(s.mode).toBe('playing');
    expect(s.qixes).toHaveLength(1);
    expect(s.level).toBe(1);
  });

  it('level clear advances to the next level after the tally', () => {
    const s = createGameState({
      width: 32,
      height: 32,
      seed: 3,
      targetPercent: 20,
      speedPercent: 200,
    });
    for (let t = 0; t < TIMING.levelIntro; t += 1) update(s, IDLE_INPUT);
    // Remove the qix from play and claim enough to pass the 20% target.
    s.qixes = [];
    s.qixCell = { x: 24, y: 8 };
    runScript(s, [
      { dir: 'left', ticks: 4 }, // (16,32) → (8,32)
      { dir: 'up', fast: true, ticks: 16 }, // draw to the top: claims left of x=8: 25%
    ]);
    expect(s.mode).toBe('levelClear');
    const scoreAtClear = s.score;
    expect(scoreAtClear).toBe(2500 + 5000); // 25% fast + (25−20)×1000
    for (let t = 0; t < TIMING.levelClear + 1; t += 1) update(s, IDLE_INPUT);
    expect(s.mode).toBe('levelIntro');
    expect(s.level).toBe(2);
    expect(s.claimedCells).toBe(0);
    expect(s.qixes).toHaveLength(1);
    expect(s.score).toBe(scoreAtClear); // score persists across levels
  });

  it('death mid-draw erases the stix and respawns at the draw origin', () => {
    const s = createGameState({ width: 32, height: 32, seed: 3, speedPercent: 200 });
    for (let t = 0; t < TIMING.levelIntro; t += 1) update(s, IDLE_INPUT);
    s.qixes = [];
    s.sparx = [];
    s.qixCell = { x: 24, y: 8 };
    runScript(s, [{ dir: 'up', fast: true, ticks: 3 }]); // drawing at (16, 26)
    expect(s.drawing).not.toBeNull();
    // Stall: the fuse ignites and burns the 6-edge path — deterministic death.
    for (let t = 0; t < 100 && s.mode === 'playing'; t += 1) update(s, IDLE_INPUT);
    expect(s.mode).toBe('death');
    for (let t = 0; t < TIMING.death + 1; t += 1) update(s, IDLE_INPUT);
    expect(s.mode).toBe('playing');
    expect(s.lives).toBe(2);
    expect(s.drawing).toBeNull();
    expect(s.marker).toEqual({ x: 16, y: 32 }); // back where the stix began
  });

  it('losing the last life ends the game', () => {
    const s = createGameState({ width: 32, height: 32, seed: 3, speedPercent: 200 });
    s.lives = 1;
    for (let t = 0; t < TIMING.levelIntro; t += 1) update(s, IDLE_INPUT);
    s.qixes = [];
    s.sparx = [];
    s.qixCell = { x: 24, y: 8 };
    runScript(s, [{ dir: 'up', fast: true, ticks: 3 }]);
    for (let t = 0; t < 100 && s.mode === 'playing'; t += 1) update(s, IDLE_INPUT);
    expect(s.mode).toBe('death');
    for (let t = 0; t < TIMING.death + 1; t += 1) update(s, IDLE_INPUT);
    expect(s.mode).toBe('gameOver');
    expect(s.lives).toBe(0);
  });
});
