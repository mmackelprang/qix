import type { AudioEngine } from '../audio/engine';
import { routeAudioEvents } from '../audio/router';
import { COLORS, FIELD_H, FIELD_W, HUD_H, LOGICAL_H, LOGICAL_W } from '../config';
import { Effects } from '../render/effects';
import { renderQix, renderSparx } from '../render/entities';
import { renderHud } from '../render/hud';
import { renderPlayfield } from '../render/playfield';
import { drawTextCentered } from '../render/text';
import {
  claimedPercent,
  createGameState,
  type GameState,
  type InputSnapshot,
  type NewGameOptions,
} from '../sim/state';
import { update } from '../sim/update';
import { Attract, type AttractSegment } from './attract';
import {
  defaultTable,
  insertScore,
  loadScores,
  qualifies,
  type ScoreEntry,
  saveScores,
} from './highscores';
import {
  DEFAULT_SETTINGS,
  isCustom,
  loadSettings,
  SETTING_RANGES,
  type Settings,
  saveSettings,
} from './settings';

/**
 * The meta-game shell (TD §5.8): attract ⇄ game → name entry → attract,
 * plus pause. Owns the audio routing, render effects, and high scores.
 */

export type AppPhase = 'attract' | 'game' | 'nameEntry' | 'settings';

const GAME_OVER_HOLD_TICKS = 240;
const START_CODES = new Set(['Enter', 'Space']);
const NAME_LEN = 3;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

interface NameEntry {
  score: number;
  custom: boolean;
  chars: string[];
  slot: number;
}

const SETTING_ROWS = [
  'target',
  'lives',
  'sparxTime',
  'speed',
  'volume',
  'touch',
  'reset',
  'back',
] as const;
type SettingRow = (typeof SETTING_ROWS)[number];

export class App {
  phase: AppPhase = 'attract';
  readonly attract: Attract;
  game: GameState | null = null;
  paused = false;
  nameEntry: NameEntry | null = null;
  private scores: ScoreEntry[];
  private effects = new Effects();
  private lastClear: { finalPercent: number; bonus: number } | null = null;
  private lastSplit: number | null = null;
  lastDeathCause: string | null = null;
  private shellTick = 0;
  settings: Settings;
  private settingsRow = 0;
  private resetArmed = false;
  /** Notified when settings change (e.g. touch-control visibility). */
  onSettingsChanged: ((settings: Settings) => void) | null = null;

  constructor(
    private readonly audio: AudioEngine,
    private readonly gameOptions: NewGameOptions & { level?: number },
    autostart = false,
  ) {
    this.scores = loadScores();
    this.settings = loadSettings();
    this.attract = new Attract(() => this.scores);
    if (autostart) this.startGame();
  }

  get highScore(): number {
    return Math.max(this.scores[0]?.score ?? 0, this.game?.score ?? 0);
  }

  get customSettings(): boolean {
    return (
      isCustom(this.settings) ||
      (this.gameOptions.targetPercent !== undefined &&
        this.gameOptions.targetPercent !== DEFAULT_SETTINGS.targetPercent) ||
      (this.gameOptions.lives !== undefined && this.gameOptions.lives !== DEFAULT_SETTINGS.lives) ||
      (this.gameOptions.sparxTimeS !== undefined &&
        this.gameOptions.sparxTimeS !== DEFAULT_SETTINGS.sparxTimeS)
    );
  }

  getScores(): ScoreEntry[] {
    return this.scores;
  }

  /** Test-mode only: replace the table (e2e name-entry UAT). */
  setScores(entries: ScoreEntry[]): void {
    this.scores = entries;
    saveScores(entries);
  }

  startGame(): void {
    const { level, ...urlOpts } = this.gameOptions;
    const game = createGameState({
      targetPercent: this.settings.targetPercent,
      lives: this.settings.lives,
      sparxTimeS: this.settings.sparxTimeS,
      speedPercent: this.settings.speedPercent,
      ...urlOpts,
    });
    if (level !== undefined && level > 1) game.level = level;
    this.game = game;
    this.phase = 'game';
    this.paused = false;
    this.effects = new Effects();
    this.lastClear = null;
    this.lastSplit = null;
    this.lastDeathCause = null;
  }

  private toAttract(segment: AttractSegment = 'title'): void {
    this.phase = 'attract';
    this.game = null;
    this.paused = false;
    this.audio.stopAllLoops();
    this.attract.showSegment(segment);
  }

  private finishGame(game: GameState): void {
    if (qualifies(game.score, this.scores)) {
      this.phase = 'nameEntry';
      this.nameEntry = {
        score: game.score,
        custom: this.customSettings,
        chars: ['A', 'A', 'A'],
        slot: 0,
      };
      this.game = null;
      this.audio.stopAllLoops();
    } else {
      this.toAttract('title');
    }
  }

  private adjustSetting(row: SettingRow, delta: number): void {
    const st = this.settings;
    switch (row) {
      case 'target': {
        const r = SETTING_RANGES.targetPercent;
        st.targetPercent = Math.min(r.max, Math.max(r.min, st.targetPercent + delta * r.step));
        break;
      }
      case 'lives': {
        const r = SETTING_RANGES.lives;
        st.lives = Math.min(r.max, Math.max(r.min, st.lives + delta * r.step));
        break;
      }
      case 'sparxTime': {
        const r = SETTING_RANGES.sparxTimeS;
        st.sparxTimeS = Math.min(r.max, Math.max(r.min, st.sparxTimeS + delta * r.step));
        break;
      }
      case 'speed': {
        const r = SETTING_RANGES.speedPercent;
        st.speedPercent = Math.min(r.max, Math.max(r.min, st.speedPercent + delta * r.step));
        break;
      }
      case 'volume':
        this.audio.setVolume(Math.round((this.audio.volume + delta * 0.1) * 10) / 10);
        break;
      case 'touch': {
        const order = ['auto', 'on', 'off'] as const;
        const idx = (order.indexOf(st.touch) + delta + order.length) % order.length;
        st.touch = order[idx] as Settings['touch'];
        break;
      }
      default:
        break;
    }
    saveSettings(st);
    this.onSettingsChanged?.(st);
  }

  private updateSettings(pressed: readonly string[]): void {
    for (const code of pressed) {
      const row = SETTING_ROWS[this.settingsRow] as SettingRow;
      if (code === 'ArrowUp') {
        this.settingsRow = (this.settingsRow + SETTING_ROWS.length - 1) % SETTING_ROWS.length;
        this.resetArmed = false;
        this.audio.play('blip');
      } else if (code === 'ArrowDown') {
        this.settingsRow = (this.settingsRow + 1) % SETTING_ROWS.length;
        this.resetArmed = false;
        this.audio.play('blip');
      } else if (code === 'ArrowLeft' || code === 'ArrowRight') {
        this.adjustSetting(row, code === 'ArrowLeft' ? -1 : 1);
        this.audio.play('blip');
      } else if (START_CODES.has(code)) {
        if (row === 'reset') {
          if (this.resetArmed) {
            this.setScores(defaultTable());
            this.resetArmed = false;
            this.audio.play('death');
          } else {
            this.resetArmed = true;
            this.audio.play('blip');
          }
        } else if (row === 'back') {
          this.phase = 'attract';
          this.attract.showSegment('title');
          this.audio.play('blip');
        }
      } else if (code === 'Escape') {
        this.phase = 'attract';
        this.attract.showSegment('title');
        this.audio.play('blip');
      }
    }
  }

  /** One 60 Hz tick: `pressed` are the key codes newly down this tick. */
  update(input: InputSnapshot, pressed: readonly string[]): void {
    this.shellTick += 1;
    switch (this.phase) {
      case 'attract': {
        if (pressed.some((c) => START_CODES.has(c))) {
          this.audio.play('blip');
          this.startGame();
          break;
        }
        if (pressed.includes('KeyS') && this.attract.segment === 'title') {
          this.audio.play('blip');
          this.phase = 'settings';
          this.settingsRow = 0;
          this.resetArmed = false;
          break;
        }
        this.attract.update();
        break;
      }
      case 'settings': {
        this.updateSettings(pressed);
        break;
      }
      case 'game': {
        const game = this.game;
        if (!game) {
          this.toAttract();
          break;
        }
        if (pressed.includes('Escape') || pressed.includes('KeyP')) {
          this.paused = !this.paused;
          this.audio.stopAllLoops();
          this.audio.play('blip');
          if (!this.paused && game.mode === 'playing') {
            this.audio.startLoop('drone');
          }
        }
        if (this.paused) {
          if (pressed.includes('KeyQ')) this.toAttract();
          break;
        }
        const events = update(game, input);
        this.effects.consume(events, game.marker);
        this.effects.step();
        routeAudioEvents(events, game, this.audio);
        for (const e of events) {
          if (e.type === 'levelClear') {
            this.lastClear = { finalPercent: e.finalPercent, bonus: e.bonus };
            this.lastSplit = null;
          } else if (e.type === 'split') {
            this.lastSplit = e.multiplier;
            this.lastClear = null;
          } else if (e.type === 'death') {
            this.lastDeathCause = e.cause;
          }
        }
        if (game.mode === 'gameOver' && game.modeTicks >= GAME_OVER_HOLD_TICKS) {
          this.finishGame(game);
        }
        break;
      }
      case 'nameEntry': {
        const entry = this.nameEntry;
        if (!entry) {
          this.toAttract();
          break;
        }
        for (const code of pressed) {
          if (code.startsWith('Key') && code.length === 4) {
            entry.chars[entry.slot] = code[3] as string;
            entry.slot = Math.min(NAME_LEN - 1, entry.slot + 1);
            this.audio.play('blip');
          } else if (code === 'ArrowUp' || code === 'ArrowDown') {
            const cur = ALPHABET.indexOf(entry.chars[entry.slot] ?? 'A');
            const delta = code === 'ArrowUp' ? 1 : ALPHABET.length - 1;
            entry.chars[entry.slot] = ALPHABET[(cur + delta) % ALPHABET.length] as string;
            this.audio.play('blip');
          } else if (code === 'ArrowLeft') {
            entry.slot = Math.max(0, entry.slot - 1);
          } else if (code === 'ArrowRight') {
            entry.slot = Math.min(NAME_LEN - 1, entry.slot + 1);
          } else if (START_CODES.has(code) || code === 'KeyX') {
            const name = entry.chars.join('').trimEnd() || 'AAA';
            this.scores = insertScore(this.scores, {
              name,
              score: entry.score,
              custom: entry.custom,
            }).entries;
            saveScores(this.scores);
            this.nameEntry = null;
            this.audio.play('levelClear');
            this.toAttract('scores');
            break;
          }
        }
        break;
      }
      default: {
        const exhaustive: never = this.phase;
        throw new Error(exhaustive);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, hud: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    switch (this.phase) {
      case 'attract':
        hud.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
        this.attract.render(ctx);
        break;
      case 'settings': {
        hud.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
        const cx = LOGICAL_W / 2;
        drawTextCentered(ctx, 'OPERATOR SETTINGS', cx, 40, '#ffd020', 2);
        const st = this.settings;
        const rows: [SettingRow, string, string][] = [
          ['target', 'CLAIM TARGET', `${st.targetPercent}%`],
          ['lives', 'LIVES', `${st.lives}`],
          ['sparxTime', 'SPARX TIME', `${st.sparxTimeS}S`],
          ['speed', 'GAME SPEED', `${st.speedPercent}%`],
          ['volume', 'VOLUME', `${Math.round(this.audio.volume * 100)}%`],
          ['touch', 'TOUCH', st.touch.toUpperCase()],
          ['reset', this.resetArmed ? 'RESET SCORES - SURE?' : 'RESET SCORES', ''],
          ['back', 'BACK', ''],
        ];
        let y = 90;
        rows.forEach(([, label, value], i) => {
          const active = i === this.settingsRow;
          const color = active ? '#ffffff' : '#909090';
          drawTextCentered(ctx, value ? `${label}  ${value}` : label, cx, y, color, active ? 2 : 1);
          y += active ? 26 : 20;
        });
        drawTextCentered(
          ctx,
          'ARROWS ADJUST - SPACE SELECT - ESC BACK',
          cx,
          LOGICAL_H - 20,
          '#505050',
        );
        break;
      }
      case 'nameEntry': {
        hud.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
        const entry = this.nameEntry;
        if (!entry) break;
        const cx = LOGICAL_W / 2;
        drawTextCentered(ctx, 'YOU MADE THE QIX KICKERS', cx, 60, '#ffd020', 2);
        drawTextCentered(ctx, `SCORE ${entry.score}`, cx, 100, '#ffffff', 2);
        drawTextCentered(ctx, 'ENTER YOUR NAME', cx, 140, '#ffd020');
        const nameStr = entry.chars.join(' ');
        drawTextCentered(ctx, nameStr, cx, 170, '#ffffff', 3);
        // Cursor under the active slot.
        const slotW = 6 * 3 * 2;
        const x0 = cx - slotW * 1.5 + entry.slot * slotW + slotW / 2;
        if (Math.floor(this.shellTick / 15) % 2 === 0) {
          drawTextCentered(ctx, '-', x0, 196, '#ffd020', 3);
        }
        drawTextCentered(ctx, 'TYPE OR ARROWS - SPACE TO CONFIRM', cx, 240, '#707070');
        break;
      }
      case 'game': {
        const game = this.game;
        if (!game) break;
        ctx.save();
        ctx.translate(0, HUD_H);
        renderPlayfield(game, ctx);
        for (const qix of game.qixes) renderQix(ctx, qix);
        for (const sp of game.sparx) renderSparx(ctx, sp, game.tick);
        this.effects.render(ctx, FIELD_W, FIELD_H);
        const cx = FIELD_W / 2;
        switch (game.mode) {
          case 'levelIntro':
            drawTextCentered(ctx, 'PLAYER 1', cx, 100, COLORS.hudText, 2);
            drawTextCentered(ctx, `LEVEL ${game.level}`, cx, 124, COLORS.hudText, 2);
            break;
          case 'levelClear': {
            if (this.lastSplit !== null) {
              drawTextCentered(ctx, 'QIX SPLIT', cx, 100, COLORS.hudText, 2);
              drawTextCentered(ctx, `MULTIPLIER ${this.lastSplit}X`, cx, 124, COLORS.hudText, 2);
              break;
            }
            const pct = this.lastClear
              ? Math.floor(this.lastClear.finalPercent)
              : Math.floor(claimedPercent(game));
            const bonus = this.lastClear?.bonus ?? 0;
            drawTextCentered(ctx, `PERCENTAGE ${pct}%`, cx, 90, COLORS.hudText, 2);
            drawTextCentered(ctx, `THRESHOLD ${game.targetPercent}%`, cx, 114, COLORS.hudText, 2);
            drawTextCentered(
              ctx,
              `BONUS (${pct}-${game.targetPercent}) X 1000 = ${bonus}`,
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
        if (this.paused) {
          drawTextCentered(ctx, 'PAUSED', cx, 100, '#ffffff', 3);
          drawTextCentered(ctx, 'ESC RESUME - Q QUIT', cx, 140, '#707070');
        }
        ctx.restore();
        renderHud(hud, game, this.highScore);
        break;
      }
      default:
        break;
    }
  }
}
