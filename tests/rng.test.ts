import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng';

describe('Rng (mulberry32)', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() stays in [0, 1)', () => {
    const rng = new Rng(999);
    for (let i = 0; i < 10_000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) stays in [0, n) and hits all values eventually', () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1_000; i += 1) {
      const v = rng.int(4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });

  it('range(lo, hi) is inclusive on both ends', () => {
    const rng = new Rng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 1_000; i += 1) {
      seen.add(rng.range(3, 5));
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('exposes serializable state that resumes identically', () => {
    const a = new Rng(555);
    a.next();
    a.next();
    // mulberry32 state fully defines the stream: reconstructing from .state
    // continues the exact same sequence.
    const resumed = new Rng(a.state);
    expect(resumed.next()).toBe(a.next());
    expect(resumed.next()).toBe(a.next());
  });
});
