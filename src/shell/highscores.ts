/**
 * "QIX KICKERS" high-score table (PRD §8.4): top 10, three-character
 * names, versioned localStorage, defaults matching the original machine
 * (ten entries of 030000 QIX). Storage is injectable for Node tests.
 */

export interface ScoreEntry {
  name: string;
  score: number;
  /** Earned with non-default operator settings (PRD §8.5). */
  custom: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'qix.scores.v1';
export const TABLE_SIZE = 10;

export function defaultTable(): ScoreEntry[] {
  return Array.from({ length: TABLE_SIZE }, () => ({
    name: 'QIX',
    score: 30_000,
    custom: false,
  }));
}

function storageOrNull(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadScores(storage?: StorageLike): ScoreEntry[] {
  const store = storageOrNull(storage);
  try {
    const raw = store?.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: number; entries?: ScoreEntry[] };
      if (parsed.v === 1 && Array.isArray(parsed.entries)) {
        const cleaned = parsed.entries
          .filter(
            (e): e is ScoreEntry =>
              typeof e === 'object' &&
              e !== null &&
              typeof e.name === 'string' &&
              typeof e.score === 'number',
          )
          .slice(0, TABLE_SIZE);
        // Partial tables are valid (e.g. after a reset); empty falls back
        // to the defaults.
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch {
    // Corrupt storage falls back to defaults (TD §10).
  }
  return defaultTable();
}

export function saveScores(entries: ScoreEntry[], storage?: StorageLike): void {
  const store = storageOrNull(storage);
  try {
    store?.setItem(KEY, JSON.stringify({ v: 1, entries: entries.slice(0, TABLE_SIZE) }));
  } catch {
    // Storage full/blocked: scores just don't persist.
  }
}

/** Does this score make the table? */
export function qualifies(score: number, entries: ScoreEntry[]): boolean {
  const last = entries[entries.length - 1];
  return score > 0 && (entries.length < TABLE_SIZE || (last !== undefined && score > last.score));
}

/** Insert a score (sorted descending), trimming to the table size. */
export function insertScore(
  entries: ScoreEntry[],
  entry: ScoreEntry,
): { entries: ScoreEntry[]; rank: number } {
  const next = [...entries, entry].sort((a, b) => b.score - a.score).slice(0, TABLE_SIZE);
  return { entries: next, rank: next.indexOf(entry) };
}
