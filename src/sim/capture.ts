import type { SimEvent } from './events';
import { CLAIMED_FAST, CLAIMED_SLOW, type Dir, type Point, UNCLAIMED } from './grid';
import type { DrawClass, GameState } from './state';

/**
 * Territory capture (TD §5.3). On path completion:
 *  1. commit the path's edges as walls,
 *  2. BFS flood-fill unclaimed cells from the Qix's cell (walls block),
 *  3. claim every unclaimed cell the flood did not reach,
 *  4. rebuild the wall graph from cell states (claimed interiors absorbed),
 *  5. emit a ClaimEvent with the newly claimed area.
 */

function dirBetween(a: Point, b: Point): Dir {
  if (b.x === a.x + 1 && b.y === a.y) return 'right';
  if (b.x === a.x - 1 && b.y === a.y) return 'left';
  if (b.x === a.x && b.y === a.y + 1) return 'down';
  if (b.x === a.x && b.y === a.y - 1) return 'up';
  throw new Error(`path points not adjacent: ${a.x},${a.y} -> ${b.x},${b.y}`);
}

/** The claim class: any slow segment makes the whole claim slow (TD §5.4). */
export function claimClassOf(classes: readonly DrawClass[]): DrawClass {
  return classes.includes('slow') ? 'slow' : 'fast';
}

/**
 * Flood-fill over unclaimed cells starting from `start`, blocked by wall
 * edges. Returns a Uint8Array of visited flags indexed by flat cell index.
 */
export function floodFromCell(state: GameState, start: Point): Uint8Array {
  const { grid } = state;
  const { w, h } = grid;
  const visited = new Uint8Array(w * h);
  const startIdx = start.y * w + start.x;
  if (!grid.inCellBounds(start.x, start.y) || grid.cells[startIdx] !== UNCLAIMED) {
    return visited; // nothing reachable — caller treats all unclaimed as capturable
  }
  const queue: number[] = [startIdx];
  visited[startIdx] = 1;
  while (queue.length > 0) {
    const idx = queue.pop() as number;
    const cx = idx % w;
    const cy = (idx - cx) / w;
    // Left: crosses vWall(cx, cy)
    if (cx > 0 && !grid.vWall(cx, cy)) {
      const n = idx - 1;
      if (visited[n] === 0 && grid.cells[n] === UNCLAIMED) {
        visited[n] = 1;
        queue.push(n);
      }
    }
    // Right: crosses vWall(cx+1, cy)
    if (cx < w - 1 && !grid.vWall(cx + 1, cy)) {
      const n = idx + 1;
      if (visited[n] === 0 && grid.cells[n] === UNCLAIMED) {
        visited[n] = 1;
        queue.push(n);
      }
    }
    // Up: crosses hWall(cx, cy)
    if (cy > 0 && !grid.hWall(cx, cy)) {
      const n = idx - w;
      if (visited[n] === 0 && grid.cells[n] === UNCLAIMED) {
        visited[n] = 1;
        queue.push(n);
      }
    }
    // Down: crosses hWall(cx, cy+1)
    if (cy < h - 1 && !grid.hWall(cx, cy + 1)) {
      const n = idx + w;
      if (visited[n] === 0 && grid.cells[n] === UNCLAIMED) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }
  return visited;
}

/** Complete the in-progress claim. Called when the path reaches a wall. */
export function completeClaim(state: GameState, events: SimEvent[]): void {
  const drawing = state.drawing;
  if (drawing === null) throw new Error('completeClaim without an active drawing');
  const { grid } = state;

  // 1. Commit path edges as walls.
  for (let i = 0; i < drawing.path.length - 1; i += 1) {
    const a = drawing.path[i] as Point;
    const b = drawing.path[i + 1] as Point;
    grid.setWallEdge(a, dirBetween(a, b), true);
  }

  // 2. Flood from the Qix's side.
  const reachable = floodFromCell(state, state.qixCell);

  // 3. Claim everything unclaimed the Qix cannot reach.
  const cls = claimClassOf(drawing.classes);
  const mark = cls === 'slow' ? CLAIMED_SLOW : CLAIMED_FAST;
  let deltaCells = 0;
  let minX = grid.w;
  let minY = grid.h;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < grid.cells.length; i += 1) {
    if (grid.cells[i] === UNCLAIMED && reachable[i] === 0) {
      grid.cells[i] = mark;
      deltaCells += 1;
      const cx = i % grid.w;
      const cy = (i - cx) / grid.w;
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
    }
  }

  // 4. Rebuild walls from cell states.
  grid.rebuildWalls();

  state.claimedCells += deltaCells;
  state.drawing = null;
  const deltaPercent = (deltaCells / grid.totalCells) * 100;
  events.push({
    type: 'claim',
    deltaCells,
    deltaPercent,
    cls,
    bounds: { minX, minY, maxX: maxX + 1, maxY: maxY + 1 },
  });
  events.push({ type: 'drawStop' });
}
