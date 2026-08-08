import { difficultyFor, QIX } from '../config';
import type { SimEvent } from './events';
import { pointOnSegment, segmentsIntersect } from './geom';
import { type Point, UNCLAIMED } from './grid';
import type { GameState } from './state';

/**
 * The Qix (TD §5.5): a line whose two endpoints follow independent random
 * velocities toward random targets inside unclaimed space, trailed by a
 * fading multicolor streamer. Confined to the unclaimed region; touching
 * the marker or its incomplete stix while drawing kills the player.
 */

export type QixColor = 'red' | 'blue' | 'green';
const COLOR_CYCLE: readonly QixColor[] = ['red', 'blue', 'green'];

interface Endpoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
}

export interface TrailLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: QixColor;
}

export interface QixState {
  a: Endpoint;
  b: Endpoint;
  /** Ticks until both endpoints re-roll targets regardless of arrival. */
  retargetTicks: number;
  colorIdx: number;
  trail: TrailLine[];
  /** The (unclaimed) cell this qix currently occupies — capture side-picking. */
  cell: Point;
}

const cellOf = (state: GameState, x: number, y: number): Point => ({
  x: Math.min(state.grid.w - 1, Math.max(0, Math.floor(x))),
  y: Math.min(state.grid.h - 1, Math.max(0, Math.floor(y))),
});

function cellUnclaimed(state: GameState, x: number, y: number): boolean {
  const c = cellOf(state, x, y);
  return state.grid.cell(c.x, c.y) === UNCLAIMED;
}

/** Pick a random target cell center inside the unclaimed region. */
function rollTarget(state: GameState, ep: Endpoint): void {
  const { rng, grid } = state;
  for (let tries = 0; tries < QIX.targetTries; tries += 1) {
    const tx = rng.range(1, grid.w - 1) + 0.5;
    const ty = rng.range(1, grid.h - 1) + 0.5;
    if (cellUnclaimed(state, tx, ty)) {
      ep.tx = tx;
      ep.ty = ty;
      const scale = difficultyFor(state.level).qixSpeedScale;
      ep.speed = (QIX.speedMin + rng.next() * (QIX.speedMax - QIX.speedMin)) * scale;
      return;
    }
  }
  // Region is tiny — drift toward the current position (effectively idle).
  ep.tx = ep.x;
  ep.ty = ep.y;
  ep.speed = QIX.speedMin;
}

export function createQix(state: GameState, at: Point): QixState {
  const mk = (dx: number): Endpoint => ({
    x: at.x + dx,
    y: at.y,
    tx: at.x + dx,
    ty: at.y,
    speed: QIX.speedMin,
  });
  const qix: QixState = {
    a: mk(-QIX.initialHalfLength),
    b: mk(QIX.initialHalfLength),
    retargetTicks: 0,
    colorIdx: 0,
    trail: [],
    cell: { ...at },
  };
  rollTarget(state, qix.a);
  rollTarget(state, qix.b);
  return qix;
}

function moveEndpoint(state: GameState, ep: Endpoint, other: Endpoint): void {
  const dx = ep.tx - ep.x;
  const dy = ep.ty - ep.y;
  const dist = Math.hypot(dx, dy);
  if (dist < ep.speed) {
    rollTarget(state, ep);
    return;
  }
  const nx = ep.x + (dx / dist) * ep.speed;
  const ny = ep.y + (dy / dist) * ep.speed;
  // Confinement: reject moves that leave the unclaimed region (re-roll),
  // and keep the endpoints within the separation limit.
  if (!cellUnclaimed(state, nx, ny)) {
    rollTarget(state, ep);
    return;
  }
  if (Math.hypot(nx - other.x, ny - other.y) > QIX.maxSeparation) {
    ep.tx = other.x;
    ep.ty = other.y;
    return;
  }
  ep.x = nx;
  ep.y = ny;
}

/** Advance the Qix one tick; updates state.qixCell for capture side-picking. */
export function updateQix(state: GameState, qix: QixState): void {
  const { rng } = state;
  qix.retargetTicks -= 1;
  if (qix.retargetTicks <= 0) {
    rollTarget(state, qix.a);
    rollTarget(state, qix.b);
    qix.retargetTicks = rng.range(QIX.retargetMin, QIX.retargetMax);
  }
  moveEndpoint(state, qix.a, qix.b);
  moveEndpoint(state, qix.b, qix.a);
  if (rng.chance(QIX.colorCycleChance)) {
    qix.colorIdx = (qix.colorIdx + 1) % COLOR_CYCLE.length;
  }
  qix.trail.push({
    x1: qix.a.x,
    y1: qix.a.y,
    x2: qix.b.x,
    y2: qix.b.y,
    color: COLOR_CYCLE[qix.colorIdx] as QixColor,
  });
  if (qix.trail.length > QIX.trailLength) qix.trail.shift();

  // Keep this qix's side-picking cell in sync with the line midpoint
  // (guaranteed unclaimed by confinement; clamp is belt-and-braces).
  const midX = (qix.a.x + qix.b.x) / 2;
  const midY = (qix.a.y + qix.b.y) / 2;
  const mid = cellOf(state, midX, midY);
  if (state.grid.cell(mid.x, mid.y) === UNCLAIMED) {
    qix.cell = mid;
  } else {
    const aCell = cellOf(state, qix.a.x, qix.a.y);
    if (state.grid.cell(aCell.x, aCell.y) === UNCLAIMED) qix.cell = aCell;
  }
  // Legacy single-qix mirror, used when tests drive capture directly.
  state.qixCell = state.qixes[0]?.cell ?? state.qixCell;
}

/**
 * Does the Qix's current line touch the player's incomplete stix or the
 * marker? Only lethal while a draw is in progress (TD §5.5).
 */
export function qixTouchesPlayer(state: GameState, qix: QixState, events: SimEvent[]): boolean {
  const drawing = state.drawing;
  if (drawing === null) return false;
  const ax = Math.round(qix.a.x);
  const ay = Math.round(qix.a.y);
  const bx = Math.round(qix.b.x);
  const by = Math.round(qix.b.y);
  const m = state.marker;
  if (pointOnSegment(ax, ay, bx, by, m.x, m.y)) {
    events.push({ type: 'death', cause: 'qix' });
    return true;
  }
  for (let i = 0; i < drawing.path.length - 1; i += 1) {
    const p = drawing.path[i] as Point;
    const q = drawing.path[i + 1] as Point;
    if (segmentsIntersect(ax, ay, bx, by, p.x, p.y, q.x, q.y)) {
      events.push({ type: 'death', cause: 'qix' });
      return true;
    }
  }
  return false;
}
