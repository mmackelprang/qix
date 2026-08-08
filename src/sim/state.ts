import { DEFAULT_LIVES, DEFAULT_SPARX_TIME_S, DEFAULT_TARGET_PERCENT } from '../config';
import { Rng } from '../rng';
import type { FuseState } from './fuse';
import { type Dir, Grid, type Point } from './grid';
import type { QixState } from './qix';
import type { SparxState } from './sparx';

export type DrawClass = 'fast' | 'slow';

/** Input sampled once per tick (TD §8) — the only thing the sim sees. */
export interface InputSnapshot {
  dir: Dir | null;
  fast: boolean;
  slow: boolean;
}

export const IDLE_INPUT: InputSnapshot = { dir: null, fast: false, slow: false };

/** An in-progress Stix: lattice points visited plus per-edge draw class. */
export interface Drawing {
  /** path[0] is on a wall; the marker is at path[path.length - 1]. */
  path: Point[];
  /** classes[i] is the class of the edge path[i] → path[i+1]. */
  classes: DrawClass[];
  /** Ticks the marker has been stationary mid-draw (fuse input, Phase 3). */
  stalledTicks: number;
}

/** Game phase within a run (TD §5.8). */
export type GameMode = 'levelIntro' | 'playing' | 'death' | 'levelClear' | 'gameOver';

export interface GameState {
  grid: Grid;
  rng: Rng;
  tick: number;
  mode: GameMode;
  /** Ticks spent in the current mode (drives sequence timings). */
  modeTicks: number;
  marker: Point;
  /** Marker position at the start of the current tick (swap collisions). */
  markerPrev: Point;
  drawing: Drawing | null;
  qixes: QixState[];
  /**
   * Cell used by capture to decide which side stays unclaimed — kept in
   * sync with the (first) Qix's position each tick.
   */
  qixCell: Point;
  sparx: SparxState[];
  /** Ticks remaining on the sparx time line. */
  sparxTimer: number;
  /** Times the time line has fully expired this life. */
  sparxExpiries: number;
  /** Operator "TIME LINE" seconds (PRD §8.5). */
  sparxTimeS: number;
  fuse: FuseState | null;
  claimedCells: number;
  targetPercent: number;
  score: number;
  lives: number;
  level: number;
  /** Split-the-Qix global score multiplier (PRD §4.4), 1–9. */
  multiplier: number;
}

export function claimedPercent(state: GameState): number {
  return (state.claimedCells / state.grid.totalCells) * 100;
}

export interface NewGameOptions {
  width?: number;
  height?: number;
  seed?: number;
  targetPercent?: number;
  lives?: number;
  sparxTimeS?: number;
}

export function markerSpawn(width: number, height: number): Point {
  return { x: Math.floor(width / 2), y: height };
}

export function createGameState(opts: NewGameOptions = {}): GameState {
  const width = opts.width ?? 256;
  const height = opts.height ?? 256;
  const grid = new Grid(width, height);
  return {
    grid,
    rng: new Rng(opts.seed ?? 1),
    tick: 0,
    mode: 'levelIntro',
    modeTicks: 0,
    // Marker spawns bottom-center of the border (PRD §4.9).
    marker: markerSpawn(width, height),
    markerPrev: markerSpawn(width, height),
    drawing: null,
    qixes: [],
    qixCell: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
    sparx: [],
    sparxTimer: (opts.sparxTimeS ?? DEFAULT_SPARX_TIME_S) * 60,
    sparxExpiries: 0,
    sparxTimeS: opts.sparxTimeS ?? DEFAULT_SPARX_TIME_S,
    fuse: null,
    claimedCells: 0,
    targetPercent: opts.targetPercent ?? DEFAULT_TARGET_PERCENT,
    score: 0,
    lives: opts.lives ?? DEFAULT_LIVES,
    level: 1,
    multiplier: 1,
  };
}
