import { AudioEngine } from './audio/engine';
import { routeAudioEvents } from './audio/router';
import { COLORS, FIELD_H, FIELD_W, HUD_H, LOGICAL_H, LOGICAL_W } from './config';
import { Keyboard } from './input/keyboard';
import { GameLoop } from './loop';
import { Effects } from './render/effects';
import { renderQix, renderSparx } from './render/entities';
import { renderHud } from './render/hud';
import { renderPlayfield } from './render/playfield';
import { drawTextCentered } from './render/text';
import { claimedPercent, createGameState } from './sim/state';
import { update } from './sim/update';
import { installTestHooks, isTestMode } from './testhooks';

function getCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`missing canvas #${id}`);
  }
  return el;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
}

const gameCanvas = getCanvas('game');
const hudCanvas = getCanvas('hud');
const gameCtx = getContext(gameCanvas);
const hudCtx = getContext(hudCanvas);

/** Device scale: logical-unit → device-pixel factor, recomputed on resize. */
let scale = 1;

function layout(): void {
  const dpr = window.devicePixelRatio || 1;
  const fitW = window.innerWidth / LOGICAL_W;
  const fitH = window.innerHeight / LOGICAL_H;
  const cssScale = Math.min(fitW, fitH);
  const cssW = Math.floor(LOGICAL_W * cssScale);
  const cssH = Math.floor(LOGICAL_H * cssScale);
  scale = (cssW * dpr) / LOGICAL_W;
  for (const canvas of [gameCanvas, hudCanvas]) {
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }
}

window.addEventListener('resize', layout);
layout();

// ── Game wiring ──────────────────────────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 1) || 1;
const targetOverride = Number(params.get('target') ?? 0);
const levelOverride = Number(params.get('level') ?? 0);

const state = createGameState({
  seed,
  ...(targetOverride > 0 ? { targetPercent: targetOverride } : {}),
});
if (levelOverride > 1) state.level = levelOverride;
const keyboard = new Keyboard();
keyboard.attach(window);
const effects = new Effects();
const audio = new AudioEngine();

// Autoplay policy: the context exists only after the first user gesture.
const tryUnlock = (): void => {
  if (!audio.unlocked) void audio.unlock();
};
window.addEventListener('keydown', tryUnlock);
window.addEventListener('pointerdown', tryUnlock);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') audio.resume();
});
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'KeyM') audio.setMuted(!audio.muted);
});

// Placeholder until Phase 6 high-score persistence.
const highScore = 30_000;
let lastClear: { finalPercent: number; bonus: number } | null = null;
let lastSplit: number | null = null;
let lastDeathCause: string | null = null;

function tickUpdate(): void {
  const events = update(state, keyboard.snapshot());
  effects.consume(events, state.marker);
  effects.step();
  routeAudioEvents(events, state, audio);
  for (const e of events) {
    if (e.type === 'levelClear') {
      lastClear = { finalPercent: e.finalPercent, bonus: e.bonus };
      lastSplit = null;
    } else if (e.type === 'split') {
      lastSplit = e.multiplier;
      lastClear = null;
    } else if (e.type === 'death') {
      lastDeathCause = e.cause;
    }
  }
}

function render(_alpha: number): void {
  const ctx = gameCtx;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.save();
  ctx.translate(0, HUD_H);
  renderPlayfield(state, ctx);
  for (const qix of state.qixes) {
    renderQix(ctx, qix);
  }
  for (const s of state.sparx) {
    renderSparx(ctx, s, state.tick);
  }
  effects.render(ctx, FIELD_W, FIELD_H);

  // Mode overlays (moves to the shell in Phase 6).
  const cx = FIELD_W / 2;
  switch (state.mode) {
    case 'levelIntro':
      drawTextCentered(ctx, 'PLAYER 1', cx, 100, COLORS.hudText, 2);
      drawTextCentered(ctx, `LEVEL ${state.level}`, cx, 124, COLORS.hudText, 2);
      break;
    case 'levelClear': {
      if (lastSplit !== null) {
        drawTextCentered(ctx, 'QIX SPLIT', cx, 100, COLORS.hudText, 2);
        drawTextCentered(ctx, `MULTIPLIER ${lastSplit}X`, cx, 124, COLORS.hudText, 2);
        break;
      }
      const pct = lastClear
        ? Math.floor(lastClear.finalPercent)
        : Math.floor(claimedPercent(state));
      const bonus = lastClear?.bonus ?? 0;
      drawTextCentered(ctx, `PERCENTAGE ${pct}%`, cx, 90, COLORS.hudText, 2);
      drawTextCentered(ctx, `THRESHOLD ${state.targetPercent}%`, cx, 114, COLORS.hudText, 2);
      drawTextCentered(
        ctx,
        `BONUS (${pct}-${state.targetPercent}) X 1000 = ${bonus}`,
        cx,
        138,
        COLORS.hudText,
      );
      break;
    }
    case 'gameOver':
      drawTextCentered(ctx, 'GAME OVER', cx, 112, COLORS.hudText, 2);
      break;
    default:
      break;
  }
  ctx.restore();

  const hud = hudCtx;
  hud.setTransform(scale, 0, 0, scale, 0, 0);
  renderHud(hud, state, Math.max(highScore, state.score));
  if (!audio.unlocked) {
    drawTextCentered(hud, 'KEY OR TAP FOR SOUND', LOGICAL_W / 2, 38, '#707070');
  } else if (audio.muted) {
    drawTextCentered(hud, 'MUTED (M)', LOGICAL_W / 2, 38, '#707070');
  }
}

const loop = new GameLoop({ update: tickUpdate, render });

if (isTestMode()) {
  installTestHooks(
    loop,
    state,
    () => lastDeathCause,
    () => ({
      unlocked: audio.unlocked,
      muted: audio.muted,
    }),
  );
  render(0);
} else {
  loop.start();
}
