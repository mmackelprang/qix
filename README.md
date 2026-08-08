# QIX

A faithful, fully playable browser recreation of **Qix** (Taito America, 1981) in modern TypeScript — Canvas 2D rendering, procedural Web Audio sound, one ~1 KB runtime dependency, 60 fps, installable as a PWA.

**▶ Play it:** https://mmackelprang.github.io/qix/

## How to play

Ride the border, then hold a draw button and steer into the open field to draw **Stix**. Reconnect to a wall and the side without the **Qix** is claimed — **fast** draws fill blue (1× points), **slow** draws fill red (2× points). Claim **75%** to win the level.

Your opponents: the **Qix** (touching your incomplete line while drawing is death), **Sparx** (patrol the walls; after the red time line empties twice they turn blue and chase you down your own line), the **Fuse** (hesitate mid-draw and it burns from the start of your line toward you — keep moving), and the **Spiral Death Trap** (box yourself in and the fuse finishes the job). From level 3 there are **two Qix**: separate them into different regions to end the level instantly and multiply *all* future scoring (up to 9×).

### Controls

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move | Arrows / WASD | Virtual d-pad | D-pad / left stick |
| Fast draw | `X` / `.` / `Shift` | FAST button | A |
| Slow draw (2×) | `Z` / `,` / `Ctrl` | SLOW button | B |
| Start / confirm | `Enter` / `Space` | Tap | Start |
| Pause | `Esc` / `P` (then `Q` quits) | — | Select |
| Mute | `M` | — | — |
| Operator settings | `S` on the title screen | — | — |

High scores ("QIX KICKERS") and settings persist locally. The operator settings menu — a nod to the original cabinet's CMOS test mode — adjusts claim target, lives, Sparx time line, volume, and touch controls; non-default gameplay settings tag scores as custom.

## Development

```bash
npm ci
npm run dev        # local dev server
npm run check      # Biome lint/format + tsc type-check
npm test           # Vitest unit suite (~100 tests, DOM-free sim)
npm run e2e        # Playwright UAT against the production build
npm run build      # production build (dist/)
npm run budget     # gzipped bundle-size budget check
```

The simulation is pure data + pure functions at a fixed 60 Hz tick with a seeded RNG — same seed and inputs replay identical games, which powers the ASCII-fixture unit tests, the deterministic Playwright UAT (`?test` + `window.__qix` hooks), and the self-playing attract-mode demo. See the docs for the full design:

| Document | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements & authoritative game-mechanics spec (researched against the MAME driver and faithful remakes) |
| [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) | Architecture: stack rationale, deterministic sim, grid flood-fill capture, testing strategy |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The 8-phase build plan this implementation followed |

## License

[MIT](LICENSE). This is an original fan recreation of the game's mechanics and style; it uses no original Taito assets, code, or trademarks.
