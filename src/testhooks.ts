import type { GameLoop } from './loop';
import type { App } from './shell/app';
import type { ScoreEntry } from './shell/highscores';
import { claimedPercent, type GameMode } from './sim/state';

/**
 * Deterministic driving hooks for e2e/UAT, enabled only when the page is
 * loaded with `?test`. In test mode the rAF loop does not auto-start; the
 * Playwright suite advances ticks synchronously instead. `?autostart`
 * additionally skips attract mode straight into a game.
 */
export interface QixStateSummary {
  ticks: number;
  phase: string;
  attractSegment: string;
  paused: boolean;
  claimedPercent: number;
  marker: { x: number; y: number };
  drawing: boolean;
  mode: GameMode | 'none';
  score: number;
  lives: number;
  level: number;
  multiplier: number;
  qixCount: number;
  sparxCount: number;
  superSparx: boolean;
  sparxTimer: number;
  fuseBurning: boolean;
  lastDeathCause: string | null;
}

export interface QixAudioInfo {
  unlocked: boolean;
  muted: boolean;
}

export interface QixTestHooks {
  advanceTicks: (n: number) => void;
  getTicks: () => number;
  isRunning: () => boolean;
  getSummary: () => QixStateSummary;
  getAudioInfo: () => QixAudioInfo;
  getScores: () => ScoreEntry[];
  setScores: (entries: ScoreEntry[]) => void;
}

declare global {
  interface Window {
    __qix?: QixTestHooks;
  }
}

export function isTestMode(): boolean {
  return new URLSearchParams(window.location.search).has('test');
}

export function installTestHooks(
  loop: GameLoop,
  app: App,
  getAudioInfo: () => QixAudioInfo = () => ({ unlocked: false, muted: false }),
): void {
  window.__qix = {
    advanceTicks: (n: number): void => {
      loop.step(n);
    },
    getTicks: (): number => loop.ticks,
    isRunning: (): boolean => loop.running,
    getSummary: (): QixStateSummary => {
      const game = app.game;
      return {
        ticks: loop.ticks,
        phase: app.phase,
        attractSegment: app.attract.segment,
        paused: app.paused,
        claimedPercent: game ? claimedPercent(game) : 0,
        marker: game ? { x: game.marker.x, y: game.marker.y } : { x: -1, y: -1 },
        drawing: game ? game.drawing !== null : false,
        mode: game ? game.mode : 'none',
        score: game?.score ?? 0,
        lives: game?.lives ?? 0,
        level: game?.level ?? 0,
        multiplier: game?.multiplier ?? 1,
        qixCount: game?.qixes.length ?? 0,
        sparxCount: game?.sparx.length ?? 0,
        superSparx: game?.sparx.some((s) => s.isSuper) ?? false,
        sparxTimer: game?.sparxTimer ?? 0,
        fuseBurning: game?.fuse?.burning ?? false,
        lastDeathCause: app.lastDeathCause,
      };
    },
    getAudioInfo,
    getScores: (): ScoreEntry[] => app.getScores(),
    setScores: (entries: ScoreEntry[]): void => {
      app.setScores(entries);
    },
  };
}
