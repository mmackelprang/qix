import { COLORS, HUD_H, LOGICAL_W } from '../config';
import { claimedPercent, type GameState } from '../sim/state';
import { drawText, drawTextCentered } from './text';

/**
 * HUD band (PRD §7): score, high score, claimed % vs target, lives
 * markers, level, multiplier. The Sparx time line lands here in Phase 3.
 */
export function renderHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  highScore: number,
): void {
  ctx.clearRect(0, 0, LOGICAL_W, HUD_H);

  drawText(ctx, `${state.score}`.padStart(6, '0'), 8, 6, COLORS.hudText);
  drawTextCentered(ctx, 'HIGH', LOGICAL_W / 2, 2, COLORS.hudText);
  drawTextCentered(ctx, `${highScore}`.padStart(6, '0'), LOGICAL_W / 2, 11, COLORS.hudText);

  const pct = Math.floor(claimedPercent(state));
  drawText(ctx, `CLAIMED ${pct}% ${state.targetPercent}%`, 8, 22, COLORS.hudText);

  // Lives markers: small diamonds, one per remaining life.
  ctx.fillStyle = COLORS.marker;
  for (let i = 0; i < state.lives; i += 1) {
    const cx = LOGICAL_W - 12 - i * 10;
    const cy = 9;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - 3, cy);
    ctx.closePath();
    ctx.fill();
  }

  drawText(ctx, `LEVEL ${state.level}`, LOGICAL_W - 66, 22, COLORS.hudText);
  if (state.multiplier > 1) {
    drawText(ctx, `${state.multiplier}X`, LOGICAL_W - 24, 34, COLORS.hudText);
  }
}
