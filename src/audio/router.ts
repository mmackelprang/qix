import type { SimEvent } from '../sim/events';
import { claimedPercent, type GameState } from '../sim/state';
import type { AudioSink } from './engine';

/**
 * Pure SimEvent → audio mapping (TD §7): loops are started/stopped only by
 * events, and every terminal transition stops everything — no stuck loops
 * (PRD §6.2). Unit-tested against a fake sink.
 */
export function routeAudioEvents(
  events: readonly SimEvent[],
  state: GameState,
  sink: AudioSink,
): void {
  for (const e of events) {
    switch (e.type) {
      case 'levelStart':
        sink.stopAllLoops();
        sink.play('spawn');
        sink.startLoop('drone');
        break;
      case 'respawn':
        sink.play('spawn');
        sink.startLoop('drone');
        break;
      case 'drawStart':
        sink.startLoop(e.cls === 'slow' ? 'drawSlow' : 'drawFast');
        break;
      case 'drawStop':
        sink.stopLoop('drawFast');
        sink.stopLoop('drawSlow');
        break;
      case 'claim':
        sink.play(e.cls === 'slow' ? 'fillSlow' : 'fillFast');
        break;
      case 'claimScored':
        break;
      case 'fuseStart':
        sink.startLoop('fuse');
        break;
      case 'fuseIgnite':
        break;
      case 'fuseStop':
        sink.stopLoop('fuse');
        break;
      case 'sparxSpawn':
        sink.play('sparxSpawn');
        break;
      case 'superSparx':
        sink.play('superSparx');
        break;
      case 'death':
        sink.stopAllLoops();
        sink.play('death');
        break;
      case 'levelClear':
        sink.stopAllLoops();
        sink.play('levelClear');
        break;
      case 'split':
        sink.stopAllLoops();
        sink.play('split');
        break;
      case 'gameOver':
        sink.stopAllLoops();
        sink.play('gameOver');
        break;
      default: {
        const exhaustive: never = e;
        throw new Error(String(exhaustive));
      }
    }
  }
  // Continuous parameter: drone intensity tracks progress to the target.
  if (state.mode === 'playing') {
    sink.setDroneIntensity(claimedPercent(state) / state.targetPercent);
  }
}
