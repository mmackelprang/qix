import { SPARX } from '../config';
import type { SimEvent } from './events';
import { DIRS, type Dir, type Point } from './grid';
import type { GameState } from './state';

/**
 * Sparx (TD §5.6): sparks that patrol the wall graph — the boundary of the
 * unclaimed region. They spawn in waves on the time line; after the second
 * expiry all sparx turn Super (blue) and may chase the player down the
 * incomplete stix.
 */

export interface SparxState {
  pos: Point;
  /** Previous lattice point — sparx never reverse unless dead-ended. */
  prev: Point;
  isSuper: boolean;
  /** When chasing on the stix: index into drawing.path, else null. */
  stixIndex: number | null;
}

const DIR_ORDER: readonly Dir[] = ['up', 'right', 'down', 'left'];

const eq = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

const stepFrom = (p: Point, d: Dir): Point => ({ x: p.x + DIRS[d].x, y: p.y + DIRS[d].y });

/** Sparx speed for a level: +1 unit/tick every few levels (PRD §4.8). */
export function sparxSpeed(level: number): number {
  return SPARX.speedBase + Math.floor((level - 1) / SPARX.speedLevelStep);
}

/** Total sparx-timer ticks for the current operator setting. */
export function sparxTimerTicks(state: GameState): number {
  return state.sparxTimeS * 60;
}

/** Where waves enter: top-center of the field — the farthest border point
 * from the player's bottom-center spawn (half the perimeter away). */
export function sparxSpawnPoint(state: GameState): Point {
  return { x: Math.floor(state.grid.w / 2), y: 0 };
}

export function spawnSparxWave(state: GameState, isSuper: boolean, events: SimEvent[]): void {
  const at = sparxSpawnPoint(state);
  // One clockwise, one counterclockwise: seed prev on opposite sides so
  // the no-reverse rule sends them in opposite directions.
  const left: SparxState = {
    pos: { ...at },
    prev: stepFrom(at, 'right'),
    isSuper,
    stixIndex: null,
  };
  const right: SparxState = {
    pos: { ...at },
    prev: stepFrom(at, 'left'),
    isSuper,
    stixIndex: null,
  };
  state.sparx.push(left, right);
  events.push({ type: 'sparxSpawn', count: SPARX.waveSize, isSuper });
}

/**
 * One unit step along the wall graph. Prefers continuing straight, then a
 * deterministic turn order; reverses only at a dead end.
 */
function stepOnWalls(state: GameState, s: SparxState): void {
  const { grid } = state;
  const cameFrom = s.prev;
  const lastDir = DIR_ORDER.find((d) => eq(stepFrom(cameFrom, d), s.pos));
  const candidates: Dir[] = [];
  if (lastDir !== undefined && grid.isWallEdge(s.pos, lastDir)) {
    candidates.push(lastDir); // straight first
  }
  for (const d of DIR_ORDER) {
    if (d === lastDir) continue;
    if (!grid.isWallEdge(s.pos, d)) continue;
    const next = stepFrom(s.pos, d);
    if (eq(next, cameFrom)) continue; // no reversing
    candidates.push(d);
  }
  let dir = candidates[0];
  if (dir === undefined) {
    // Dead end — reverse if the wall back exists, else stay (snap next tick).
    const back = DIR_ORDER.find(
      (d) => grid.isWallEdge(s.pos, d) && eq(stepFrom(s.pos, d), cameFrom),
    );
    if (back === undefined) return;
    dir = back;
  }
  s.prev = s.pos;
  s.pos = stepFrom(s.pos, dir);
}

/**
 * Super sparx entering/advancing on the incomplete stix: transfers at the
 * path's wall junction (path[0]) and walks the path toward the marker.
 */
function stepOnStix(state: GameState, s: SparxState): void {
  const drawing = state.drawing;
  if (drawing === null || s.stixIndex === null) {
    s.stixIndex = null;
    return;
  }
  if (s.stixIndex < drawing.path.length - 1) {
    s.stixIndex += 1;
    const p = drawing.path[s.stixIndex];
    if (p) {
      s.prev = s.pos;
      s.pos = { x: p.x, y: p.y };
    }
  }
}

/** Is this lattice point on the current wall graph? */
function onWalls(state: GameState, p: Point): boolean {
  return state.grid.isOnWall(p);
}

/**
 * After a capture rebuilds the wall graph, a sparx may stand on a vanished
 * wall — snap it to the nearest point that still has wall edges (TD §12).
 */
export function snapSparxToWalls(state: GameState): void {
  for (const s of state.sparx) {
    if (s.stixIndex !== null || onWalls(state, s.pos)) continue;
    // Small BFS over lattice points for the nearest on-wall point.
    const seen = new Set<string>();
    const queue: Point[] = [s.pos];
    seen.add(`${s.pos.x},${s.pos.y}`);
    let found: Point | null = null;
    while (queue.length > 0 && found === null) {
      const p = queue.shift() as Point;
      for (const d of DIR_ORDER) {
        const n = stepFrom(p, d);
        if (!state.grid.inPointBounds(n)) continue;
        const key = `${n.x},${n.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (onWalls(state, n)) {
          found = n;
          break;
        }
        queue.push(n);
      }
    }
    if (found) {
      s.pos = found;
      s.prev = found; // free direction choice next step
    }
  }
}

/** Does any sparx touch the marker (including same-tick position swaps)? */
export function sparxTouchesPlayer(state: GameState, events: SimEvent[]): boolean {
  for (const s of state.sparx) {
    const swap = eq(s.pos, state.markerPrev) && eq(s.prev, state.marker);
    if (eq(s.pos, state.marker) || swap) {
      events.push({ type: 'death', cause: 'sparx' });
      return true;
    }
  }
  return false;
}

/** Advance sparx movement, the time line, and wave/super transitions. */
export function updateSparx(state: GameState, events: SimEvent[]): void {
  // Time line.
  state.sparxTimer -= 1;
  if (state.sparxTimer <= 0) {
    state.sparxExpiries += 1;
    if (state.sparxExpiries >= SPARX.superAfterExpiries) {
      let mutated = false;
      for (const s of state.sparx) {
        if (!s.isSuper) {
          s.isSuper = true;
          mutated = true;
        }
      }
      if (mutated) events.push({ type: 'superSparx' });
      spawnSparxWave(state, true, events);
    } else {
      spawnSparxWave(state, false, events);
    }
    state.sparxTimer = sparxTimerTicks(state);
  }

  const speed = sparxSpeed(state.level);
  const drawing = state.drawing;
  for (const s of state.sparx) {
    for (let step = 0; step < speed; step += 1) {
      if (s.stixIndex !== null) {
        stepOnStix(state, s);
        continue;
      }
      // Super sparx transfer onto the stix at its wall junction.
      if (s.isSuper && drawing !== null) {
        const start = drawing.path[0];
        if (start && eq(s.pos, start)) {
          s.stixIndex = 0;
          stepOnStix(state, s);
          continue;
        }
      }
      stepOnWalls(state, s);
    }
  }
}

/** Drawing ended (claim, death) — return any stix-chasers to the walls. */
export function evictSparxFromStix(state: GameState): void {
  for (const s of state.sparx) {
    if (s.stixIndex === null) continue;
    s.stixIndex = null;
    // The stix either became a wall (claim) or vanished (death). If the
    // sparx's point is no longer on a wall, the snap pass will fix it.
  }
  snapSparxToWalls(state);
}
