import type { SimEvent } from '../../src/sim/events';
import type { Dir } from '../../src/sim/grid';
import type { GameState, InputSnapshot } from '../../src/sim/state';
import { update } from '../../src/sim/update';

/** One scripted input held for a number of ticks. */
export interface ScriptStep {
  dir?: Dir;
  fast?: boolean;
  slow?: boolean;
  ticks: number;
}

/** Drive the sim with a scripted input sequence; returns all emitted events. */
export function runScript(state: GameState, steps: readonly ScriptStep[]): SimEvent[] {
  const events: SimEvent[] = [];
  for (const step of steps) {
    const input: InputSnapshot = {
      dir: step.dir ?? null,
      fast: step.fast ?? false,
      slow: step.slow ?? false,
    };
    for (let i = 0; i < step.ticks; i += 1) {
      events.push(...update(state, input));
    }
  }
  return events;
}
