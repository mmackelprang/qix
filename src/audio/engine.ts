import { SFX, type SfxName } from './sfx';

export type LoopName = 'drone' | 'drawFast' | 'drawSlow' | 'fuse';

/**
 * The surface the event router talks to — implemented for real by
 * AudioEngine and by a fake in unit tests (TD §11).
 */
export interface AudioSink {
  play(name: SfxName): void;
  startLoop(name: LoopName): void;
  stopLoop(name: LoopName): void;
  stopAllLoops(): void;
  setDroneIntensity(v: number): void;
}

interface StoredAudioPrefs {
  volume: number;
  muted: boolean;
}

const PREFS_KEY = 'qix.audio.v1';

function loadPrefs(): StoredAudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredAudioPrefs>;
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : 1,
        muted: parsed.muted === true,
      };
    }
  } catch {
    // Corrupt storage falls back to defaults — never throw (TD §10).
  }
  return { volume: 1, muted: false };
}

/**
 * Web Audio engine (TD §7): lazy context created on the first user gesture
 * (autoplay policy), master gain → compressor → destination, a bed bus for
 * loops that the fuse hiss ducks, and zzfx-rendered one-shot SFX.
 */
export class AudioEngine implements AudioSink {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bed: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private loops = new Map<LoopName, { nodes: AudioNode[]; gain: GainNode }>();
  private buffers = new Map<SfxName, AudioBuffer>();
  private droneOsc: OscillatorNode[] = [];
  private droneGainTarget = 0.06;
  private prefs = loadPrefs();
  private zzfxBuild: ((...params: (number | undefined)[]) => Float32Array) | null = null;
  private zzfxRate = 44100;

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  get muted(): boolean {
    return this.prefs.muted;
  }

  get volume(): number {
    return this.prefs.volume;
  }

  /** Create/resume the context. Must be called from a user-gesture handler. */
  async unlock(): Promise<void> {
    if (this.ctx === null) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      const compressor = this.ctx.createDynamicsCompressor();
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.bed = this.ctx.createGain();
      this.bed.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.applyVolume();
      const mod = await import('zzfx');
      this.zzfxBuild = (...params) => mod.ZZFX.buildSamples(...params);
      this.zzfxRate = mod.ZZFX.sampleRate;
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /** Re-resume after tab visibility changes (iOS suspends aggressively). */
  resume(): void {
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.prefs.muted = muted;
    this.persist();
    this.applyVolume();
  }

  setVolume(volume: number): void {
    this.prefs.volume = Math.max(0, Math.min(1, volume));
    this.persist();
    this.applyVolume();
  }

  private persist(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      // Storage full/blocked: preferences just don't persist.
    }
  }

  private applyVolume(): void {
    if (this.master && this.ctx) {
      const v = this.prefs.muted ? 0 : this.prefs.volume;
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    const build = this.zzfxBuild;
    if (!ctx || !bus || !build) return;
    let buffer = this.buffers.get(name);
    if (!buffer) {
      const samples = build(...SFX[name]);
      buffer = ctx.createBuffer(1, samples.length, this.zzfxRate);
      buffer.getChannelData(0).set(samples);
      this.buffers.set(name, buffer);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(bus);
    src.start();
  }

  startLoop(name: LoopName): void {
    const ctx = this.ctx;
    const bed = this.bed;
    const bus = this.sfxBus;
    if (!ctx || !bed || !bus || this.loops.has(name)) return;
    const gain = ctx.createGain();
    const nodes: AudioNode[] = [];
    switch (name) {
      case 'drone': {
        gain.gain.value = this.droneGainTarget;
        for (const detune of [0, 7]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = 48;
          osc.detune.value = detune;
          osc.connect(gain);
          osc.start();
          nodes.push(osc);
          this.droneOsc.push(osc);
        }
        gain.connect(bed);
        break;
      }
      case 'drawFast':
      case 'drawSlow': {
        gain.gain.value = 0.045;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = name === 'drawFast' ? 196 : 98;
        osc.connect(gain);
        osc.start();
        nodes.push(osc);
        gain.connect(bed);
        break;
      }
      case 'fuse': {
        // Filtered noise loop — routed to the SFX bus and ducks the bed
        // so the warning always cuts through (PRD §6.2).
        gain.gain.value = 0.14;
        const len = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let noiseState = 1;
        for (let i = 0; i < len; i += 1) {
          // Deterministic LCG noise — no Math.random even here.
          noiseState = (noiseState * 48271) % 2147483647;
          data[i] = (noiseState / 2147483647) * 2 - 1;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2400;
        filter.Q.value = 0.8;
        src.connect(filter);
        filter.connect(gain);
        src.start();
        nodes.push(src, filter);
        gain.connect(bus);
        bed.gain.setTargetAtTime(0.25, ctx.currentTime, 0.05);
        break;
      }
      default: {
        const exhaustive: never = name;
        throw new Error(exhaustive);
      }
    }
    this.loops.set(name, { nodes, gain });
  }

  stopLoop(name: LoopName): void {
    const ctx = this.ctx;
    const loop = this.loops.get(name);
    if (!ctx || !loop) return;
    this.loops.delete(name);
    loop.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    for (const node of loop.nodes) {
      if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
        node.stop(ctx.currentTime + 0.2);
      }
    }
    if (name === 'drone') this.droneOsc = [];
    if (name === 'fuse' && this.bed) {
      this.bed.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
    }
  }

  stopAllLoops(): void {
    for (const name of [...this.loops.keys()]) {
      this.stopLoop(name);
    }
  }

  /** Drone rises subtly as claimed % approaches the target (PRD §6.1). */
  setDroneIntensity(v: number): void {
    const ctx = this.ctx;
    const loop = this.loops.get('drone');
    if (!ctx || !loop) return;
    const clamped = Math.max(0, Math.min(1, v));
    loop.gain.gain.setTargetAtTime(this.droneGainTarget * (1 + clamped), ctx.currentTime, 0.3);
    for (const osc of this.droneOsc) {
      osc.frequency.setTargetAtTime(48 * (1 + clamped * 0.25), ctx.currentTime, 0.5);
    }
  }
}
