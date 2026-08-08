import type { QixState } from '../sim/qix';
import type { SparxState } from '../sim/sparx';

/** Qix streamer palette: current line brightest, trail fading behind. */
const QIX_COLORS: Readonly<Record<string, string>> = {
  red: '#ff4040',
  blue: '#4060ff',
  green: '#40ff60',
};

export function renderQix(ctx: CanvasRenderingContext2D, qix: QixState): void {
  const n = qix.trail.length;
  for (let i = 0; i < n; i += 1) {
    const line = qix.trail[i];
    if (!line) continue;
    ctx.globalAlpha = 0.25 + 0.75 * ((i + 1) / n);
    ctx.strokeStyle = QIX_COLORS[line.color] ?? '#ffffff';
    ctx.lineWidth = i === n - 1 ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Sparx: a four-spoke pinwheel, white normally, blue when Super. */
export function renderSparx(ctx: CanvasRenderingContext2D, sparx: SparxState, tick: number): void {
  const { x, y } = sparx.pos;
  const r = 2.5;
  const spin = ((tick >> 2) % 2) * (Math.PI / 4);
  ctx.strokeStyle = sparx.isSuper ? '#4080ff' : '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const a = spin + (Math.PI / 2) * i;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
}
