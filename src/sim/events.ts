import type { DrawClass } from './state';

/**
 * The sim communicates outward only via events returned from each tick
 * (TD §5.8). The shell routes them to audio and render effects.
 */
export type SimEvent =
  | { type: 'claim'; deltaCells: number; deltaPercent: number; cls: DrawClass }
  | { type: 'drawStart'; cls: DrawClass }
  | { type: 'drawStop' };
