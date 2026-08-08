import type { SimEvent } from './events';
import { createQix } from './qix';
import { snapSparxToWalls, sparxTimerTicks, spawnSparxWave } from './sparx';
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
  state.fuse = null;
  state.marker = markerSpawn(grid.w, grid.h);
  state.markerPrev = { ...state.marker };
  const center = { x: Math.floor(grid.w / 2), y: Math.floor(grid.h / 4) };
  state.qixCell = center;
  state.qixes = [createQix(state, center)];
  state.sparx = [];
  state.sparxTimer = sparxTimerTicks(state);
  state.sparxExpiries = 0;
  spawnSparxWave(state, false, events);
  events.push({ type: 'levelStart', level: state.level });
}

/** Death resolution: lose a life, erase the stix, respawn or game over. */
export function resolveDeath(state: GameState, events: SimEvent[]): void {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.mode = 'gameOver';
    state.modeTicks = 0;
    state.drawing = null;
    state.fuse = null;
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
  state.markerPrev = { ...state.marker };
  state.fuse = null;
  // Extra sparx (beyond the level's original wave) despawn, any stix
  // chasers return to the walls, and the time line restarts (PRD §4.6).
  state.sparx = state.sparx.slice(0, 2);
  for (const s of state.sparx) s.stixIndex = null;
  snapSparxToWalls(state);
  state.sparxTimer = sparxTimerTicks(state);
  state.sparxExpiries = 0;
  state.mode = 'playing';
  state.modeTicks = 0;
  events.push({ type: 'respawn' });
}
