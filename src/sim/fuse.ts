import { FUSE } from '../config';
import type { SimEvent } from './events';
import type { GameState } from './state';

/**
 * The Fuse (TD §5.7): stalling mid-draw starts the fuse sound immediately;
 * after ~1 s the fuse appears at the stix origin and burns along the path
 * toward the marker. Moving again hides it but its progress (and its
 * accumulated wait) is retained — it re-ignites from where it stopped.
 * Completing the claim extinguishes it entirely (handled by the drawing
 * being cleared). Catching the marker kills.
 */

export interface FuseState {
  /** Index of the last path edge the fuse has burned to. */
  edgeIndex: number;
  /** Accumulated stall ticks — retained across pauses. */
  waitTicks: number;
  /** Visible and advancing this tick? */
  burning: boolean;
  /** Tick parity divider for burn speed. */
  stepAccum: number;
}

/** Advance the fuse; returns true if it caught the marker. */
export function updateFuse(state: GameState, events: SimEvent[]): boolean {
  const drawing = state.drawing;
  if (drawing === null) {
    if (state.fuse !== null) {
      state.fuse = null;
      events.push({ type: 'fuseStop' });
    }
    return false;
  }

  const stalled = drawing.stalledTicks > 0;
  if (state.fuse === null) {
    if (!stalled) return false;
    // First stall tick: the hiss starts now, visibility comes later.
    state.fuse = { edgeIndex: 0, waitTicks: 0, burning: false, stepAccum: 0 };
    events.push({ type: 'fuseStart' });
  }
  const fuse = state.fuse;

  if (!stalled) {
    // Player moving again: hide the fuse but retain all progress.
    if (fuse.burning) {
      fuse.burning = false;
      events.push({ type: 'fuseStop' });
    }
    return false;
  }

  fuse.waitTicks += 1;
  if (!fuse.burning && fuse.waitTicks >= FUSE.igniteTicks) {
    fuse.burning = true;
    events.push({ type: 'fuseIgnite' });
  }
  if (!fuse.burning) return false;

  fuse.stepAccum += 1;
  if (fuse.stepAccum >= FUSE.stepDiv) {
    fuse.stepAccum = 0;
    fuse.edgeIndex += 1;
  }
  // Caught up with the marker (which sits at the end of the path)?
  if (fuse.edgeIndex >= drawing.path.length - 1) {
    events.push({ type: 'death', cause: 'fuse' });
    return true;
  }
  return false;
}
