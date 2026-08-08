import type { DrawClass } from './state';

/**
 * The sim communicates outward only via events returned from each tick
 * (TD §5.8). The shell routes them to audio and render effects.
 */
export type DeathCause = 'qix' | 'sparx' | 'fuse';

export type SimEvent =
  | {
      type: 'claim';
      deltaCells: number;
      deltaPercent: number;
      cls: DrawClass;
      bounds: { minX: number; minY: number; maxX: number; maxY: number };
    }
  | { type: 'claimScored'; points: number }
  | { type: 'drawStart'; cls: DrawClass }
  | { type: 'drawStop' }
  | { type: 'death'; cause: DeathCause }
  | { type: 'respawn' }
  | { type: 'levelStart'; level: number }
  | { type: 'levelClear'; finalPercent: number; bonus: number }
  | { type: 'gameOver'; finalScore: number };
