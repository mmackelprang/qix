import { COLORS, HUD_H, LOGICAL_H, LOGICAL_W } from './config';
import { Keyboard } from './input/keyboard';
import { GameLoop } from './loop';
import { renderPlayfield } from './render/playfield';
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

const state = createGameState({ seed });
const keyboard = new Keyboard();
keyboard.attach(window);

function tickUpdate(): void {
  update(state, keyboard.snapshot());
}

function render(_alpha: number): void {
  const ctx = gameCtx;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.save();
  ctx.translate(0, HUD_H);
  renderPlayfield(state, ctx);
  ctx.restore();

  const hud = hudCtx;
  hud.setTransform(scale, 0, 0, scale, 0, 0);
  hud.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  hud.fillStyle = COLORS.hudText;
  hud.font = '8px monospace';
  hud.textBaseline = 'top';
  hud.fillText(`CLAIMED ${claimedPercent(state).toFixed(0)}% ${state.targetPercent}%`, 8, 8);
  hud.fillText(`TICK ${state.tick}`, 8, 20);
}

const loop = new GameLoop({ update: tickUpdate, render });

if (isTestMode()) {
  installTestHooks(loop, state);
  render(0);
} else {
  loop.start();
}
