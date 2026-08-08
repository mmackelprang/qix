import { AudioEngine } from './audio/engine';
import { LOGICAL_H, LOGICAL_W } from './config';
import { GamepadInput } from './input/gamepad';
import { Keyboard } from './input/keyboard';
import { TouchControls, touchEnabled } from './input/touch';
import { GameLoop } from './loop';
import { drawTextCentered } from './render/text';
import { App } from './shell/app';
import type { InputSnapshot } from './sim/state';
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

// ── Shell wiring ─────────────────────────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 1) || 1;
const targetOverride = Number(params.get('target') ?? 0);
const levelOverride = Number(params.get('level') ?? 0);
const livesOverride = Number(params.get('lives') ?? 0);

const keyboard = new Keyboard();
keyboard.attach(window);
const touch = new TouchControls();
const gamepad = new GamepadInput();
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

const app = new App(
  audio,
  {
    seed,
    ...(targetOverride > 0 ? { targetPercent: targetOverride } : {}),
    ...(levelOverride > 1 ? { level: levelOverride } : {}),
    ...(livesOverride > 0 ? { lives: livesOverride } : {}),
  },
  isTestMode() && params.has('autostart'),
);

const stage = document.getElementById('stage');
if (stage) touch.mount(document.body, stage);
touch.setVisible(touchEnabled(app.settings.touch));
app.onSettingsChanged = (settings): void => {
  touch.setVisible(touchEnabled(settings.touch));
};

function mergedSnapshot(): InputSnapshot {
  const k = keyboard.snapshot();
  const t = touch.snapshot();
  const g = gamepad.snapshot();
  return {
    dir: t.dir ?? g.dir ?? k.dir,
    fast: k.fast || t.fast || g.fast,
    slow: k.slow || t.slow || g.slow,
  };
}

function tickUpdate(): void {
  app.update(mergedSnapshot(), [
    ...keyboard.drainPressed(),
    ...touch.drainPressed(),
    ...gamepad.drainPressed(),
  ]);
}

function render(_alpha: number): void {
  gameCtx.setTransform(scale, 0, 0, scale, 0, 0);
  hudCtx.setTransform(scale, 0, 0, scale, 0, 0);
  app.render(gameCtx, hudCtx);
  if (!audio.unlocked) {
    drawTextCentered(hudCtx, 'KEY OR TAP FOR SOUND', LOGICAL_W / 2, 38, '#707070');
  } else if (audio.muted) {
    drawTextCentered(hudCtx, 'MUTED (M)', LOGICAL_W / 2, 38, '#707070');
  }
}

const loop = new GameLoop({ update: tickUpdate, render });

if (isTestMode()) {
  installTestHooks(loop, app, () => ({
    unlocked: audio.unlocked,
    muted: audio.muted,
  }));
  render(0);
} else {
  loop.start();
}
