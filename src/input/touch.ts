import type { Dir } from '../sim/grid';
import type { InputSnapshot } from '../sim/state';

/**
 * Touch controls (PRD §9): a fixed virtual d-pad in the left thumb zone and
 * FAST/SLOW buttons in the right, built as DOM buttons over the canvas
 * (Pointer Events, multi-touch, `touch-action: none`). A tap on the stage
 * itself acts as Start. Hand-rolled per TD §2 — no joystick library.
 */
export class TouchControls {
  private dir: Dir | null = null;
  private fast = false;
  private slow = false;
  private startTapped = false;
  private root: HTMLElement | null = null;

  /** Build the overlay; visible only when `enabled`. */
  mount(container: HTMLElement, stage: HTMLElement): void {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="pad">
        <button data-dir="up" class="u">&#9650;</button>
        <button data-dir="left" class="l">&#9664;</button>
        <button data-dir="right" class="r">&#9654;</button>
        <button data-dir="down" class="d">&#9660;</button>
      </div>
      <div class="draw">
        <button data-btn="slow" class="slow">SLOW</button>
        <button data-btn="fast" class="fast">FAST</button>
      </div>`;
    container.appendChild(root);
    this.root = root;

    const press = (el: Element, on: () => void, off: () => void): void => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          (el as HTMLElement).setPointerCapture((e as PointerEvent).pointerId);
        } catch {
          // Pointer already gone (or synthetic in tests) — press still counts.
        }
        on();
      });
      for (const ev of ['pointerup', 'pointercancel']) {
        el.addEventListener(ev, off);
      }
    };
    for (const el of root.querySelectorAll('[data-dir]')) {
      const dir = el.getAttribute('data-dir') as Dir;
      press(
        el,
        () => {
          this.dir = dir;
        },
        () => {
          if (this.dir === dir) this.dir = null;
        },
      );
    }
    for (const el of root.querySelectorAll('[data-btn]')) {
      const which = el.getAttribute('data-btn');
      press(
        el,
        () => {
          if (which === 'fast') this.fast = true;
          else this.slow = true;
        },
        () => {
          if (which === 'fast') this.fast = false;
          else this.slow = false;
        },
      );
    }
    // A tap on the stage (not on a control) is Start.
    stage.addEventListener('pointerdown', (e) => {
      if (!(e.target instanceof Element) || !root.contains(e.target)) {
        this.startTapped = true;
      }
    });
  }

  setVisible(visible: boolean): void {
    if (this.root) this.root.style.display = visible ? 'block' : 'none';
  }

  snapshot(): InputSnapshot {
    return { dir: this.dir, fast: this.fast, slow: this.slow };
  }

  /** Edge-triggered synthetic key codes (Start taps). */
  drainPressed(): string[] {
    if (this.startTapped) {
      this.startTapped = false;
      return ['Space'];
    }
    return [];
  }
}

/** Should touch controls show? auto = coarse-pointer devices. */
export function touchEnabled(setting: 'auto' | 'on' | 'off'): boolean {
  if (setting !== 'auto') return setting === 'on';
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
