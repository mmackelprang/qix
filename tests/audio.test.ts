import { describe, expect, it } from 'vitest';
import type { AudioSink, LoopName } from '../src/audio/engine';
import { routeAudioEvents } from '../src/audio/router';
import type { SfxName } from '../src/audio/sfx';
import type { SimEvent } from '../src/sim/events';
import { createGameState, IDLE_INPUT } from '../src/sim/state';
import { update } from '../src/sim/update';
import { runScript } from './helpers/script';

/** Fake sink recording plays and tracking live loops (TD §11). */
class FakeSink implements AudioSink {
  played: SfxName[] = [];
  active = new Set<LoopName>();
  droneIntensity = -1;

  play(name: SfxName): void {
    this.played.push(name);
  }
  startLoop(name: LoopName): void {
    this.active.add(name);
  }
  stopLoop(name: LoopName): void {
    this.active.delete(name);
  }
  stopAllLoops(): void {
    this.active.clear();
  }
  setDroneIntensity(v: number): void {
    this.droneIntensity = v;
  }
}

const playingState = () => {
  const s = createGameState({ width: 32, height: 32, seed: 3, speedPercent: 200 });
  s.mode = 'playing';
  s.qixes = [];
  s.sparx = [];
  s.qixCell = { x: 24, y: 8 };
  return s;
};

const route = (events: SimEvent[], sink: FakeSink, state = playingState()) => {
  routeAudioEvents(events, state, sink);
};

describe('audio event routing (PRD §6)', () => {
  it('level start brings up the drone and a spawn chime', () => {
    const sink = new FakeSink();
    route([{ type: 'levelStart', level: 1 }], sink);
    expect(sink.active.has('drone')).toBe(true);
    expect(sink.played).toContain('spawn');
  });

  it('draw loops start per class and stop on drawStop', () => {
    const sink = new FakeSink();
    route([{ type: 'drawStart', cls: 'fast' }], sink);
    expect(sink.active.has('drawFast')).toBe(true);
    route([{ type: 'drawStop' }], sink);
    expect(sink.active.has('drawFast')).toBe(false);
    route([{ type: 'drawStart', cls: 'slow' }], sink);
    expect(sink.active.has('drawSlow')).toBe(true);
  });

  it('fills play by claim class', () => {
    const sink = new FakeSink();
    route(
      [
        {
          type: 'claim',
          deltaCells: 10,
          deltaPercent: 1,
          cls: 'slow',
          bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        },
      ],
      sink,
    );
    expect(sink.played).toContain('fillSlow');
  });

  it('the fuse hiss is loop-gated by fuseStart/fuseStop', () => {
    const sink = new FakeSink();
    route([{ type: 'fuseStart' }], sink);
    expect(sink.active.has('fuse')).toBe(true);
    route([{ type: 'fuseStop' }], sink);
    expect(sink.active.has('fuse')).toBe(false);
  });

  it('death, level clear, split and game over never leave loops running', () => {
    for (const terminal of [
      { type: 'death', cause: 'qix' },
      { type: 'levelClear', finalPercent: 80, bonus: 5000 },
      { type: 'split', multiplier: 2 },
      { type: 'gameOver', finalScore: 1234 },
    ] as SimEvent[]) {
      const sink = new FakeSink();
      route([{ type: 'drawStart', cls: 'fast' }, { type: 'fuseStart' }], sink);
      expect(sink.active.size).toBeGreaterThan(0);
      route([terminal], sink);
      expect(sink.active.size).toBe(0);
    }
  });

  it('a real fuse-death playthrough ends with no loops active', () => {
    const s = playingState();
    const sink = new FakeSink();
    routeAudioEvents(runScript(s, [{ dir: 'up', fast: true, ticks: 5 }]), s, sink);
    expect(sink.active.has('drawFast')).toBe(true);
    // Stall until the fuse kills.
    for (let t = 0; t < 200 && s.mode === 'playing'; t += 1) {
      routeAudioEvents(update(s, IDLE_INPUT), s, sink);
    }
    expect(s.mode).toBe('death');
    expect(sink.active.size).toBe(0);
    expect(sink.played).toContain('death');
  });

  it('drone intensity follows progress toward the target', () => {
    const sink = new FakeSink();
    const s = playingState();
    s.claimedCells = Math.floor(s.grid.totalCells * 0.375); // 37.5% of 75%
    route([], sink, s);
    expect(sink.droneIntensity).toBeCloseTo(0.5);
  });
});
