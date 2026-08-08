import { COLORS } from '../config';
import type { SimEvent } from '../sim/events';
import type { Point } from '../sim/grid';

/**
 * Cosmetic, event-driven animations (TD §6): the claim fill sweep and the
 * death rays. Purely render-side — consumes SimEvents, never touches the
 * sim. Each effect ages by one step per rendered sim tick.
 */

interface SweepEffect {
  kind: 'sweep';
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cls: 'fast' | 'slow';
  age: number;
}

interface RaysEffect {
  kind: 'rays';
  origin: Point;
  age: number;
}

type Effect = SweepEffect | RaysEffect;

const SWEEP_TICKS = 20;
const RAYS_TICKS = 60;

export class Effects {
  private effects: Effect[] = [];

  consume(events: readonly SimEvent[], marker: Point): void {
    for (const e of events) {
      if (e.type === 'claim') {
        this.effects.push({ kind: 'sweep', ...e.bounds, cls: e.cls, age: 0 });
      } else if (e.type === 'death') {
        this.effects.push({ kind: 'rays', origin: { x: marker.x, y: marker.y }, age: 0 });
      }
    }
  }

  /** Advance one sim tick's worth of animation. */
  step(): void {
    for (const e of this.effects) e.age += 1;
    this.effects = this.effects.filter(
      (e) => e.age < (e.kind === 'sweep' ? SWEEP_TICKS : RAYS_TICKS),
    );
  }

  render(ctx: CanvasRenderingContext2D, fieldW: number, fieldH: number): void {
    for (const e of this.effects) {
      if (e.kind === 'sweep') {
        // A brightening band sweeps down the claimed region's bounds.
        const t = e.age / SWEEP_TICKS;
        const bandY = e.minY + (e.maxY - e.minY) * t;
        ctx.globalAlpha = 0.5 * (1 - t);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(e.minX, bandY, e.maxX - e.minX, 2);
        ctx.globalAlpha = 1;
      } else {
        // Death rays: lines flying outward from the marker to screen edges.
        const t = e.age / RAYS_TICKS;
        ctx.strokeStyle = COLORS.marker;
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 12; i += 1) {
          const angle = (Math.PI * 2 * i) / 12;
          const reach = t * Math.max(fieldW, fieldH);
          const inner = reach * 0.7;
          ctx.moveTo(e.origin.x + Math.cos(angle) * inner, e.origin.y + Math.sin(angle) * inner);
          ctx.lineTo(e.origin.x + Math.cos(angle) * reach, e.origin.y + Math.sin(angle) * reach);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  get active(): boolean {
    return this.effects.length > 0;
  }
}
