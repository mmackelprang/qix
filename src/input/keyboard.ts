import type { Dir } from '../sim/grid';
import type { InputSnapshot } from '../sim/state';

const DIR_KEYS: Readonly<Record<string, Dir>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const FAST_KEYS = new Set(['KeyX', 'Period', 'ShiftLeft', 'ShiftRight']);
const SLOW_KEYS = new Set(['KeyZ', 'Comma', 'ControlLeft', 'ControlRight']);
const PREVENT_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/**
 * Physical-key (e.code) keyboard state (TD §8). Direction resolution is
 * last-pressed-wins among currently held direction keys, which matches
 * arcade joystick feel for rapid corners.
 */
export class Keyboard {
  private readonly held = new Set<string>();
  private pressOrder: string[] = [];
  private pressedQueue: string[] = [];

  attach(target: Window): void {
    target.addEventListener('keydown', (e: KeyboardEvent) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (this.held.has(e.code)) return;
      this.held.add(e.code);
      this.pressedQueue.push(e.code);
      if (e.code in DIR_KEYS) this.pressOrder.push(e.code);
    });
    target.addEventListener('keyup', (e: KeyboardEvent) => {
      this.held.delete(e.code);
      this.pressOrder = this.pressOrder.filter((c) => c !== e.code);
    });
    // Held keys are lost when the window loses focus — clear to avoid
    // phantom movement on refocus.
    target.addEventListener('blur', () => {
      this.held.clear();
      this.pressOrder = [];
    });
  }

  snapshot(): InputSnapshot {
    const lastDirCode = this.pressOrder[this.pressOrder.length - 1];
    const dir = lastDirCode === undefined ? null : (DIR_KEYS[lastDirCode] ?? null);
    let fast = false;
    let slow = false;
    for (const code of this.held) {
      if (FAST_KEYS.has(code)) fast = true;
      if (SLOW_KEYS.has(code)) slow = true;
    }
    return { dir, fast, slow };
  }

  /** Edge-triggered key codes since the last drain (shell navigation). */
  drainPressed(): string[] {
    const pressed = this.pressedQueue;
    this.pressedQueue = [];
    return pressed;
  }
}
