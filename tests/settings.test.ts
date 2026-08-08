import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isCustom, loadSettings, saveSettings } from '../src/shell/settings';

class FakeStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('operator settings (PRD §8.5)', () => {
  it('defaults match the arcade CMOS defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      targetPercent: 75,
      lives: 3,
      sparxTimeS: 37,
      speedPercent: 100,
      touch: 'auto',
    });
  });

  it('round-trips through storage', () => {
    const store = new FakeStorage();
    saveSettings(
      { targetPercent: 60, lives: 5, sparxTimeS: 20, speedPercent: 150, touch: 'on' },
      store,
    );
    expect(loadSettings(store)).toEqual({
      targetPercent: 60,
      lives: 5,
      sparxTimeS: 20,
      speedPercent: 150,
      touch: 'on',
    });
  });

  it('clamps out-of-range stored values', () => {
    const store = new FakeStorage();
    store.setItem(
      'qix.settings.v1',
      JSON.stringify({
        targetPercent: 200,
        lives: 0,
        sparxTimeS: -5,
        speedPercent: 999,
        touch: 'banana',
      }),
    );
    expect(loadSettings(store)).toEqual({
      targetPercent: 99,
      lives: 1,
      sparxTimeS: 10,
      speedPercent: 200,
      touch: 'auto',
    });
  });

  it('falls back to defaults on corrupt storage', () => {
    const store = new FakeStorage();
    store.setItem('qix.settings.v1', 'not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('flags gameplay-affecting deviations as custom', () => {
    expect(isCustom(DEFAULT_SETTINGS)).toBe(false);
    expect(isCustom({ ...DEFAULT_SETTINGS, targetPercent: 60 })).toBe(true);
    expect(isCustom({ ...DEFAULT_SETTINGS, speedPercent: 150 })).toBe(true);
    expect(isCustom({ ...DEFAULT_SETTINGS, touch: 'on' })).toBe(false); // touch isn't gameplay
  });
});
