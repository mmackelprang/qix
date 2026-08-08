import { COLORS } from '../config';
import { CLAIMED_FAST, type Point } from '../sim/grid';
import type { GameState } from '../sim/state';

/**
 * Playfield rendering (TD §6): claimed cells as merged horizontal runs,
 * walls as batched 1-unit strokes, the in-progress stix, and the marker.
 * Pure read over GameState; drawn in logical units (caller sets transform
 * and vertical origin).
 */
export function renderPlayfield(state: GameState, ctx: CanvasRenderingContext2D): void {
  const { grid } = state;

  // Claimed fills as horizontal runs.
  for (let y = 0; y < grid.h; y += 1) {
    let runStart = -1;
    let runClass = 0;
    for (let x = 0; x <= grid.w; x += 1) {
      const c = x < grid.w ? (grid.cells[y * grid.w + x] as number) : 0;
      if (c === runClass && runStart !== -1) continue;
      if (runStart !== -1 && runClass !== 0) {
        ctx.fillStyle = runClass === CLAIMED_FAST ? COLORS.claimedFast : COLORS.claimedSlow;
        ctx.fillRect(runStart, y, x - runStart, 1);
      }
      runStart = c === 0 ? -1 : x;
      runClass = c;
    }
  }

  // Walls, batched into one path.
  ctx.beginPath();
  for (let y = 0; y <= grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      if (grid.hWall(x, y)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y);
      }
    }
  }
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x <= grid.w; x += 1) {
      if (grid.vWall(x, y)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 1);
      }
    }
  }
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 1;
  ctx.stroke();

  // In-progress stix: fuse-burned edges render dimmed grey, the live
  // remainder in red, with a bright spark at the burn front.
  const drawing = state.drawing;
  if (drawing && drawing.path.length > 1) {
    const burnEdge = state.fuse?.burning ? state.fuse.edgeIndex : 0;
    const drawRange = (from: number, to: number, color: string): void => {
      if (to <= from) return;
      ctx.beginPath();
      const first = drawing.path[from] as Point;
      ctx.moveTo(first.x, first.y);
      for (let i = from + 1; i <= to; i += 1) {
        const p = drawing.path[i] as Point;
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    drawRange(0, burnEdge, COLORS.stixBurned);
    drawRange(burnEdge, drawing.path.length - 1, COLORS.stix);
    if (state.fuse?.burning) {
      const spark = drawing.path[Math.min(burnEdge, drawing.path.length - 1)] as Point;
      ctx.fillStyle = '#ffe040';
      ctx.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3);
    }
  }

  // Marker: red diamond with a white core.
  const m = state.marker;
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - 3);
  ctx.lineTo(m.x + 3, m.y);
  ctx.lineTo(m.x, m.y + 3);
  ctx.lineTo(m.x - 3, m.y);
  ctx.closePath();
  ctx.fillStyle = COLORS.marker;
  ctx.fill();
  ctx.fillStyle = COLORS.markerCore;
  ctx.fillRect(m.x - 1, m.y - 1, 2, 2);
}
