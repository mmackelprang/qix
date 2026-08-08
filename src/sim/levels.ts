import type { SimEvent } from './events';
import { createQix } from './qix';
import { type GameState, markerSpawn } from './state';

/**
 * Level setup (PRD §4.8): every level is the same empty rectangle; only
 * enemy count and speed change. Two Qix appear from level 3 (Phase 4).
 */
export function startLevel(state: GameState, events: SimEvent[]): void {
  const { grid } = state;
  grid.cells.fill(0);
  grid.resetBorder();
  state.claimedCells = 0;
  state.drawing = null;
  state.marker = markerSpawn(grid.w, grid.h);
  const center = { x: Math.floor(grid.w / 2), y: Math.floor(grid.h / 4) };
  state.qixCell = center;
  state.qixes = [createQix(state, center)];
  events.push({ type: 'levelStart', level: state.level });
}

/** Death resolution: lose a life, erase the stix, respawn or game over. */
export function resolveDeath(state: GameState, events: SimEvent[]): void {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.mode = 'gameOver';
    state.modeTicks = 0;
    state.drawing = null;
    events.push({ type: 'gameOver', finalScore: state.score });
    return;
  }
  // The unfinished stix is erased; claimed territory persists. The marker
  // returns to where the stix began (it was safe wall there) — or stays
  // put if the death happened while wall-riding.
  if (state.drawing !== null) {
    state.marker = state.drawing.path[0] ?? state.marker;
    state.drawing = null;
  }
  state.mode = 'playing';
  state.modeTicks = 0;
  events.push({ type: 'respawn' });
}
