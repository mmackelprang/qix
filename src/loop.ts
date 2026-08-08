import { TICK_MS } from './config';

export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed tick. */
  update: () => void;
  /** Draw the current state; alpha ∈ [0,1) is the fraction into the next tick. */
  render: (alpha: number) => void;
}

/**
 * Fixed-timestep accumulator loop ("Fix Your Timestep"): simulation always
 * steps in whole 60 Hz ticks regardless of display refresh; rendering
 * happens once per animation frame with an interpolation alpha.
 *
 * The loop can also be driven manually via `step()` — used by tests and the
 * e2e hooks to advance deterministically without wall-clock time.
 */
export class GameLoop {
  private acc = 0;
  private last: number | null = null;
  private rafId: number | null = null;
  private tickCount = 0;

  constructor(private readonly cb: LoopCallbacks) {}

  get ticks(): number {
    return this.tickCount;
  }

  get running(): boolean {
    return this.rafId !== null;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.last = null;
    const frame = (now: number): void => {
      this.rafId = requestAnimationFrame(frame);
      if (this.last === null) {
        this.last = now;
        this.cb.render(0);
        return;
      }
      // Clamp long gaps (tab hidden, debugger) to avoid a spiral of death.
      this.acc += Math.min(now - this.last, 250);
      this.last = now;
      while (this.acc >= TICK_MS) {
        this.cb.update();
        this.tickCount += 1;
        this.acc -= TICK_MS;
      }
      this.cb.render(this.acc / TICK_MS);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Synchronously advance n ticks and render once (test/deterministic mode). */
  step(n: number): void {
    for (let i = 0; i < n; i += 1) {
      this.cb.update();
      this.tickCount += 1;
    }
    this.cb.render(0);
  }
}
