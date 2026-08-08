import { FIELD_H, FIELD_W, HUD_H, LOGICAL_H, LOGICAL_W } from '../config';
import { renderQix, renderSparx } from '../render/entities';
import { renderPlayfield } from '../render/playfield';
import { drawText, drawTextCentered } from '../render/text';
import { createQix } from '../sim/qix';
import { spawnSparxWave } from '../sim/sparx';
import { createGameState, type GameState, type InputSnapshot } from '../sim/state';
import { update } from '../sim/update';
import { DemoBot } from './demo';
import type { ScoreEntry } from './highscores';

/**
 * Attract mode (PRD §5): a scripted rotation — title → tutorial (the
 * original's instructional beats, each demonstrated by a real mini-sim) →
 * "QIX KICKERS" high scores → a self-playing demo game. Any start input
 * aborts to a fresh game (handled by the App shell).
 */

interface MiniScriptStep {
  dir?: 'up' | 'down' | 'left' | 'right';
  fast?: boolean;
  slow?: boolean;
  ticks: number;
}

interface Beat {
  lines: string[];
  ticks: number;
  demo?: {
    width: number;
    height: number;
    seed: number;
    script: MiniScriptStep[];
    withQix?: boolean;
    withSparx?: boolean;
    loop?: boolean;
  };
}

/** The original's attract text beats (pyqix transcription), adapted input. */
const BEATS: readonly Beat[] = [
  {
    lines: ['YOUR MARKER', 'CONTROLLED WITH ARROWS'],
    ticks: 300,
    demo: {
      width: 48,
      height: 40,
      seed: 2,
      loop: true,
      script: [
        { dir: 'left', ticks: 10 },
        { dir: 'up', ticks: 0 },
        { dir: 'right', ticks: 20 },
        { dir: 'left', ticks: 10 },
      ],
    },
  },
  {
    lines: ['TO DRAW STIX', 'PRESS FAST OR SLOW'],
    ticks: 300,
    demo: {
      width: 48,
      height: 40,
      seed: 2,
      loop: false,
      script: [
        { dir: 'left', ticks: 6 },
        { dir: 'up', fast: true, ticks: 8 },
        { dir: 'right', fast: true, ticks: 6 },
        { ticks: 600 },
      ],
    },
  },
  {
    lines: ['CLAIM AREAS', 'BY JOINING WALLS WITH STIX'],
    ticks: 360,
    demo: {
      width: 48,
      height: 40,
      seed: 2,
      loop: false,
      script: [
        { dir: 'left', ticks: 8 },
        { dir: 'up', fast: true, ticks: 10 },
        { dir: 'right', fast: true, ticks: 12 },
        { dir: 'down', fast: true, ticks: 10 },
        { ticks: 600 },
      ],
    },
  },
  {
    lines: ['SCORES BASED ON AREA', 'FAST SCORE 250', 'SLOW SCORE 500'],
    ticks: 420,
    demo: {
      width: 48,
      height: 40,
      seed: 2,
      loop: false,
      script: [
        { dir: 'left', ticks: 8 },
        { dir: 'up', fast: true, ticks: 10 },
        { dir: 'right', fast: true, ticks: 8 },
        { dir: 'down', fast: true, ticks: 10 },
        { dir: 'right', ticks: 4 },
        { dir: 'up', slow: true, ticks: 20 },
        { dir: 'right', slow: true, ticks: 16 },
        { dir: 'down', slow: true, ticks: 20 },
        { ticks: 600 },
      ],
    },
  },
  {
    lines: ['CLAIM MORE THAN 75%', 'OF PLAYFIELD', 'FOR SPECIAL BONUS'],
    ticks: 260,
  },
  {
    lines: ['YOUR OPPONENTS:', 'THE QIX'],
    ticks: 300,
    demo: { width: 48, height: 40, seed: 5, withQix: true, script: [{ ticks: 600 }] },
  },
  {
    lines: ['YOUR OPPONENTS:', 'SPARX'],
    ticks: 260,
    demo: { width: 48, height: 40, seed: 5, withSparx: true, script: [{ ticks: 600 }] },
  },
  {
    lines: ['YOUR OPPONENTS:', 'THE FUSE'],
    ticks: 320,
    demo: {
      width: 48,
      height: 40,
      seed: 5,
      script: [
        { dir: 'up', fast: true, ticks: 6 },
        { ticks: 600 }, // stall — the fuse ignites and burns
      ],
    },
  },
  {
    lines: ['YOUR OPPONENTS:', 'SPIRAL DEATH TRAP'],
    ticks: 400,
    demo: {
      width: 48,
      height: 40,
      seed: 5,
      script: [
        // Self-seal, then the fuse finishes the demonstration.
        { dir: 'up', fast: true, ticks: 3 },
        { dir: 'left', fast: true, ticks: 2 },
        { dir: 'down', fast: true, ticks: 1 },
        { dir: 'right', fast: true, ticks: 1 },
        { dir: 'up', fast: true, ticks: 1 },
        { ticks: 600 },
      ],
    },
  },
];

export type AttractSegment = 'title' | 'tutorial' | 'scores' | 'demo';

const TITLE_TICKS = 480;
const SCORES_TICKS = 420;
const DEMO_CAP_TICKS = 3600;

class ScriptPlayer {
  private step = 0;
  private tickInStep = 0;
  constructor(private readonly script: readonly MiniScriptStep[]) {}

  next(): InputSnapshot {
    let s = this.script[this.step];
    while (s !== undefined && this.tickInStep >= s.ticks) {
      this.step += 1;
      this.tickInStep = 0;
      s = this.script[this.step];
    }
    if (s === undefined) return { dir: null, fast: false, slow: false };
    this.tickInStep += 1;
    return { dir: s.dir ?? null, fast: s.fast ?? false, slow: s.slow ?? false };
  }

  get done(): boolean {
    return this.step >= this.script.length;
  }

  reset(): void {
    this.step = 0;
    this.tickInStep = 0;
  }
}

function makeMiniState(beat: Beat): GameState | null {
  const demo = beat.demo;
  if (!demo) return null;
  const s = createGameState({ width: demo.width, height: demo.height, seed: demo.seed });
  s.mode = 'playing';
  s.targetPercent = 101; // demos never end their level
  s.qixCell = { x: Math.floor(demo.width / 2), y: 4 };
  if (demo.withQix) {
    s.qixes = [createQix(s, { x: Math.floor(demo.width / 2), y: Math.floor(demo.height / 2) })];
  }
  if (demo.withSparx) {
    spawnSparxWave(s, false, []);
  }
  return s;
}

export class Attract {
  segment: AttractSegment = 'title';
  private segTicks = 0;
  private beatIdx = 0;
  private beatTicks = 0;
  private mini: GameState | null = null;
  private script: ScriptPlayer | null = null;
  private demoGame: GameState | null = null;
  private bot: DemoBot | null = null;
  tick = 0;

  constructor(private readonly getScores: () => ScoreEntry[]) {}

  private enterBeat(idx: number): void {
    this.beatIdx = idx;
    this.beatTicks = 0;
    const beat = BEATS[idx];
    this.mini = beat ? makeMiniState(beat) : null;
    this.script = beat?.demo ? new ScriptPlayer(beat.demo.script) : null;
  }

  private enterSegment(segment: AttractSegment): void {
    this.segment = segment;
    this.segTicks = 0;
    if (segment === 'tutorial') this.enterBeat(0);
    if (segment === 'demo') {
      this.demoGame = createGameState({ seed: 777 });
      this.bot = new DemoBot(1234);
    } else {
      this.demoGame = null;
      this.bot = null;
    }
  }

  /** Jump straight to a segment (used after name entry → scores). */
  showSegment(segment: AttractSegment): void {
    this.enterSegment(segment);
  }

  update(): void {
    this.tick += 1;
    this.segTicks += 1;
    switch (this.segment) {
      case 'title':
        if (this.segTicks >= TITLE_TICKS) this.enterSegment('tutorial');
        break;
      case 'tutorial': {
        const beat = BEATS[this.beatIdx];
        if (!beat) {
          this.enterSegment('scores');
          break;
        }
        this.beatTicks += 1;
        if (this.mini && this.script) {
          const input = this.script.next();
          const demo = beat.demo;
          if (demo?.loop && this.script.done) this.script.reset();
          // Mini demos freeze rather than run death sequences to the end.
          if (this.mini.mode === 'playing' || this.mini.mode === 'death') {
            if (this.mini.mode === 'playing') update(this.mini, input);
          }
        }
        if (this.beatTicks >= beat.ticks) {
          if (this.beatIdx + 1 >= BEATS.length) this.enterSegment('scores');
          else this.enterBeat(this.beatIdx + 1);
        }
        break;
      }
      case 'scores':
        if (this.segTicks >= SCORES_TICKS) this.enterSegment('demo');
        break;
      case 'demo': {
        const game = this.demoGame;
        const bot = this.bot;
        if (!game || !bot) {
          this.enterSegment('title');
          break;
        }
        update(game, bot.next(game));
        if (game.mode === 'gameOver' || this.segTicks >= DEMO_CAP_TICKS) {
          if (game.modeTicks > 180 || this.segTicks >= DEMO_CAP_TICKS) {
            this.enterSegment('title');
          }
        }
        break;
      }
      default: {
        const exhaustive: never = this.segment;
        throw new Error(exhaustive);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const cx = LOGICAL_W / 2;
    switch (this.segment) {
      case 'title': {
        drawTextCentered(ctx, 'QIX', cx, 60, '#ffffff', 8);
        drawTextCentered(ctx, 'A FAITHFUL RECREATION', cx, 140, '#707070');
        const top = this.getScores()[0];
        drawTextCentered(ctx, `HIGH SCORE ${top ? top.score : 30000}`, cx, 170, '#ffd020');
        if (Math.floor(this.tick / 30) % 2 === 0) {
          drawTextCentered(ctx, 'PRESS SPACE TO START', cx, 220, '#ffd020', 2);
        }
        drawTextCentered(ctx, 'ARROWS MOVE - X FAST - Z SLOW - M MUTE', cx, 280, '#505050');
        break;
      }
      case 'tutorial': {
        const beat = BEATS[this.beatIdx];
        if (!beat) break;
        let y = 34;
        for (const line of beat.lines) {
          drawTextCentered(ctx, line, cx, y, '#ffd020', 2);
          y += 22;
        }
        if (this.mini) {
          const scale = 2.2;
          const w = this.mini.grid.w * scale;
          ctx.save();
          ctx.translate(Math.round(cx - w / 2), 130);
          ctx.scale(scale, scale);
          renderPlayfield(this.mini, ctx);
          for (const qix of this.mini.qixes) renderQix(ctx, qix);
          for (const sp of this.mini.sparx) renderSparx(ctx, sp, this.tick);
          ctx.restore();
        }
        break;
      }
      case 'scores': {
        drawTextCentered(ctx, 'QIX KICKERS', cx, 40, '#ffd020', 2);
        const entries = this.getScores();
        let y = 80;
        entries.forEach((e, i) => {
          const rank = `${i + 1}`.padStart(2, ' ');
          const score = `${e.score}`.padStart(6, '0');
          drawText(
            ctx,
            `${rank}  ${score}  ${e.name}${e.custom ? ' -' : ''}`,
            cx - 60,
            y,
            '#ffffff',
          );
          y += 18;
        });
        break;
      }
      case 'demo': {
        const game = this.demoGame;
        if (!game) break;
        ctx.save();
        ctx.translate(0, HUD_H);
        renderPlayfield(game, ctx);
        for (const qix of game.qixes) renderQix(ctx, qix);
        for (const sp of game.sparx) renderSparx(ctx, sp, this.tick);
        ctx.restore();
        // Alternating captions, as the original's demo game.
        const caption = Math.floor(this.tick / 300) % 2 === 0 ? 'EVADE QIX' : 'DODGE SPARX';
        if (game.mode === 'playing') {
          drawTextCentered(ctx, caption, cx, HUD_H + FIELD_H / 2 - 30, '#ffd020', 2);
        }
        if (game.mode === 'gameOver') {
          drawTextCentered(ctx, 'GAME OVER', cx, HUD_H + FIELD_H / 2, '#ffd020', 2);
        }
        break;
      }
      default:
        break;
    }
    if (this.segment !== 'title') {
      drawTextCentered(ctx, 'PRESS SPACE TO START', cx, LOGICAL_H - 14, '#707070');
    }
    void FIELD_W;
  }
}
