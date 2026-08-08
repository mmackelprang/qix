import { describe, expect, it } from 'vitest';
import { CLAIMED_FAST, Grid, UNCLAIMED } from '../src/sim/grid';

describe('Grid', () => {
  it('initializes with border walls only', () => {
    const g = new Grid(4, 3);
    // Top and bottom horizontal walls.
    for (let x = 0; x < 4; x += 1) {
      expect(g.hWall(x, 0)).toBe(true);
      expect(g.hWall(x, 3)).toBe(true);
    }
    // Left and right vertical walls.
    for (let y = 0; y < 3; y += 1) {
      expect(g.vWall(0, y)).toBe(true);
      expect(g.vWall(4, y)).toBe(true);
    }
    // No interior walls.
    expect(g.hWall(1, 1)).toBe(false);
    expect(g.vWall(2, 1)).toBe(false);
    // All cells unclaimed.
    expect(g.claimedCount()).toBe(0);
  });

  it('answers directional wall-edge queries from lattice points', () => {
    const g = new Grid(4, 3);
    // Top-left corner: walls run right and down.
    expect(g.isWallEdge({ x: 0, y: 0 }, 'right')).toBe(true);
    expect(g.isWallEdge({ x: 0, y: 0 }, 'down')).toBe(true);
    expect(g.isWallEdge({ x: 0, y: 0 }, 'left')).toBe(false);
    expect(g.isWallEdge({ x: 0, y: 0 }, 'up')).toBe(false);
    // Interior point: no walls.
    expect(g.isOnWall({ x: 2, y: 1 })).toBe(false);
    // Border point: on wall.
    expect(g.isOnWall({ x: 2, y: 0 })).toBe(true);
  });

  it('rebuildWalls keeps only unclaimed-region boundaries', () => {
    const g = new Grid(4, 4);
    // Claim the left 2×4 column.
    for (let y = 0; y < 4; y += 1) {
      g.setCell(0, y, CLAIMED_FAST);
      g.setCell(1, y, CLAIMED_FAST);
    }
    g.rebuildWalls();
    // Boundary between claimed and unclaimed at x=2 is a wall.
    for (let y = 0; y < 4; y += 1) {
      expect(g.vWall(2, y)).toBe(true);
    }
    // Claimed region's outer border is absorbed (not a travel surface).
    for (let y = 0; y < 4; y += 1) {
      expect(g.vWall(0, y)).toBe(false);
      expect(g.vWall(1, y)).toBe(false);
    }
    expect(g.hWall(0, 0)).toBe(false);
    expect(g.hWall(1, 4)).toBe(false);
    // Unclaimed region's border remains.
    for (let y = 0; y < 4; y += 1) {
      expect(g.vWall(4, y)).toBe(true);
    }
    expect(g.hWall(2, 0)).toBe(true);
    expect(g.hWall(3, 4)).toBe(true);
    expect(g.cell(3, 3)).toBe(UNCLAIMED);
  });
});
