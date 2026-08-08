import type { QixState } from '../sim/qix';

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
