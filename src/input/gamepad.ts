import type { Dir } from '../sim/grid';
import type { InputSnapshot } from '../sim/state';

/**
 * Gamepad support (PRD §9): polled per tick (the API is poll-based).
 * D-pad (buttons 12–15) or left stick with a deadzone, A = fast, B = slow,
 * Start = start/pause. Standard mapping only.
 */

const DEADZONE = 0.45;

export class GamepadInput {
  private prevStart = false;
  private prevPause = false;

  private pad(): Gamepad | null {
    try {
      for (const pad of navigator.getGamepads()) {
        if (pad?.connected && pad.mapping === 'standard') return pad;
      }
    } catch {
      // Gamepad API unavailable (older browsers, tests).
    }
    return null;
  }

  snapshot(): InputSnapshot {
    const pad = this.pad();
    if (!pad) return { dir: null, fast: false, slow: false };
    let dir: Dir | null = null;
    if (pad.buttons[12]?.pressed) dir = 'up';
    else if (pad.buttons[13]?.pressed) dir = 'down';
    else if (pad.buttons[14]?.pressed) dir = 'left';
    else if (pad.buttons[15]?.pressed) dir = 'right';
    else {
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (Math.abs(x) > Math.abs(y)) {
        if (x < -DEADZONE) dir = 'left';
        else if (x > DEADZONE) dir = 'right';
      } else if (y < -DEADZONE) dir = 'up';
      else if (y > DEADZONE) dir = 'down';
    }
    return {
      dir,
      fast: pad.buttons[0]?.pressed ?? false,
      slow: pad.buttons[1]?.pressed ?? false,
    };
  }

  /** Edge-triggered synthetic key codes (Start / pause buttons). */
  drainPressed(): string[] {
    const pad = this.pad();
    const pressed: string[] = [];
    const start = pad?.buttons[9]?.pressed ?? false;
    const select = pad?.buttons[8]?.pressed ?? false;
    if (start && !this.prevStart) pressed.push('Enter');
    if (select && !this.prevPause) pressed.push('Escape');
    this.prevStart = start;
    this.prevPause = select;
    return pressed;
  }
}
