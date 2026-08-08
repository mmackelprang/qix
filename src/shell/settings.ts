/**
 * Operator settings (PRD §8.5) — the spiritual successor of the original
 * cabinet's CMOS test-mode menu. Persisted in versioned localStorage;
 * gameplay-affecting values tag scores as "custom" off-defaults.
 */

export interface Settings {
  targetPercent: number;
  lives: number;
  sparxTimeS: number;
  /** Game speed percent — 100 matches the 1981 arcade timing. */
  speedPercent: number;
  touch: 'auto' | 'on' | 'off';
}

export const DEFAULT_SETTINGS: Settings = {
  targetPercent: 75,
  lives: 3,
  sparxTimeS: 37,
  speedPercent: 100,
  touch: 'auto',
};

export const SETTING_RANGES = {
  targetPercent: { min: 50, max: 99, step: 5 },
  lives: { min: 1, max: 9, step: 1 },
  sparxTimeS: { min: 10, max: 99, step: 1 },
  speedPercent: { min: 50, max: 200, step: 10 },
} as const;

const KEY = 'qix.settings.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storageOrNull(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export function loadSettings(storage?: StorageLike): Settings {
  const store = storageOrNull(storage);
  try {
    const raw = store?.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        targetPercent: clamp(
          typeof p.targetPercent === 'number' ? p.targetPercent : 75,
          SETTING_RANGES.targetPercent.min,
          SETTING_RANGES.targetPercent.max,
        ),
        lives: clamp(
          typeof p.lives === 'number' ? p.lives : 3,
          SETTING_RANGES.lives.min,
          SETTING_RANGES.lives.max,
        ),
        sparxTimeS: clamp(
          typeof p.sparxTimeS === 'number' ? p.sparxTimeS : 37,
          SETTING_RANGES.sparxTimeS.min,
          SETTING_RANGES.sparxTimeS.max,
        ),
        speedPercent: clamp(
          typeof p.speedPercent === 'number' ? p.speedPercent : 100,
          SETTING_RANGES.speedPercent.min,
          SETTING_RANGES.speedPercent.max,
        ),
        touch: p.touch === 'on' || p.touch === 'off' ? p.touch : 'auto',
      };
    }
  } catch {
    // Corrupt storage falls back to defaults (TD §10).
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings, storage?: StorageLike): void {
  const store = storageOrNull(storage);
  try {
    store?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage full/blocked: settings just don't persist.
  }
}

export function isCustom(settings: Settings): boolean {
  return (
    settings.targetPercent !== DEFAULT_SETTINGS.targetPercent ||
    settings.lives !== DEFAULT_SETTINGS.lives ||
    settings.sparxTimeS !== DEFAULT_SETTINGS.sparxTimeS ||
    settings.speedPercent !== DEFAULT_SETTINGS.speedPercent
  );
}
