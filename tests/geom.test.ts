import { describe, expect, it } from 'vitest';
import { pointOnSegment, segmentsIntersect } from '../src/sim/geom';

describe('segmentsIntersect', () => {
  it('detects a proper crossing', () => {
    expect(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
  });

  it('detects touching at an endpoint', () => {
    expect(segmentsIntersect(0, 0, 5, 5, 5, 5, 10, 0)).toBe(true);
  });

  it('detects an endpoint lying on the other segment', () => {
    expect(segmentsIntersect(0, 0, 10, 0, 5, 0, 5, 8)).toBe(true);
  });

  it('detects collinear overlap', () => {
    expect(segmentsIntersect(0, 0, 10, 0, 5, 0, 15, 0)).toBe(true);
  });

  it('rejects collinear but disjoint segments', () => {
    expect(segmentsIntersect(0, 0, 4, 0, 6, 0, 10, 0)).toBe(false);
  });

  it('rejects parallel non-touching segments', () => {
    expect(segmentsIntersect(0, 0, 10, 0, 0, 1, 10, 1)).toBe(false);
  });

  it('rejects clearly separated segments', () => {
    expect(segmentsIntersect(0, 0, 1, 1, 5, 5, 9, 2)).toBe(false);
  });
});

describe('pointOnSegment', () => {
  it('accepts interior and endpoint hits', () => {
    expect(pointOnSegment(0, 0, 10, 0, 5, 0)).toBe(true);
    expect(pointOnSegment(0, 0, 10, 0, 0, 0)).toBe(true);
    expect(pointOnSegment(0, 0, 10, 0, 10, 0)).toBe(true);
  });

  it('rejects off-segment points', () => {
    expect(pointOnSegment(0, 0, 10, 0, 5, 1)).toBe(false);
    expect(pointOnSegment(0, 0, 10, 0, 11, 0)).toBe(false);
  });
});
