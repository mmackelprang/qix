declare module 'zzfx' {
  /** ZzFX synth core. Only the pure-DSP surface we use is typed. */
  export const ZZFX: {
    sampleRate: number;
    volume: number;
    /** Render a parameter array to raw samples (no audio graph involved). */
    buildSamples: (...params: (number | undefined)[]) => Float32Array;
  };
  export function zzfx(...params: (number | undefined)[]): AudioBufferSourceNode;
}
