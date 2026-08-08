import { describe, expect, it } from 'vitest';
import { difficultyFor, TIMING } from '../src/config';
import type { SimEvent } from '../src/sim/events';
import { updatePlayer } from '../src/sim/player';
import { createQix } from '../src/sim/qix';
import { createGameState, IDLE_INPUT } from '../src/sim/state';
import { update } from '../src/sim/update';
import type { ScriptStep } from './helpers/script';

/**
 * Drive only the player (marker + capture) — the qix stay pinned so split
 * geometry is exact. Enemy integration is covered by update()-level tests.
 */
const drawScript = (s: ReturnType<typeof createGameState>, steps: ScriptStep[]): SimEvent[] => {
  const events: SimEvent[] = [];
  for (const step of steps) {
    for (let t = 0; t < step.ticks; t += 1) {
      updatePlayer(
        s,
        { dir: step.dir ?? null, fast: step.fast ?? false, slow: step.slow ?? false },
        events,
      );
    }
  }
  return events;
};

/** A playing state with two stationary qix parked on opposite sides. */
const twoQixState = () => {
  const s = createGameState({ width: 32, height: 32, seed: 9, speedPercent: 200 });
  s.mode = 'playing';
  s.level = 3;
  s.sparx = [];
  const left = createQix(s, { x: 8, y: 8 });
  const right = createQix(s, { x: 24, y: 8 });
  s.qixes = [left, right];
  s.qixCell = { ...left.cell };
  return s;
};

describe('difficulty table (PRD §4.8)', () => {
  it('fields one qix on levels 1–2 and two from level 3', () => {
    expect(difficultyFor(1).qixCount).toBe(1);
    expect(difficultyFor(2).qixCount).toBe(1);
    expect(difficultyFor(3).qixCount).toBe(2);
    expect(difficultyFor(9).qixCount).toBe(2);
  });

  it('scales speeds monotonically with caps', () => {
    expect(difficultyFor(1).qixSpeedScale).toBe(1);
    expect(difficultyFor(5).qixSpeedScale).toBeGreaterThan(1);
    expect(difficultyFor(99).qixSpeedScale).toBeLessThanOrEqual(1.8);
    expect(difficultyFor(1).sparxSpeedBonus).toBe(0);
    expect(difficultyFor(5).sparxSpeedBonus).toBe(1);
  });

  it('accelerates super sparx at high levels', () => {
    expect(difficultyFor(1).superAfterExpiries).toBe(2);
    expect(difficultyFor(7).superAfterExpiries).toBe(1);
  });

  it('level 3 starts with two qix in play', () => {
    const s = createGameState({ width: 64, height: 64, seed: 4 });
    s.level = 3;
    for (let t = 0; t < TIMING.levelIntro; t += 1) update(s, IDLE_INPUT);
    expect(s.qixes).toHaveLength(2);
  });
});

describe('split-the-Qix (PRD §4.7)', () => {
  it('separating the qix ends the level and bumps the multiplier — no fill', () => {
    const s = twoQixState();
    // Draw straight up the middle: left qix on one side, right on the other.
    const events = drawScript(s, [{ dir: 'up', fast: true, ticks: 16 }]);
    const split = events.find((e) => e.type === 'split');
    expect(split).toMatchObject({ multiplier: 2 });
    expect(s.mode).toBe('levelClear');
    expect(s.multiplier).toBe(2);
    // No territory was filled and no claim points were scored.
    expect(s.claimedCells).toBe(0);
    expect(s.score).toBe(0);
    expect(events.some((e) => e.type === 'claim')).toBe(false);
  });

  it('a claim with both qix on the same side fills normally', () => {
    const s = twoQixState();
    // A small bottom-left corner box: both qix (at y=8) are outside it and
    // remain connected to each other, so this is a normal fill.
    const events = drawScript(s, [
      { dir: 'left', ticks: 8 }, // (16,32) → (0,32) corner
      { dir: 'up', ticks: 2 }, // ride up the left wall → (0,28)
      { dir: 'right', fast: true, ticks: 2 }, // draw right → (4,28)
      { dir: 'down', fast: true, ticks: 2 }, // → (4,32): completes
    ]);
    expect(events.some((e) => e.type === 'split')).toBe(false);
    const claim = events.find((e) => e.type === 'claim');
    expect(claim).toMatchObject({ deltaCells: 16 });
    expect(s.mode).toBe('playing');
    expect(s.multiplier).toBe(1);
  });

  it('the multiplier caps at 9x', () => {
    const s = twoQixState();
    s.multiplier = 9;
    drawScript(s, [{ dir: 'up', fast: true, ticks: 16 }]);
    expect(s.multiplier).toBe(9);
  });

  it('the multiplier persists into the next level', () => {
    const s = twoQixState();
    drawScript(s, [{ dir: 'up', fast: true, ticks: 16 }]);
    expect(s.mode).toBe('levelClear');
    for (let t = 0; t < TIMING.levelClear + 1; t += 1) update(s, IDLE_INPUT);
    expect(s.level).toBe(4);
    expect(s.multiplier).toBe(2);
    expect(s.qixes).toHaveLength(2);
  });
});
