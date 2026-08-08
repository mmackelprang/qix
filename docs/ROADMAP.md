# Qix — Phased Roadmap & Agentic Build Plan

**Version:** 1.0 · **Date:** 2026-08-08
Execution plan for [`PRD.md`](./PRD.md) (rules) and [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) (architecture). Written to be handed to an agentic builder: each phase is independently implementable and verifiable, with explicit acceptance checks.

---

## How to work this plan (builder contract)

1. **Phases are sequential**; tasks within a phase may be parallelized where files don't overlap. Do not start a phase until the previous phase's exit criteria pass.
2. **Definition of done, every phase:** `npm run check` (Biome + `tsc --noEmit`), `npm test` (Vitest), and — from Phase 2 on — `npm run e2e` (Playwright) all green in CI; new behavior covered by new tests; no `sim/` module imports DOM/render/audio/input (dependency rule, TD §3).
3. **Authoritative sources:** game rules → PRD §4–§9 (do not re-derive from memory); architecture and algorithms → TD §4–§10; tuning constants → `src/config.ts` only, seeded from the values in PRD §4 tables.
4. **Determinism is non-negotiable:** no `Math.random`/`Date.now` in `sim/`; all randomness via the state-carried seeded PRNG. Every phase that adds sim behavior must extend the determinism test (same seed + input log ⇒ same final-state hash).
5. Commit per task with descriptive messages; keep the game bootable at every commit from Phase 2 onward.
6. When a rule in the PRD is ambiguous in an edge case, prefer the resolution already written in TD (e.g., claim class §5.4, sparx snap rule §12); if genuinely unspecified, implement the simplest player-favoring behavior, add a test locking it in, and note it in the commit message.

**Suggested npm scripts:** `dev`, `build`, `preview`, `check` (biome ci + tsc --noEmit), `test`, `test:watch`, `e2e`.

---

## Phase 0 — Scaffold & pipeline (foundation)

**Goal:** empty-but-deployed project; every quality gate exists and runs in CI before any game code lands.

Tasks:
1. Vite 8 vanilla-ts scaffold; TypeScript pinned `~6.0`; tsconfig per TD §2.1; directory skeleton per TD §3 (empty modules with TODO headers).
2. Biome config (format + lint + import sort); npm scripts as above.
3. Vitest 4 (Node env) with one placeholder sim test; Playwright with one boot test (page loads, canvas present).
4. GitHub Actions CI: check → unit tests → build → e2e (Chromium) → deploy `dist/` to GitHub Pages on `main` (`configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`); Vite `base` for the repo path.
5. `index.html` + `main.ts`: two stacked canvases, letterboxed square scaling with `devicePixelRatio` handling, fixed-timestep loop (TD §4) driving a placeholder render (black field, white border, frame counter).
6. `rng.ts` (mulberry32) + tests; `config.ts` created with initial constants from PRD §4.

**Exit criteria:** CI fully green; GitHub Pages URL serves the black playfield at 60 fps; `noUncheckedIndexedAccess` etc. active (prove with a deliberate-failure check during development).

## Phase 1 — Core simulation: grid, marker, capture (the heart)

**Goal:** the essential Qix mechanic — move on walls, draw Stix, close a region, flood-fill the non-Qix side, track claimed % — fully implemented and exhaustively unit-tested. *No enemies rendered/moving yet except a stationary stand-in Qix position for fill-side selection.*

Tasks:
1. `grid.ts`: cell grid + wall edge arrays + queries (TD §5.1); border initialization.
2. `player.ts`: wall movement, draw start/turn/legality (no cross/retrace), fast/slow speeds (slow = alternate ticks), halt-in-place, per-segment draw-class recording (TD §5.2, §5.4).
3. `capture.ts`: completion detection, wall commit, BFS fill from Qix cell, claim marking, wall-graph rebuild (claimed interiors absorbed), delta % + `ClaimEvent` (TD §5.3).
4. `state.ts`/`update.ts`: `GameState`, `InputSnapshot`, tick dispatcher for mode `'playing'`; `events.ts` with the event union.
5. ASCII fixture harness (`tests/fixtures/`): parse/serialize states as ASCII art (TD §11); port all capture cases: simple box, claim touching corners, multi-turn spiral path, claim whose region engulfs prior claims' boundary, path completing onto its own start wall, 1-cell-wide corridors, stuck-marker (no legal move) detection.
6. Determinism test #1: scripted input log on fixed seed ⇒ exact final ASCII state + claimed %.
7. Minimal debug render: walls, fills (cyan/red), marker, incomplete stix — enough to play with keyboard in `npm run dev`.

**Exit criteria:** all fixture tests green; playable claim loop by hand; claimed % matches cell math exactly; fuzz test (random legal inputs × 10k ticks) upholds invariants: % never decreases, wall graph closed, no crash.

## Phase 2 — The Qix, death, lives & level flow

**Goal:** a losable, winnable single-level game against one Qix.

Tasks:
1. `qix.ts`: endpoint random-walk motion, trail buffer, color cycling, unclaimed-region confinement (TD §5.5); collision vs. incomplete Stix + marker (integer segment intersection helper + tests).
2. Death sequence: life loss, stix erase, respawn bottom-center, `DeathEvent`; death-rays animation in render.
3. `scoring.ts`: claim scores (fast 100×%/slow 200×%, fractional to 0.01%), threshold check ends level, threshold bonus ((n−target)×1000), multiplier plumbing (used at 1× for now); score/lives/level in `GameState`.
4. `levels.ts` + game modes: `levelIntro → playing → death → (gameOver | playing) → levelClear → next level`; level-clear tally screen data (PRD §7).
5. HUD render: score, high score, `CLAIMED n% 75%`, lives markers, level (PRD §7) using the bitmap text renderer (`render/text.ts` — build it now, TD §6).
6. Playwright: seeded e2e — start, draw a claim via scripted keys + tick hooks (`testhooks.ts` behind `?test`), assert score/% in state; first golden screenshots.
7. Fill-sweep animation + basic effects module.

**Exit criteria:** full game loop (3 lives → game over) playable; Qix kills reliably on line touch; level completes at ≥75% with correct bonus math (unit-tested against PRD table); determinism test extended through a death and a level clear.

## Phase 3 — Sparx & Fuse (complete the threat model)

**Goal:** all three enemy systems per PRD §4.6; the Spiral Death Trap now fully emergent.

Tasks:
1. `sparx.ts`: wall-graph pathing (junction rule), far-point spawn ×2 opposite directions, 37 s timer + `+2` top-center waves, Super Sparx on 2nd expiry (blue, chase onto incomplete stix), death-reset behavior, level-based speed step (TD §5.6); collision incl. same-tick position swap.
2. Sparx time line in HUD (red bar shrinking from both ends).
3. `fuse.ts`: 60-tick stall delay, immediate `fuseStart` sound event, progress along path, pause-retain-resume, extinguish on completion, kill on catch; grey burned-line rendering (TD §5.7).
4. Sparx-snap rule after captures (TD §12) + fixtures for sparx on vanished edges.
5. Fixtures/tests: sparx junction choices, timer expiries, super-sparx path pursuit, fuse pause/resume progress retention, spiral self-trap ⇒ fuse death end-to-end sim test.

**Exit criteria:** all PRD §4 death conditions reproducible in tests and by hand; sparx never walk on incomplete stix unless Super; timer/waves match spec; determinism test extended.

## Phase 4 — Two Qix, splitting & difficulty curve

**Goal:** full arcade progression and scoring depth.

Tasks:
1. Two Qix from level 3 (`levels.ts`); per-Qix state; both confined to (possibly different) unclaimed regions after splits mid-level? — No: splitting **ends** the level instantly; implement split detection in `capture.ts` (flood from Qix A, is Qix B reachable) ⇒ `SplitEvent`, multiplier +1 (cap 9×), immediate level end, no threshold bonus (PRD §4.7).
2. Multiplier applied to all scoring; HUD multiplier indicator.
3. Data-driven difficulty table in `config.ts`: per-level Qix speed, sparx speed step (every 4 levels), super-sparx acceleration at high levels (PRD §4.8); tune to feel using pyqix-derived starting values.
4. Tests: split detection fixtures (incl. both-Qix-same-side ⇒ normal claim), multiplier math ×9 cap, difficulty table lookups; long-run determinism test through a split.

**Exit criteria:** level 3+ playable with two Qix; splitting ends level with multiplier increment; scoring at multiplier matches PRD §4.4; difficulty entirely table-driven.

## Phase 5 — Audio (full inventory)

**Goal:** every sound in PRD §6.1 implemented procedurally; audio behaviors per PRD §6.2–§6.4.

Tasks:
1. `audio/engine.ts`: lazy context + first-gesture unlock + visibilitychange resume, master gain → compressor, ducking helper, mute/volume with persistence (TD §7).
2. `audio/sfx.ts`: zzfx param table for every one-shot (fill fast/slow, spawn, super-sparx sting, death, level clear, split sting, UI blips) — tune with the ZzFX designer; document each param row.
3. `audio/loops.ts`: drone (intensity from claimed %), draw tone (pitch by class), fuse hiss (noise loop; ducks everything) — gated purely by sim events; `stopAll()` on death/pause/level end.
4. Event → audio routing in shell; pause silences; unlock hint UI ("tap for sound").
5. Tests: event-routing unit tests with a faked engine (loop start/stop pairing — assert no stuck loops across death/pause/clear); e2e smoke: context state after first gesture.

**Exit criteria:** full inventory audible and event-correct; fuse hiss starts on stall tick 1 and ducks other audio; no stuck loops in any transition (tested); silent-until-gesture verified.

## Phase 6 — Attract mode, high scores & shell polish

**Goal:** the complete arcade shell per PRD §5 and §8.

Tasks:
1. `shell/fsm.ts`: full `AppState` flow (boot → attract ⇄ game → nameEntry → attract) (TD §5.8); pause overlay with confirm-quit.
2. Attract script engine + segments (TD §9): title (original wordmark), tutorial beats with mini-sim demos (fast/slow scoring demo: "FAST SCORE 250 / SLOW SCORE 500"; opponents showcase; **Spiral Death Trap** live demo from a recorded input log), "QIX KICKERS" high-score segment.
3. Demo game: dev hotkey records seed + input log; ship one good recorded demo with "EVADE QIX" / "DODGE SPARX" captions; any-input abort → game start.
4. `shell/highscores.ts`: qualification, 3-char arcade name entry (+ direct typing), versioned localStorage, default `030000 QIX` table, custom-settings tag (PRD §8.4–8.5).
5. Level-intro and game-over sequences; attract audio at reduced volume post-unlock.
6. E2E: attract rotation cycles all four segments; input aborts to game; game over → name entry → table persists across reload; golden screenshots of title, a tutorial beat, and the score table.

**Exit criteria:** leaving the game idle cycles the full attract loop indefinitely without desync (determinism); complete cabinet flow keyboard-only; high scores survive reload.

## Phase 7 — Touch, gamepad, settings, PWA & release

**Goal:** ship-quality on all inputs and devices; installable; performance-verified.

Tasks:
1. `input/touch.ts`: fixed virtual d-pad + FAST/SLOW buttons (Pointer Events, multi-touch, `touch-action: none`), auto-shown on coarse pointers; layout per PRD §9; `input/gamepad.ts` polling (optional-but-cheap: include).
2. Settings/operator menu (PRD §8.5): target %, lives, sparx timer, volume/mute, touch override, reset scores; persisted; custom-settings score tagging.
3. vite-plugin-pwa: autoUpdate, precache-all, manifest (icons, standalone/fullscreen, orientation), offline verified.
4. Performance pass: frame-time budget test (1,000 ticks + renders under budget), bundle-size budget in CI (< 300 KB transfer), mobile profiling; glow effects gated by budget.
5. Accessibility pass: pause-anywhere, no flashing violations (death rays/fill sweeps within guidelines), on-screen control help, focus/keyboard traps checked.
6. Final e2e matrix: Chromium + WebKit + mobile-viewport touch emulation; README with play link, controls, dev guide; cut `v1.0.0` tag.

**Exit criteria:** PRD §11 success criteria all demonstrably met; playable start-to-game-over by touch alone on a phone; installs as PWA and runs offline; CI green on the release tag; deployed at the public URL.

## Phase 8 (post-v1, optional) — Two-player & beyond

Alternating 2-player (PRD §4.10: per-player score/lives/level/multiplier, turn handover screens); then PRD §10 candidates (modern mode: power-ups, reveal-a-picture, retraceable lines, online leaderboards). Not scheduled; groom after v1 feedback.

---

## Phase dependency graph

```
P0 scaffold ─→ P1 core sim ─→ P2 qix/death/levels ─→ P3 sparx/fuse ─→ P4 two-qix/difficulty ─┐
                                                                                              ├─→ P6 attract/shell ─→ P7 ship
                                                     P5 audio (needs P2 events; ← P3/P4 add sounds) ─┘
```

P5 can start after P2 (engine + early sounds) and finishes after P4; P6 needs P4 (demo game uses full rules) and P5 (attract audio); P7 last.

## Estimated relative effort

| Phase | Share | Risk hotspots |
|---|---|---|
| P0 | 5% | Pages base path, CI wiring |
| P1 | 25% | Capture edge cases (mitigated by ASCII fixtures) |
| P2 | 15% | Qix motion feel; segment collision correctness |
| P3 | 15% | Sparx graph pathing after captures |
| P4 | 10% | Split timing/instant level end |
| P5 | 10% | Sound tuning taste; loop lifecycle |
| P6 | 15% | Attract script engine; demo recording |
| P7 | 5% | Device quirks, PWA cache behavior |
