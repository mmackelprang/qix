import { COLORS, FIELD_H, FIELD_W, HUD_H, LOGICAL_H, LOGICAL_W } from './config';
import { GameLoop } from './loop';
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

// ── Phase 0 placeholder simulation & render ──────────────────────────────
// A black playfield with a white border and a live tick counter, proving out
// the loop, scaling, and test hooks. Replaced by the real sim in Phase 1.

let tick = 0;

function update(): void {
  tick += 1;
}

function render(_alpha: number): void {
  const ctx = gameCtx;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Playfield border (walls will replace this in Phase 1).
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, HUD_H + 0.5, FIELD_W - 1, FIELD_H - 1);

  // HUD placeholder.
  const hud = hudCtx;
  hud.setTransform(scale, 0, 0, scale, 0, 0);
  hud.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  hud.fillStyle = COLORS.hudText;
  hud.font = '8px monospace';
  hud.textBaseline = 'top';
  hud.fillText('QIX — PHASE 0', 8, 8);
  hud.fillText(`TICK ${tick}`, 8, 20);
}

const loop = new GameLoop({ update, render });

if (isTestMode()) {
  installTestHooks(loop);
  render(0);
} else {
  loop.start();
}
