import type { GameLoop } from './loop';
import { claimedPercent, type GameMode, type GameState } from './sim/state';

/**
 * Deterministic driving hooks for e2e/UAT, enabled only when the page is
 * loaded with `?test`. In test mode the rAF loop does not auto-start; the
 * Playwright suite advances ticks synchronously instead.
 */
export interface QixStateSummary {
  ticks: number;
  claimedPercent: number;
  marker: { x: number; y: number };
  drawing: boolean;
  mode: GameMode;
  score: number;
  lives: number;
  level: number;
  multiplier: number;
}

export interface QixTestHooks {
  advanceTicks: (n: number) => void;
  getTicks: () => number;
  isRunning: () => boolean;
  getSummary: () => QixStateSummary;
}

declare global {
  interface Window {
    __qix?: QixTestHooks;
  }
}

export function isTestMode(): boolean {
  return new URLSearchParams(window.location.search).has('test');
}

export function installTestHooks(loop: GameLoop, state: GameState): void {
  window.__qix = {
    advanceTicks: (n: number): void => {
      loop.step(n);
    },
    getTicks: (): number => loop.ticks,
    isRunning: (): boolean => loop.running,
    getSummary: (): QixStateSummary => ({
      ticks: loop.ticks,
      claimedPercent: claimedPercent(state),
      marker: { x: state.marker.x, y: state.marker.y },
      drawing: state.drawing !== null,
      mode: state.mode,
      score: state.score,
      lives: state.lives,
      level: state.level,
      multiplier: state.multiplier,
    }),
  };
}
