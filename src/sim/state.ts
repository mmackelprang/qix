import { Rng } from '../rng';
import { type Dir, Grid, type Point } from './grid';

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

export interface GameState {
  grid: Grid;
  rng: Rng;
  tick: number;
  marker: Point;
  drawing: Drawing | null;
  /**
   * Cell the Qix currently occupies — determines which side of a completed
   * claim stays unclaimed. Phase 1 uses a stationary stand-in; Phase 2
   * replaces this with the real Qix entity's position.
   */
  qixCell: Point;
  claimedCells: number;
  targetPercent: number;
}

export function claimedPercent(state: GameState): number {
  return (state.claimedCells / state.grid.totalCells) * 100;
}

export interface NewGameOptions {
  width?: number;
  height?: number;
  seed?: number;
  targetPercent?: number;
}

export function createGameState(opts: NewGameOptions = {}): GameState {
  const width = opts.width ?? 256;
  const height = opts.height ?? 256;
  const grid = new Grid(width, height);
  return {
    grid,
    rng: new Rng(opts.seed ?? 1),
    tick: 0,
    // Marker spawns bottom-center of the border (PRD §4.9).
    marker: { x: Math.floor(width / 2), y: height },
    drawing: null,
    qixCell: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
    claimedCells: 0,
    targetPercent: opts.targetPercent ?? 75,
  };
}
