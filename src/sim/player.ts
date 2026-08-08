import { completeClaim } from './capture';
import type { SimEvent } from './events';
import { DIRS, type Dir, type Point, UNCLAIMED } from './grid';
import type { DrawClass, GameState, InputSnapshot } from './state';

/**
 * Marker movement (TD §5.2): on walls the marker slides along wall edges at
 * full speed; holding a draw button while steering into open field draws a
 * Stix one unit at a time. Slow drawing halves speed. The path may never
 * cross or retrace itself; it completes the moment it reaches any wall.
 */

const pointsEqual = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

function addPoints(p: Point, d: Dir): Point {
  const v = DIRS[d];
  return { x: p.x + v.x, y: p.y + v.y };
}

function drawClassOf(input: InputSnapshot): DrawClass | null {
  // Slow wins if both are held: the deliberate, higher-risk choice.
  if (input.slow) return 'slow';
  if (input.fast) return 'fast';
  return null;
}

/** Can the marker draw one unit from p in direction d? */
function canDrawEdge(state: GameState, p: Point, d: Dir): boolean {
  const { grid } = state;
  const q = addPoints(p, d);
  if (!grid.inPointBounds(q)) return false;
  if (grid.isWallEdge(p, d)) return false; // cannot draw along/into a wall edge
  // Both flanking cells must be unclaimed (draws travel open field only).
  const [a, b] = grid.edgeCells(p, d);
  if (a === -1 || b === -1) return false; // border edges are walls anyway
  if (grid.cells[a] !== UNCLAIMED || grid.cells[b] !== UNCLAIMED) return false;
  // No crossing or retracing the current path.
  const path = state.drawing?.path;
  if (path) {
    for (const pt of path) {
      if (pointsEqual(pt, q)) return false;
    }
  }
  return true;
}

/** Does any legal draw step exist from the marker's position? (Spiral trap check.) */
export function hasLegalDrawMove(state: GameState): boolean {
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  return dirs.some((d) => canDrawEdge(state, state.marker, d));
}

/** One unit of movement. Returns true if the marker moved. */
function subStep(state: GameState, input: InputSnapshot, events: SimEvent[]): boolean {
  const d = input.dir;
  if (d === null) return false;
  const { grid, marker } = state;
  const cls = drawClassOf(input);

  if (state.drawing === null) {
    // Riding walls.
    if (grid.isWallEdge(marker, d)) {
      const q = addPoints(marker, d);
      state.marker = q;
      return true;
    }
    // Start a draw?
    if (cls !== null && canDrawEdge(state, marker, d)) {
      const q = addPoints(marker, d);
      state.drawing = { path: [marker, q], classes: [cls], stalledTicks: 0 };
      state.marker = q;
      events.push({ type: 'drawStart', cls });
      return true;
    }
    return false;
  }

  // Mid-draw: button must be held to keep moving.
  if (cls === null) return false;
  if (!canDrawEdge(state, marker, d)) return false;
  const q = addPoints(marker, d);
  state.drawing.path.push(q);
  state.drawing.classes.push(cls);
  state.marker = q;
  if (grid.isOnWall(q)) {
    completeClaim(state, events);
  }
  return true;
}

/** Advance the marker for one tick (PLAYER_SPEED substeps; slow draws half). */
export function updatePlayer(
  state: GameState,
  input: InputSnapshot,
  speed: number,
  events: SimEvent[],
): void {
  const slowSteps = Math.max(1, Math.floor(speed / 2));
  let moved = false;
  for (let i = 0; i < speed; i += 1) {
    // Slow drawing halves speed — evaluated per substep so the halving
    // applies from the very tick a slow draw starts.
    if (state.drawing !== null && input.slow && i >= slowSteps) break;
    if (subStep(state, input, events)) moved = true;
  }
  if (state.drawing !== null) {
    state.drawing.stalledTicks = moved ? 0 : state.drawing.stalledTicks + 1;
  }
}
