import { PLAYER_SPEED, TIMING } from '../config';
import type { SimEvent } from './events';
import { resolveDeath, startLevel } from './levels';
import { updatePlayer } from './player';
import { qixTouchesPlayer, updateQix } from './qix';
import { checkThreshold, scoreClaim } from './scoring';
import type { GameState, InputSnapshot } from './state';

/**
 * Advance the simulation exactly one 60 Hz tick. Pure over (state, input):
 * no wall-clock, no Math.random — all randomness via state.rng.
 * Mutates `state` in place and returns the tick's events.
 */
export function update(state: GameState, input: InputSnapshot): SimEvent[] {
  const events: SimEvent[] = [];
  state.tick += 1;
  state.modeTicks += 1;

  switch (state.mode) {
    case 'levelIntro': {
      if (state.qixes.length === 0) {
        // First tick of a fresh game: build the level.
        startLevel(state, events);
      }
      if (state.modeTicks >= TIMING.levelIntro) {
        state.mode = 'playing';
        state.modeTicks = 0;
      }
      break;
    }

    case 'playing': {
      const before = events.length;
      updatePlayer(state, input, PLAYER_SPEED, events);
      // Score any claims the player completed this tick.
      for (let i = before; i < events.length; i += 1) {
        const e = events[i];
        if (e?.type === 'claim') {
          const points = scoreClaim(state, e.deltaPercent, e.cls);
          events.push({ type: 'claimScored', points });
        }
      }
      if (checkThreshold(state, events)) break;
      for (const qix of state.qixes) {
        updateQix(state, qix);
      }
      for (const qix of state.qixes) {
        if (qixTouchesPlayer(state, qix, events)) {
          state.mode = 'death';
          state.modeTicks = 0;
          break;
        }
      }
      break;
    }

    case 'death': {
      if (state.modeTicks >= TIMING.death) {
        resolveDeath(state, events);
      }
      break;
    }

    case 'levelClear': {
      if (state.modeTicks >= TIMING.levelClear) {
        state.level += 1;
        startLevel(state, events);
        state.mode = 'levelIntro';
        state.modeTicks = 0;
      }
      break;
    }

    case 'gameOver':
      // Terminal for now; the shell (Phase 6) returns to attract mode.
      break;

    default: {
      const exhaustive: never = state.mode;
      throw new Error(exhaustive);
    }
  }

  return events;
}
