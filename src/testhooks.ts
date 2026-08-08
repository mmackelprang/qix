import type { GameLoop } from './loop';

/**
 * Deterministic driving hooks for e2e/UAT, enabled only when the page is
 * loaded with `?test`. In test mode the rAF loop does not auto-start; the
 * Playwright suite advances ticks synchronously instead.
 */
export interface QixTestHooks {
  advanceTicks: (n: number) => void;
  getTicks: () => number;
  isRunning: () => boolean;
}

declare global {
  interface Window {
    __qix?: QixTestHooks;
  }
}

export function isTestMode(): boolean {
  return new URLSearchParams(window.location.search).has('test');
}

export function installTestHooks(loop: GameLoop): void {
  window.__qix = {
    advanceTicks: (n: number): void => {
      loop.step(n);
    },
    getTicks: (): number => loop.ticks,
    isRunning: (): boolean => loop.running,
  };
}
