import { Rng } from '../../src/rng';
import { CLAIMED_FAST, CLAIMED_SLOW, Grid, type Point, UNCLAIMED } from '../../src/sim/grid';
import type { GameState } from '../../src/sim/state';

/**
 * ASCII fixtures (TD §11): a w×h grid renders as (2w+1)×(2h+1) characters.
 *   (2x,   2y  ) lattice point: 'M' marker, else '+'
 *   (2x+1, 2y  ) horizontal edge: '#' wall, '-' in-progress stix, ' ' none
 *   (2x,   2y+1) vertical edge:   '#' wall, '|' in-progress stix, ' ' none
 *   (2x+1, 2y+1) cell: '.' unclaimed, 'F' fast-claimed, 'S' slow-claimed,
 *                'Q' the Qix's (unclaimed) cell
 *
 * Example — 4×3 field, nothing claimed, marker bottom-center:
 *   +#+#+#+#+
 *   #.|.|.|.#     (interior '|' shown here only if a stix is being drawn)
 *   +#+#+M#+#
 */

/** Dedent, right-trim each line, and drop surrounding blank lines. */
export function normalize(text: string): string {
  const rawLines = text.split('\n');
  while (rawLines.length > 0 && rawLines[0]?.trim() === '') rawLines.shift();
  while (rawLines.length > 0 && rawLines[rawLines.length - 1]?.trim() === '') rawLines.pop();
  const indents = rawLines
    .filter((l) => l.trim() !== '')
    .map((l) => l.length - l.trimStart().length);
  const dedent = indents.length > 0 ? Math.min(...indents) : 0;
  return rawLines.map((l) => l.slice(dedent).trimEnd()).join('\n');
}

const edgeKey = (a: Point, b: Point): string => {
  const [p, q] = a.y < b.y || (a.y === b.y && a.x < b.x) ? [a, b] : [b, a];
  return `${p.x},${p.y}-${q.x},${q.y}`;
};

/** Render a GameState as normalized fixture ASCII. */
export function renderAscii(state: GameState): string {
  const { grid, marker, qixCell, drawing } = state;
  const pathEdges = new Set<string>();
  if (drawing) {
    for (let i = 0; i < drawing.path.length - 1; i += 1) {
      pathEdges.add(edgeKey(drawing.path[i] as Point, drawing.path[i + 1] as Point));
    }
  }
  const rows: string[] = [];
  for (let y = 0; y <= grid.h; y += 1) {
    // Lattice-point / horizontal-edge row.
    let row = '';
    for (let x = 0; x <= grid.w; x += 1) {
      row += marker.x === x && marker.y === y ? 'M' : '+';
      if (x < grid.w) {
        if (grid.hWall(x, y)) row += '#';
        else if (pathEdges.has(edgeKey({ x, y }, { x: x + 1, y }))) row += '-';
        else row += ' ';
      }
    }
    rows.push(row);
    if (y === grid.h) break;
    // Vertical-edge / cell row.
    row = '';
    for (let x = 0; x <= grid.w; x += 1) {
      if (grid.vWall(x, y)) row += '#';
      else if (pathEdges.has(edgeKey({ x, y }, { x, y: y + 1 }))) row += '|';
      else row += ' ';
      if (x < grid.w) {
        if (qixCell.x === x && qixCell.y === y) row += 'Q';
        else {
          const c = grid.cell(x, y);
          row += c === CLAIMED_FAST ? 'F' : c === CLAIMED_SLOW ? 'S' : '.';
        }
      }
    }
    rows.push(row);
  }
  return normalize(rows.join('\n'));
}

/** Parse fixture ASCII into a GameState (walls, cells, marker, qix). */
export function parseAscii(text: string, seed = 1): GameState {
  const lines = normalize(text).split('\n');
  const width = ((lines[0]?.length ?? 1) - 1) / 2;
  const height = (lines.length - 1) / 2;
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`fixture has invalid dimensions: ${width}x${height}`);
  }
  const grid = new Grid(width, height);
  grid.hWalls.fill(0);
  grid.vWalls.fill(0);
  let marker: Point | null = null;
  let qixCell: Point | null = null;
  const at = (col: number, row: number): string => {
    const line = lines[row] ?? '';
    return col < line.length ? (line[col] as string) : ' ';
  };
  for (let y = 0; y <= height; y += 1) {
    for (let x = 0; x <= width; x += 1) {
      if (at(2 * x, 2 * y) === 'M') marker = { x, y };
      if (x < width && at(2 * x + 1, 2 * y) === '#') grid.setHWall(x, y, true);
      if (y < height && at(2 * x, 2 * y + 1) === '#') grid.setVWall(x, y, true);
      if (x < width && y < height) {
        const c = at(2 * x + 1, 2 * y + 1);
        if (c === 'F') grid.setCell(x, y, CLAIMED_FAST);
        else if (c === 'S') grid.setCell(x, y, CLAIMED_SLOW);
        else if (c === 'Q') qixCell = { x, y };
        else if (c !== '.') throw new Error(`unknown cell char '${c}' at ${x},${y}`);
      }
    }
  }
  if (marker === null) throw new Error('fixture has no marker (M)');
  if (qixCell === null) throw new Error('fixture has no qix cell (Q)');
  if (grid.cell(qixCell.x, qixCell.y) !== UNCLAIMED) {
    throw new Error('qix cell must be unclaimed');
  }
  return {
    grid,
    rng: new Rng(seed),
    tick: 0,
    mode: 'playing',
    modeTicks: 0,
    marker,
    markerPrev: { ...marker },
    moveAcc: 0,
    speedPercent: 200,
    drawing: null,
    qixes: [],
    sparx: [],
    sparxTimer: 37 * 60,
    sparxExpiries: 0,
    sparxTimeS: 37,
    fuse: null,
    qixCell,
    claimedCells: grid.claimedCount(),
    targetPercent: 75,
    score: 0,
    lives: 3,
    level: 1,
    multiplier: 1,
  };
}
