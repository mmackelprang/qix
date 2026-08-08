import { describe, expect, it } from 'vitest';
import { Attract } from '../src/shell/attract';
import { DemoBot } from '../src/shell/demo';
import {
  defaultTable,
  insertScore,
  loadScores,
  qualifies,
  type StorageLike,
  saveScores,
} from '../src/shell/highscores';
import { createGameState } from '../src/sim/state';
import { update } from '../src/sim/update';

class FakeStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('high scores (PRD §8.4)', () => {
  it('defaults to ten QIX KICKERS entries of 30000', () => {
    const table = defaultTable();
    expect(table).toHaveLength(10);
    expect(table.every((e) => e.name === 'QIX' && e.score === 30_000)).toBe(true);
  });

  it('falls back to defaults on corrupt storage', () => {
    const store = new FakeStorage();
    store.setItem('qix.scores.v1', '{broken json');
    expect(loadScores(store)).toEqual(defaultTable());
  });

  it('round-trips through storage', () => {
    const store = new FakeStorage();
    const { entries } = insertScore(defaultTable(), { name: 'ACE', score: 99_999, custom: false });
    saveScores(entries, store);
    const loaded = loadScores(store);
    expect(loaded[0]).toMatchObject({ name: 'ACE', score: 99_999 });
    expect(loaded).toHaveLength(10);
  });

  it('qualifies only above the current table floor', () => {
    const table = defaultTable();
    expect(qualifies(30_000, table)).toBe(false);
    expect(qualifies(30_001, table)).toBe(true);
    expect(qualifies(0, [])).toBe(false);
    expect(qualifies(1, [])).toBe(true);
  });

  it('inserts sorted and reports the rank', () => {
    const { entries, rank } = insertScore(defaultTable(), {
      name: 'TOP',
      score: 50_000,
      custom: true,
    });
    expect(rank).toBe(0);
    expect(entries[0]?.name).toBe('TOP');
    expect(entries).toHaveLength(10);
  });
});

describe('demo bot (TD §9)', () => {
  it('is deterministic for a given seed', () => {
    const run = (): string => {
      const s = createGameState({ width: 64, height: 64, seed: 777 });
      const bot = new DemoBot(42);
      const inputs: string[] = [];
      for (let t = 0; t < 500; t += 1) {
        const input = bot.next(s);
        inputs.push(`${input.dir ?? '-'}${input.fast ? 'F' : ''}${input.slow ? 'S' : ''}`);
        update(s, input);
      }
      return inputs.join(',');
    };
    expect(run()).toBe(run());
  });

  it('actually plays: the demo game claims territory', () => {
    const s = createGameState({ width: 64, height: 64, seed: 777 });
    const bot = new DemoBot(42);
    for (let t = 0; t < 3000 && s.mode !== 'gameOver'; t += 1) {
      update(s, bot.next(s));
    }
    // The bot must have made at least one claim (or died trying — but a
    // seeded bot that never claims anything is a broken show).
    expect(s.score).toBeGreaterThan(0);
  });
});

describe('attract rotation (PRD §5)', () => {
  it('cycles title → tutorial → scores → demo → title', () => {
    const attract = new Attract(() => defaultTable());
    const seen: string[] = [];
    let last = '';
    for (let t = 0; t < 12_000; t += 1) {
      attract.update();
      if (attract.segment !== last) {
        last = attract.segment;
        seen.push(last);
      }
      if (seen.length >= 5) break;
    }
    expect(seen.slice(0, 4)).toEqual(['title', 'tutorial', 'scores', 'demo']);
    expect(seen[4]).toBe('title'); // looped back around
  });
});
