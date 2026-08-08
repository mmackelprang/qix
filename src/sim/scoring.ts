import { BONUS_PER_PERCENT_OVER, SCORE_PER_PERCENT_FAST, SCORE_PER_PERCENT_SLOW } from '../config';
import type { SimEvent } from './events';
import { claimedPercent, type DrawClass, type GameState } from './state';

/**
 * Scoring (PRD §4.4):
 *  - fast claim: percent × 100, slow claim: percent × 200, at 0.01%
 *    resolution (pyqix-verified: int(deltaPercent × perPercent)), then the
 *    global multiplier;
 *  - reaching the target ends the level immediately with a bonus of
 *    (final whole % − target) × 1000 × multiplier.
 */
export function scoreClaim(state: GameState, deltaPercent: number, cls: DrawClass): number {
  const perPercent = cls === 'slow' ? SCORE_PER_PERCENT_SLOW : SCORE_PER_PERCENT_FAST;
  const points = Math.floor(deltaPercent * perPercent) * state.multiplier;
  state.score += points;
  return points;
}

/** Threshold check — call after every claim. Returns true if the level ended. */
export function checkThreshold(state: GameState, events: SimEvent[]): boolean {
  const percent = claimedPercent(state);
  if (percent < state.targetPercent) return false;
  const bonus =
    Math.max(0, Math.floor(percent) - state.targetPercent) *
    BONUS_PER_PERCENT_OVER *
    state.multiplier;
  state.score += bonus;
  state.mode = 'levelClear';
  state.modeTicks = 0;
  state.drawing = null;
  events.push({ type: 'levelClear', finalPercent: percent, bonus });
  return true;
}
