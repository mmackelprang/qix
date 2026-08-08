# Qix — Technical Design Document

**Version:** 1.0 · **Date:** 2026-08-08
Companion to [`PRD.md`](./PRD.md) (product requirements, authoritative game rules) and [`ROADMAP.md`](./ROADMAP.md) (phased delivery plan).

---

## 1. Design philosophy

Three principles drive every choice below:

1. **The platform is the engine.** Qix is axis-aligned lines, polygon fills, four-direction input, and bleeps — precisely what Canvas 2D, Web Audio, and DOM input events already do natively and fast. Every candidate game engine/library was evaluated (§2) and rejected where it added churn without capability. Runtime dependencies: **one** (`zzfx`, ~1 KB).
2. **Simulation is pure data + pure functions.** The entire game state is a serializable object; the simulation advances via `update(state, input) → state` at a fixed 60 Hz tick, with rendering as a separate read-only pass. This makes ~95% of the code unit-testable in Node with no DOM, makes the attract-mode demo a replay of recorded inputs, and makes bugs reproducible from a seed + input log.
3. **Integer grid, not floating-point geometry.** Territory capture is modeled on an integer grid with BFS flood fill — not polygon boolean libraries, whose float-robustness edge cases (collinear segments, shared vertices) are exactly what Qix's axis-aligned shared-edge geometry consists of. Grid logic is trivially correct, integer-exact, and testable with ASCII-art fixtures.

## 2. Technology stack

All versions verified against the npm registry 2026-08-08.

| Concern | Choice | Version | Rationale / rejected alternatives |
|---|---|---|---|
| Language | TypeScript | **~6.0** (pinned) | TS 7 (Go-native) is GA but lacks the stable API typescript-tooling needs until 7.1; 6.x is the API-compatible bridge with 5.9 semantics. Revisit at 7.1. |
| Build | Vite | **^8.2** | Vanilla-ts template; Rolldown bundler; `base` set for GitHub Pages. Node 22 LTS. |
| Rendering | **Canvas 2D** (no engine) | — | Pixi 8 (rebuilding Graphics per frame pays triangulation cost Canvas rasterizes natively; +100 KB), Phaser 4 (full framework, dictates architecture, Graphics is its slow path), Kaplay (stable branch stale, v4000 alpha), Kontra/Excalibur (dormant-ish / pre-1.0) — all rejected. Escape hatch: rendering sits behind a thin interface over pure state (§7), so a WebGL backend could be added without touching the sim. |
| Audio | **zzfx** + hand-rolled Web Audio wrapper | zzfx **^1.3** | Procedural sfxr-style SFX from ~20-number param arrays; zero audio assets. Howler rejected (dormant since 2023, solves 2013 problems). Drone/draw-tone via raw `OscillatorNode`s (§9). |
| Territory capture | Hand-rolled integer grid + BFS | — | polygon-clipping (dormant, robustness issues), clipper2-wasm (200 KB wasm, overkill), @flatten-js (kept in back pocket) — rejected per §1.3. |
| Architecture | Plain TS modules; discriminated-union FSM | — | ECS (bitecs/miniplex) rejected: ~5 entity kinds, systems would be 1:1 with types. xstate rejected: 30-line typed FSM suffices for the phase flow. |
| Unit tests | Vitest | **^4.1** | Plain Node environment (no DOM) for all sim tests; mock 2D context for the few render tests. |
| E2E tests | @playwright/test | **^1.62** | Boot, key-driven play via deterministic test hooks, `toHaveScreenshot` golden frames. |
| Lint/format | Biome | **^2.5** | One tool, one config, `biome check --write`; chosen over ESLint 10 + typescript-eslint + Prettier for agentic simplicity. (Conservative alternative documented in research if full typed-lint rigor is later wanted.) |
| Touch input | Hand-rolled virtual d-pad + buttons (Pointer Events) | — | nipplejs 1.0 is maintained again and acceptable, but a fixed d-pad + 2 buttons is better UX for a 4-way game and keeps deps at zero. |
| PWA | vite-plugin-pwa | **^1.3** | `registerType: 'autoUpdate'`, precache-all; standalone/fullscreen display. |
| Persistence | `localStorage` | — | Versioned JSON keys (§10). |
| CI/CD | GitHub Actions → GitHub Pages | — | `upload-pages-artifact@v4` + `deploy-pages@v4`; no gh-pages branch. |

### 2.1 tsconfig (key flags)

`strict`, `noUncheckedIndexedAccess` (critical for grid arrays — forces bounds handling), `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `module: "preserve"`, `moduleResolution: "bundler"`, `target: "ES2022"`, `noEmit` (tsc is check-only; Vite builds).

## 3. Project structure

```
qix/
├── docs/                      # PRD.md, TECHNICAL_DESIGN.md, ROADMAP.md
├── public/                    # icons, manifest assets only (no game assets)
├── src/
│   ├── main.ts                # bootstrap: canvas setup, loop, shell wiring
│   ├── loop.ts                # fixed-timestep accumulator loop
│   ├── config.ts              # ALL tuning constants & difficulty tables (one file)
│   ├── rng.ts                 # seeded PRNG (mulberry32)
│   ├── sim/                   # ── pure simulation: NO DOM, NO Canvas, NO Audio ──
│   │   ├── state.ts           # GameState types, initial-state factories
│   │   ├── update.ts          # top-level tick dispatcher (phase FSM)
│   │   ├── grid.ts            # cell grid, wall graph, queries
│   │   ├── player.ts          # marker movement on walls, draw-mode movement
│   │   ├── capture.ts         # path closing, flood fill, claim %, split detection
│   │   ├── qix.ts             # Qix motion + line-vs-path collision
│   │   ├── sparx.ts           # Sparx pathing, timer, Super Sparx
│   │   ├── fuse.ts            # fuse ignition/progress/pause
│   │   ├── scoring.ts         # claim scores, bonuses, multiplier, lives
│   │   ├── levels.ts          # level setup, difficulty lookup
│   │   └── events.ts          # SimEvent emission (death, fill, spawn, …)
│   ├── render/                # ── read-only over GameState ──
│   │   ├── renderer.ts        # layer orchestration, scaling, dirty tracking
│   │   ├── playfield.ts       # walls, fills, stix, fuse
│   │   ├── entities.ts        # marker, qix streamer, sparx, death rays
│   │   ├── hud.ts             # scores, %, lives, time line, multiplier
│   │   ├── effects.ts         # fill sweep, glow, transitions
│   │   └── text.ts            # arcade bitmap-style text renderer
│   ├── audio/
│   │   ├── engine.ts          # AudioContext lifecycle, unlock, master gain, ducking
│   │   ├── sfx.ts             # zzfx param table (one entry per PRD §6.1 sound)
│   │   └── loops.ts           # drone + draw-tone oscillators, fuse hiss loop
│   ├── input/
│   │   ├── keyboard.ts        # e.code Set, blur clearing, preventDefault
│   │   ├── touch.ts           # virtual d-pad + FAST/SLOW buttons (Pointer Events)
│   │   ├── gamepad.ts         # optional: poll navigator.getGamepads()
│   │   └── snapshot.ts        # per-tick InputSnapshot merger
│   ├── shell/                 # ── meta-game around the sim ──
│   │   ├── fsm.ts             # AppState discriminated union + transitions
│   │   ├── attract.ts         # attract script engine + segments
│   │   ├── demo.ts            # demo-game driver (recorded inputs / heuristic bot)
│   │   ├── highscores.ts      # table, qualification, name entry
│   │   └── settings.ts        # operator menu, persistence
│   └── testhooks.ts           # window.__qix (e2e only; tree-shaken in prod? no — gated by flag)
├── tests/                     # Vitest unit tests (mirror src/sim structure)
│   └── fixtures/              # ASCII-art grid fixtures
├── e2e/                       # Playwright specs + golden screenshots
├── .github/workflows/ci.yml   # check → test → build → deploy
├── biome.json  tsconfig.json  vite.config.ts  playwright.config.ts
└── index.html
```

**Dependency rule (enforced by review + a lint check on imports):** `sim/` imports nothing from `render/`, `audio/`, `input/`, `shell/`, or the DOM. `config.ts` and `rng.ts` are the only shared leaves below `sim/`.

## 4. Core loop & determinism

Classic fixed-timestep accumulator ("Fix Your Timestep"):

```ts
const TICK_MS = 1000 / 60;
function frame(now: number) {
  acc += Math.min(now - last, 250); last = now;   // clamp to avoid spiral of death
  while (acc >= TICK_MS) {
    const input = snapshotInput();
    state = update(state, input);                  // pure, 60 Hz, deterministic
    acc -= TICK_MS;
  }
  render(state, ctx, acc / TICK_MS);               // alpha for interpolation
  requestAnimationFrame(frame);
}
```

- All randomness flows through a **seeded PRNG stored in `GameState`** (mulberry32: tiny, fast, adequate). Same seed + same input sequence ⇒ identical playthrough. This powers: unit tests, replay-based attract demo, and e2e determinism.
- `update` returns a new state conceptually; for perf it may mutate a working copy internally, but **must never read anything outside `(state, input)`** — no `Date.now()`, no `Math.random()`, no DOM.
- Rendering interpolates only cosmetic motion (Qix streamer, sparx position) using previous/current positions carried in state; grid/fill changes snap.

## 5. Simulation model

### 5.1 Grid & geometry representation

The playfield is a **257 × 257 vertex lattice** over the 256 × 256-unit field (PRD §4.1). Two complementary structures, kept in sync by `grid.ts`:

1. **Cell grid** `Uint8Array(256 × 256)` — each cell: `UNCLAIMED | CLAIMED_FAST | CLAIMED_SLOW`. Source of truth for area percentage (`claimedCells / totalCells`) and for "which region contains the Qix" flood fills.
2. **Edge walls** — two bit-arrays `hWalls(257 × 256)` / `vWalls(256 × 257)` marking lattice edges that are walls (border + boundaries of claimed regions). Source of truth for marker/sparx movement and for "did the drawn path reconnect a wall".

All entity positions are **integer lattice coordinates** (sub-tick movement uses fixed-point steps of whole units per tick; fast marker speed is N units/tick, slow is N/2 achieved by moving on alternate ticks, exactly like the original). There is no floating-point in the sim except the Qix's internal velocity accumulators, which are quantized to integers before any collision test.

### 5.2 Marker movement

- **On walls:** a move in direction D is legal if the adjacent lattice edge in D is a wall edge. Sliding around corners follows wall connectivity.
- **Starting a draw:** legal when a draw button is held and the target edge is not a wall and both flanking cells are unclaimed (i.e., moving into open field).
- **While drawing:** path is a list of lattice points; a move is illegal if it re-enters any lattice point already on the current path (no crossing/retracing) or crosses a wall other than at the moment of completion. If **no legal move exists**, the marker is simply stuck — the Fuse handles the rest (Spiral Death Trap emerges for free).
- **Completion:** the path ends the tick the marker reaches any lattice point that touches a wall edge. The path edges become walls; then capture runs (§5.3).

### 5.3 Capture algorithm (`capture.ts`)

On path completion:

1. Add the path's edges to the wall arrays.
2. Take the Qix's current position (any point of its line; both endpoints are always in one region by invariant), and **BFS flood-fill the cell grid from the Qix's cell**, where adjacency between two cells is blocked by a wall edge between them. Cells reached = the region that stays unclaimed.
3. Every unclaimed cell **not** reached: mark `CLAIMED_FAST` or `CLAIMED_SLOW` (claim class per §5.4).
4. **Rebuild wall edges** as: playfield border + every edge between a claimed and an unclaimed cell + edges between differently-claimed cells are *not* walls (interior claimed boundaries are cosmetic only — sparx travel only on unclaimed-region boundary + border, matching the original where old internal lines are absorbed).
   - Correction (matches original): sparx/marker travel on the **boundary of the unclaimed region** (which always includes reachable border segments). Claimed-area interior lines disappear as travel surfaces.
5. Compute `deltaPercent` from newly claimed cell count; emit `ClaimEvent { deltaPercent, cls }` for scoring; check threshold (level end) — all in the same tick.
6. **Two-Qix split check:** flood-fill from Qix A; if Qix B is not in A's region, emit `SplitEvent` (level ends, multiplier++). Otherwise the non-Qix region(s) are claimed as above.

Complexity: BFS over ≤ 65,536 cells with `Uint8Array` visited flags — well under 1 ms; runs at most once per claim, not per tick.

### 5.4 Claim class (fast/slow)

Each path segment records the button held when it was drawn. On completion: **if any segment was drawn slow, the claim is Slow** (2×, red); else Fast. This resolves the mid-draw button-switch ambiguity deterministically and favors the player. (PRD §4.2 defers to this rule.)

### 5.5 Qix (`qix.ts`)

State per Qix: current line `(p1, p2)`, per-endpoint velocity + target, trail ring-buffer of the last ~12 lines with colors, color-cycle RNG state.

Per tick: for each endpoint — advance toward target by speed (re-roll target/speed on arrival, on a random-interval timer, or if a move would exit the unclaimed region or cross a wall — "reject and re-roll", matching pyqix); constrain endpoint separation to ≤ ¼ playfield; ~7%/tick chance to cycle line color (red → blue → green). Push current line into trail buffer.

**Collision (kills player):** segment-vs-segment test of the Qix's *current* line against (a) every edge of the incomplete Stix path and (b) the marker's cell — only while the player is drawing or halted mid-draw. Axis-aligned path edges vs. one arbitrary segment: an orient2d-based segment intersection helper (~20 lines, integer inputs — exact).

### 5.6 Sparx (`sparx.ts`)

- Sparx live **on the wall graph**: position = lattice point + direction. Per tick, advance along wall edges; at junctions prefer straight, else turn (consistent left/right-hand rule per spark's chirality), never reverse unless dead-ended.
- Spawn logic per PRD §4.6: 2 at level start at the border point farthest (half-perimeter) from marker spawn, opposite directions; +2 at top-center per timer expiry.
- Timer: 37 s × 60 ticks; HUD reads remaining ticks for the shrinking time line. Second expiry ⇒ set `superSparx = true` (all current + future).
- **Super Sparx** may transfer onto the incomplete Stix path at its junction with a wall and pursue toward the marker along the path.
- Collision: sparx lattice point == marker lattice point (or crossing swap in one tick — check both).

### 5.7 Fuse (`fuse.ts`)

State: `progress` (index along the path's edge list), `waitTicks`, `visible`. Player stationary while drawing ⇒ `waitTicks++`; fuse **sound event at tick 1**, visible + advancing after 60 ticks (~1 s). Movement ⇒ `visible = false`, progress **retained**. Path completion ⇒ fuse reset. `progress` reaching the marker's path index ⇒ death. Burned edges (`index < progress`) render grey.

### 5.8 Phase FSM & events

```ts
type AppState =
  | { phase: 'boot' }
  | { phase: 'attract'; segment: AttractSegment; t: number }
  | { phase: 'game'; game: GameState }
  | { phase: 'nameEntry'; score: number; chars: string }
```
with `GameState.mode: 'levelIntro' | 'playing' | 'paused' | 'death' | 'levelClear' | 'gameOver'` — plain discriminated unions, a `switch` per tick, exhaustiveness-checked (`never` default).

The sim communicates outward **only** via a `SimEvent[]` list returned from each tick (`claim`, `death`, `sparxSpawn`, `superSparx`, `fuseStart/Stop`, `levelClear`, `split`, `drawStart/Stop`, …). The shell routes events to the audio engine and render effects. Audio/render never inspect state diffs.

## 6. Rendering (`render/`)

- **Two stacked canvases:** `#game` (playfield world, redrawn per frame) and `#hud` (HUD + overlays, redrawn only on change). Both sized to `devicePixelRatio`-scaled integer multiples of the 256-unit field; CSS handles letterboxing; `image-rendering` left default (we draw vectors at native resolution — crisp at any scale, no upscaling).
- **Fill rendering:** claimed regions are drawn from the cell grid as merged horizontal runs (`fillRect` per run, ~hundreds max) — no per-cell draws. A completed claim triggers a **sweep animation**: the new region's runs revealed over ~20 ticks in scanline order (cosmetic, driven by `ClaimEvent`, never blocks the sim).
- **Qix streamer:** draw trail buffer old→new with per-line stored colors and alpha falloff; current line brightest. Optional glow: pre-composited `shadowBlur` on the current line only (cheap), or skipped below a frame-time budget.
- **Text:** a tiny arcade-style bitmap font rendered by code (5×7 glyphs from a packed bitfield) — no font assets, no `fillText` inconsistency across platforms (important for screenshot tests).
- **Death rays, level transitions, attract demos** all render from state/events — no imperative animation timelines inside the renderer.

## 7. Audio engine (`audio/`)

- `engine.ts`: lazy `AudioContext` (created on first user gesture; `resume()` on visibility change), master `GainNode` → `DynamicsCompressorNode` → destination, `duck(target, ms)` helper (used by the fuse hiss to sidechain drone/draw tones), volume/mute persisted via settings.
- `sfx.ts`: **one exported table** `SFX: Record<SfxName, ZzfxParams>` mapping every PRD §6.1 sound to a zzfx parameter array; `play(name)` renders via zzfx into the shared context (zzfx supports an external context). Tuning sounds = editing numbers in one file (designer tool: ZzFX sound designer).
- `loops.ts`: the **background drone** (two detuned low oscillators + slow LFO on gain; intensity parameter mapped from claimed %), the **draw tone** (oscillator, pitch by fast/slow, gated by `drawStart/Stop` events), and the **fuse hiss** (filtered noise buffer loop, gated by `fuseStart/Stop`, always ducks others). All loops are started/stopped only by events; a `stopAll()` runs on death/pause/level end (PRD §6.2 — no stuck loops).

## 8. Input (`input/`)

- Keyboard: `keydown/keyup` on `window` maintaining a `Set` of held `e.code`s; `preventDefault` for arrows/space; clear on `blur`. Mapping table per PRD §9.
- Touch: Pointer Events on two fixed zones (d-pad left, FAST/SLOW right), `touch-action: none`, multi-pointer tracked by `pointerId`; shows only on coarse-pointer devices or when enabled in settings.
- Gamepad: polled in `snapshotInput()`; d-pad buttons 12–15 + axis-with-deadzone gated to 4-way.
- `snapshot.ts` merges all sources into `InputSnapshot { dir: Dir | null; fast: boolean; slow: boolean; start: boolean; pause: boolean }` once per tick. The sim only ever sees snapshots — which is also the replay/demo format.

## 9. Attract mode (`shell/attract.ts`, `demo.ts`)

- A small **script engine**: an attract script is an array of timed steps (`showText`, `demoDraw`, `wait`, `runDemo`, `showHighScores`, …) interpreted at 60 Hz; segments per PRD §5 with the original's text beats (stored as data).
- Tutorial demonstrations run a **miniature real sim** (smaller grid, fixed seed, scripted `InputSnapshot` sequences) — e.g., the fast/slow scoring demo draws the same box twice; the Spiral Death Trap demo replays a recorded self-trap.
- The **demo game** is the full sim driven by a recorded input log (captured via a dev hotkey during development, stored as data with its seed) with caption overlays triggered at scripted ticks; determinism guarantees it never desyncs. Fallback (and variety): a simple heuristic bot behind the same `InputSnapshot` interface.
- Any real input aborts attract → game start (+ audio unlock).

## 10. Persistence

`localStorage` keys, all JSON with `v` field for migration:
- `qix.scores.v1` — `[{ name, score, custom: boolean }] × 10`
- `qix.settings.v1` — operator settings + volume/mute + touch preference
Corrupt/missing values fall back to defaults ("QIX KICKERS" / `030000 QIX` table) — never throw.

## 11. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Sim unit tests | Vitest (Node env, no DOM) | Grid/walls invariants; movement legality; **capture**: ASCII-art fixtures (`#` wall, `.` unclaimed, `F/S` claimed, `Q` qix, `M` marker) parsed into state, expected fills asserted as ASCII — human-reviewable goldens; scoring table incl. multiplier & threshold bonus; sparx pathing/timer/super transitions; fuse pause-resume; split detection; full-game determinism (seed + input log ⇒ final-state hash) |
| Property tests | Vitest | Random-walk fuzz: (a) claimed % never decreases, (b) Qix always inside unclaimed region, (c) wall graph always a closed boundary, (d) no sim step reads Math.random/Date (lint + runtime guard in tests) |
| Render unit tests | Vitest + mocked 2D context | Draw-call shape assertions for HUD numbers, fill runs |
| E2E | Playwright | Boot to attract; start game; scripted keyboard play reaches a claim; pause; game over → name entry → table persists across reload; `toHaveScreenshot` golden frames at fixed seeds via test hooks |
| Test hooks | `window.__qix` (enabled by `?test` param only) | `setSeed(n)`, `advanceTicks(n)` (decoupled from rAF), `getState()`, `loadInputLog(log)` |
| Performance | e2e budget test | 1,000 ticks stepped under X ms; bundle-size budget in CI |

CI (GitHub Actions): `biome ci` → `tsc --noEmit` → `vitest run` → `playwright test` → `vite build` → deploy Pages on `main`.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Capture edge cases (claims touching corners, claims that engulf a sparx's edge, zero-area paths) | ASCII fixtures make every reported edge case a permanent regression test; integer grid eliminates float ambiguity |
| Sparx behavior on freshly changed wall graph (their edge vanishes mid-claim) | Rule: after capture, each sparx snaps to nearest point on new boundary preserving direction; covered by fixtures |
| Qix motion "feel" wrong | All motion constants in `config.ts` difficulty tables; tune against reference videos; pyqix constants as starting values |
| Browser audio quirks (autoplay, iOS context suspension) | Single unlock path on first gesture; resume on `visibilitychange`; silent-mode fallback is fully playable |
| Screenshot-test flakiness | Bitmap font (no OS text rendering), fixed seeds, stepped ticks via hooks, single browser (Chromium) for goldens |
| TS 7 ecosystem shift mid-project | TS pinned ~6.0; upgrade is an isolated chore ticket when typescript-eslint/tooling support lands |
