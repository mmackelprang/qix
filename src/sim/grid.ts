/**
 * Integer grid model (TD §5.1): a w×h field of cells addressed by the
 * lattice of (w+1)×(h+1) points. Cells carry claim state; lattice edges
 * carry wall flags. All gameplay geometry is integer-exact.
 *
 * Cell (cx,cy) spans lattice x∈[cx,cx+1], y∈[cy,cy+1].
 * hWall(x,y): horizontal edge from point (x,y) to (x+1,y) — size w×(h+1).
 * vWall(x,y): vertical edge from point (x,y) to (x,y+1) — size (w+1)×h.
 */

export const UNCLAIMED = 0;
export const CLAIMED_FAST = 1;
export const CLAIMED_SLOW = 2;
export type CellState = typeof UNCLAIMED | typeof CLAIMED_FAST | typeof CLAIMED_SLOW;

export interface Point {
  x: number;
  y: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly cells: Uint8Array;
  readonly hWalls: Uint8Array;
  readonly vWalls: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = new Uint8Array(w * h);
    this.hWalls = new Uint8Array(w * (h + 1));
    this.vWalls = new Uint8Array((w + 1) * h);
    this.resetBorder();
  }

  /** Set walls to the field border only (level start). */
  resetBorder(): void {
    this.hWalls.fill(0);
    this.vWalls.fill(0);
    for (let x = 0; x < this.w; x += 1) {
      this.hWalls[x] = 1; // top
      this.hWalls[this.h * this.w + x] = 1; // bottom
    }
    for (let y = 0; y < this.h; y += 1) {
      this.vWalls[y * (this.w + 1)] = 1; // left
      this.vWalls[y * (this.w + 1) + this.w] = 1; // right
    }
  }

  cell(cx: number, cy: number): CellState {
    const v = this.cells[cy * this.w + cx];
    if (v === undefined) throw new RangeError(`cell out of bounds: ${cx},${cy}`);
    return v as CellState;
  }

  setCell(cx: number, cy: number, s: CellState): void {
    if (cx < 0 || cx >= this.w || cy < 0 || cy >= this.h) {
      throw new RangeError(`cell out of bounds: ${cx},${cy}`);
    }
    this.cells[cy * this.w + cx] = s;
  }

  inCellBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cx < this.w && cy >= 0 && cy < this.h;
  }

  inPointBounds(p: Point): boolean {
    return p.x >= 0 && p.x <= this.w && p.y >= 0 && p.y <= this.h;
  }

  hWall(x: number, y: number): boolean {
    if (x < 0 || x >= this.w || y < 0 || y > this.h) return false;
    return this.hWalls[y * this.w + x] === 1;
  }

  vWall(x: number, y: number): boolean {
    if (x < 0 || x > this.w || y < 0 || y >= this.h) return false;
    return this.vWalls[y * (this.w + 1) + x] === 1;
  }

  setHWall(x: number, y: number, on: boolean): void {
    if (x < 0 || x >= this.w || y < 0 || y > this.h) {
      throw new RangeError(`hWall out of bounds: ${x},${y}`);
    }
    this.hWalls[y * this.w + x] = on ? 1 : 0;
  }

  setVWall(x: number, y: number, on: boolean): void {
    if (x < 0 || x > this.w || y < 0 || y >= this.h) {
      throw new RangeError(`vWall out of bounds: ${x},${y}`);
    }
    this.vWalls[y * (this.w + 1) + x] = on ? 1 : 0;
  }

  /** Is the unit edge from point p in direction d a wall? */
  isWallEdge(p: Point, d: Dir): boolean {
    switch (d) {
      case 'right':
        return this.hWall(p.x, p.y);
      case 'left':
        return this.hWall(p.x - 1, p.y);
      case 'down':
        return this.vWall(p.x, p.y);
      case 'up':
        return this.vWall(p.x, p.y - 1);
      default: {
        const exhaustive: never = d;
        return exhaustive;
      }
    }
  }

  /** Set the unit edge from point p in direction d. */
  setWallEdge(p: Point, d: Dir, on: boolean): void {
    switch (d) {
      case 'right':
        this.setHWall(p.x, p.y, on);
        break;
      case 'left':
        this.setHWall(p.x - 1, p.y, on);
        break;
      case 'down':
        this.setVWall(p.x, p.y, on);
        break;
      case 'up':
        this.setVWall(p.x, p.y - 1, on);
        break;
      default: {
        const exhaustive: never = d;
        throw new Error(exhaustive);
      }
    }
  }

  /** Does any wall edge touch lattice point p? */
  isOnWall(p: Point): boolean {
    return (
      this.isWallEdge(p, 'up') ||
      this.isWallEdge(p, 'down') ||
      this.isWallEdge(p, 'left') ||
      this.isWallEdge(p, 'right')
    );
  }

  /**
   * The two cells flanking the unit edge from p in direction d, as flat cell
   * indices; -1 for out-of-bounds. For a horizontal move the flanking cells
   * are above/below the edge; for a vertical move, left/right of it.
   */
  edgeCells(p: Point, d: Dir): [number, number] {
    let a: Point;
    let b: Point;
    switch (d) {
      case 'right':
        a = { x: p.x, y: p.y - 1 };
        b = { x: p.x, y: p.y };
        break;
      case 'left':
        a = { x: p.x - 1, y: p.y - 1 };
        b = { x: p.x - 1, y: p.y };
        break;
      case 'down':
        a = { x: p.x - 1, y: p.y };
        b = { x: p.x, y: p.y };
        break;
      case 'up':
        a = { x: p.x - 1, y: p.y - 1 };
        b = { x: p.x, y: p.y - 1 };
        break;
      default: {
        const exhaustive: never = d;
        throw new Error(exhaustive);
      }
    }
    return [
      this.inCellBounds(a.x, a.y) ? a.y * this.w + a.x : -1,
      this.inCellBounds(b.x, b.y) ? b.y * this.w + b.x : -1,
    ];
  }

  /** Count of claimed cells. */
  claimedCount(): number {
    let n = 0;
    for (const c of this.cells) {
      if (c !== UNCLAIMED) n += 1;
    }
    return n;
  }

  get totalCells(): number {
    return this.w * this.h;
  }

  /**
   * Rebuild all wall edges from cell claim states (TD §5.3 step 4): a wall
   * is any edge between an unclaimed cell and a claimed cell or the field
   * exterior. Interior edges of claimed regions are absorbed (no longer
   * travel surfaces), matching the original.
   */
  rebuildWalls(): void {
    this.hWalls.fill(0);
    this.vWalls.fill(0);
    const unclaimedAt = (cx: number, cy: number): boolean =>
      this.inCellBounds(cx, cy) && this.cells[cy * this.w + cx] === UNCLAIMED;
    for (let y = 0; y <= this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        const above = unclaimedAt(x, y - 1);
        const below = unclaimedAt(x, y);
        if (above !== below) this.hWalls[y * this.w + x] = 1;
      }
    }
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x <= this.w; x += 1) {
        const left = unclaimedAt(x - 1, y);
        const right = unclaimedAt(x, y);
        if (left !== right) this.vWalls[y * (this.w + 1) + x] = 1;
      }
    }
  }
}
