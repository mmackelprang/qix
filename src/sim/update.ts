import { PLAYER_SPEED } from '../config';
import type { SimEvent } from './events';
import { updatePlayer } from './player';
import type { GameState, InputSnapshot } from './state';

/**
 * Advance the simulation exactly one 60 Hz tick. Pure over (state, input):
 * no wall-clock, no Math.random — all randomness via state.rng.
 * Mutates `state` in place and returns the tick's events.
 */
export function update(state: GameState, input: InputSnapshot): SimEvent[] {
  const events: SimEvent[] = [];
  updatePlayer(state, input, PLAYER_SPEED, events);
  state.tick += 1;
  return events;
}
