import { Rng } from '../rng';
import type { Dir } from '../sim/grid';
import type { GameState, InputSnapshot } from '../sim/state';

/**
 * Attract-mode demo driver (TD §9): a deterministic heuristic bot behind
 * the same InputSnapshot interface as a human. It rides the border and
 * periodically darts into the field to claim boxes; its deaths are part
 * of the show (and demonstrate the enemies honestly).
 */

type BotPhase =
  | { kind: 'ride'; dir: Dir; ticks: number }
  | { kind: 'draw'; plan: Dir[]; step: number; ticksInStep: number; stepLen: number };

export class DemoBot {
  private rng: Rng;
  private phase: BotPhase;

  constructor(seed: number) {
    this.rng = new Rng(seed);
    this.phase = { kind: 'ride', dir: 'left', ticks: 30 };
  }

  next(state: GameState): InputSnapshot {
    if (state.mode !== 'playing') {
      return { dir: null, fast: false, slow: false };
    }
    const p = this.phase;
    if (p.kind === 'ride') {
      p.ticks -= 1;
      if (p.ticks <= 0) {
        // Plan a box: off the wall, across, and back to the wall.
        const intoField: Dir = state.marker.y >= state.grid.h ? 'up' : 'down';
        const across: Dir = this.rng.chance(0.5) ? 'left' : 'right';
        this.phase = {
          kind: 'draw',
          plan: [intoField, across, intoField === 'up' ? 'down' : 'up'],
          step: 0,
          ticksInStep: 0,
          stepLen: 8 + this.rng.int(14),
        };
        return this.next(state);
      }
      // Bounce along the bottom wall.
      if (state.marker.x <= 4) p.dir = 'right';
      else if (state.marker.x >= state.grid.w - 4) p.dir = 'left';
      return { dir: p.dir, fast: false, slow: false };
    }
    // Drawing a planned box.
    if (state.drawing === null && p.step > 0) {
      // The claim completed (or died): back to riding.
      this.phase = {
        kind: 'ride',
        dir: this.rng.chance(0.5) ? 'left' : 'right',
        ticks: 40 + this.rng.int(80),
      };
      return { dir: null, fast: false, slow: false };
    }
    const dir = p.plan[p.step];
    if (dir === undefined) {
      this.phase = { kind: 'ride', dir: 'left', ticks: 60 };
      return { dir: null, fast: false, slow: false };
    }
    p.ticksInStep += 1;
    if (p.ticksInStep >= (p.step === 1 ? p.stepLen : Math.ceil(p.stepLen / 2))) {
      p.step += 1;
      p.ticksInStep = 0;
    }
    const slow = this.rng.chance(0.002);
    return { dir, fast: !slow, slow };
  }
}
