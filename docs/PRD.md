# Qix — Product Requirements Document

**Project:** Browser-based recreation of Qix (Taito America, 1981)
**Version:** 1.0
**Date:** 2026-08-08
**Status:** Approved for build — see [`ROADMAP.md`](./ROADMAP.md) for the phased delivery plan and [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) for the implementation design.

---

## 1. Vision

A faithful, fully playable recreation of the 1981 Taito arcade classic **Qix**, running at 60 fps in any modern browser, built in modern TypeScript with essentially zero runtime dependencies. The game should feel like the arcade original — the same rules, scoring, enemy behavior, stark vector-on-black look, sparse-but-critical audio, and the famously instructional attract mode — while meeting modern expectations: instant load, keyboard/touch/gamepad input, responsive scaling, persistent local high scores, and installable offline play (PWA).

**Design north star:** when a player who fed quarters into the original cabinet plays this, nothing should feel wrong.

### 1.1 Goals

1. Authentic core gameplay: draw Stix, claim territory, evade the Qix, Sparx, and Fuse, exactly per the mechanics specification in §4.
2. Complete arcade presentation: attract mode with scripted tutorial, high-score table, and demo game; score/lives/timer HUD; death and level-clear sequences.
3. Full audio experience: procedurally generated retro SFX and ambient drone matching the original's sound design, with the Fuse hiss as a first-class gameplay warning.
4. Playable everywhere: desktop keyboard, mobile touch, optional gamepad; installable as a PWA; hosted free on GitHub Pages.
5. Built for verification: deterministic simulation, comprehensive unit tests on game logic, end-to-end browser tests — suitable for an agentic builder to implement and validate phase by phase.

### 1.2 Non-goals (v1)

- Online/networked play, server-side leaderboards, or accounts.
- Emulation of the original ROMs or reuse of any original assets (all art and sound are original recreations of the *style*).
- Sequel mechanics (Super Qix power-ups, Volfied weapons, picture reveal) — captured as future ideas in §10, not v1 scope.
- Native/app-store distribution.

### 1.3 Target audience

- Retro-arcade enthusiasts seeking an accurate Qix.
- Casual browser players (short-session arcade loop, touch-friendly).
- Developers reading the codebase as a reference implementation of a classic game in modern TypeScript.

---

## 2. Platform & performance requirements

| Requirement | Target |
|---|---|
| Browsers | Latest 2 versions of Chrome, Edge, Firefox, Safari (desktop + mobile) |
| Frame rate | 60 fps render; simulation fixed at 60 Hz regardless of display refresh |
| Load time | Interactive < 2 s on a mid-range phone; total transfer < 300 KB (no audio/image assets — sound is procedural, art is drawn) |
| Display | Scales to any viewport while preserving the square playfield aspect; crisp (integer-scaled or high-DPI-aware) rendering |
| Input | Keyboard (primary), touch (virtual controls), gamepad (optional enhancement) |
| Offline | Full offline play once loaded (PWA, installable) |
| Persistence | High scores and settings in `localStorage`; survive reloads |
| Accessibility | Pausable at any time; volume/mute controls; no flashing above photosensitivity guidelines; controls documented on-screen |

---

## 3. Game overview

The player controls a small **diamond-shaped marker** that travels along the borders of a rectangular playfield. Holding a draw button while steering into the open field draws a line (a **Stix**). Connecting the line back to any wall closes off a region: the region **not** containing the Qix is filled and claimed. Claim more than the target percentage (default **75%**) to win the level. Three enemies oppose you:

- **The Qix** — a writhing, multicolored line-bundle drifting unpredictably through unclaimed space. Touching your marker or your incomplete Stix while you draw is death.
- **Sparx** — sparks that patrol the borders and every completed line. Touching your marker is death. They spawn in waves on a visible timer; after the timer laps twice they become blue **Super Sparx** that can chase you down your own incomplete Stix.
- **The Fuse** — if you hesitate mid-draw, a spark ignites at the start of your incomplete line and burns toward you. Moving again pauses it (it does **not** reset); completing the line extinguishes it; being caught is death.

Drawing has two speeds: **Fast** (full speed, areas score 1×, fill blue/cyan) and **Slow** (half speed, areas score 2×, fill red). Risk/reward: slow drawing doubles points but doubles exposure.

Because the marker can never cross or retrace its own incomplete Stix, careless drawing can seal the player into a dead end — the **Spiral Death Trap** — where the Fuse inevitably catches them. The original's attract mode names and demonstrates it; ours does too.

---

## 4. Game mechanics specification

This section is the authoritative rule set. Values marked **(operator)** are configurable in the Settings menu (§8.5), mirroring the original cabinet's battery-backed CMOS operator settings; defaults match the arcade defaults.

### 4.1 Playfield

- Logical playfield: **256 × 256** units (matching the original's raster resolution), rendered scaled to fit the viewport. A HUD band sits above the playfield.
- Every level is the same empty rectangle — no obstacle variations. Difficulty comes solely from enemy count and speed (§4.8).
- The playfield boundary and all edges of claimed regions are **walls**. The marker travels only on walls (when not drawing).

### 4.2 Marker movement & drawing

- 4-directional movement (up/down/left/right), no diagonals.
- On walls: the marker slides freely along any wall edge at full speed.
- Drawing starts when the player holds **Fast** or **Slow** and steers off a wall into unclaimed territory:
  - **Fast draw:** full marker speed. Completed claims fill **cyan/blue** and score **1×**.
  - **Slow draw:** **half** marker speed. Completed claims fill **dark red** and score **2×**.
  - The draw speed of a Stix is fixed by the button held when the claim **completes** (matching the original: the scoring class is decided per-claim; switching buttons mid-draw moves at the new speed and the claim scores at the class of the button held — see Technical Design §6.3 for the tie-break: any Slow segment in the path makes the claim Slow).
- The Stix is axis-aligned, with 90° turns allowed at any point. The marker **cannot cross or retrace** its own incomplete Stix, and cannot draw along an existing wall.
- Releasing the draw button mid-draw halts the marker on the incomplete Stix (starting the Fuse countdown, §4.6).
- An incomplete Stix renders in red; it becomes a solid white wall segment on completion.

### 4.3 Claiming territory

- When the drawn line reconnects with any wall, the unclaimed region splits in two. The half **not containing the Qix** is claimed and filled (fast = cyan, slow = dark red). With two Qix in one region, see §4.7.
- Claimed percentage = claimed area ÷ original playfield area, displayed in the HUD as `CLAIMED n% 75%` (current vs. target).
- **Level ends immediately** the moment cumulative claimed percentage ≥ target. The final claim is counted in full (its score and the over-target bonus both apply).
- Claim target: **75% (operator, range 50–99)**.

### 4.4 Scoring

| Event | Points |
|---|---|
| Fast-draw claim | claimed % of playfield × **100** (fractional %, resolved to 0.01%) |
| Slow-draw claim | claimed % of playfield × **200** |
| Level-complete threshold bonus | (final claimed whole-% − target %) × **1,000** |
| Split the Qix (§4.7) | no immediate points; global score **multiplier +1** (max **9×**) for the rest of the game |

- The global multiplier (starts 1×) multiplies **all** subsequent scoring (claims and bonuses).
- Scores are integers; fractional-percent claim scores are truncated after multiplication.
- **No extra lives** — the original awards none (verified against the machine's operator settings, which have no bonus-life field). Lives: **3 (operator, 1–9)**.
- Default high-score table: ten entries of `030000 QIX`, titled **"QIX KICKERS"**.

### 4.5 Enemies — the Qix

- Rendered as a **streamer of trailing line segments**: each tick the two endpoints of the current line move independently; recent past lines persist behind it as a fading multicolor trail. Line color cycles among red / blue / green with a small random chance per tick.
- Movement: each endpoint follows an independent random velocity toward a random target inside unclaimed space (re-rolled on wall contact or on a random-interval timer); the endpoints are kept within roughly a quarter-screen of each other. The Qix never leaves unclaimed territory.
- **Kill:** the Qix's current line touching the marker, or touching any part of an incomplete Stix, while the player is drawing (or halted mid-draw). A player standing on a completed wall is safe from the Qix.

### 4.6 Enemies — Sparx and the Fuse

**Sparx**
- Each level starts with **2 Sparx** entering the border at the point farthest from the player's spawn, one clockwise and one counterclockwise.
- Sparx travel along the playfield border and all completed walls — never on an incomplete Stix (normal Sparx).
- **Sparx timer:** a red "time line" in the HUD shrinks from both ends toward the center over **37 seconds (operator, 10–99)**. On expiry: **2 more Sparx** spawn at top-center and the timer restarts.
- **Super Sparx:** on the **second** expiry, all Sparx turn blue and may pursue the marker **along an incomplete Stix**. Subsequent waves spawn as Super Sparx.
- On player death: extra (beyond the initial 2) Sparx despawn and the timer resets. Timer also resets at level start.
- Sparx base speed rises with level (step increase every 4 levels).
- **Kill:** any Sparx reaching the marker's position.

**The Fuse**
- When the player is stationary mid-draw, the fuse **sound begins immediately**; after **~1 second** the Fuse becomes visible at the origin of the incomplete Stix and burns along it toward the marker. Burned-over line renders dimmed grey.
- Resuming movement **hides and pauses** the Fuse — it does not reset. Stalling again re-ignites it from where it stopped (retaining its progress). Completing the claim extinguishes it permanently.
- **Kill:** the Fuse reaching the marker.
- The **Spiral Death Trap** is the emergent consequence: a player who seals themselves into a dead end cannot move, so the Fuse catches them. No special code path — but the attract mode demonstrates it by name.

### 4.7 Two Qix & splitting

- **Levels 1–2:** one Qix. **Level 3 onward:** two Qix.
- With two Qix, a completed claim fills whichever side contains **no** Qix; if the claim separates the two Qix into different regions, the **level ends instantly** ("split the Qix"): no threshold bonus, but the global multiplier increments (max 9×) — the long-game high-score strategy.
- If both Qix are on the same side of a claim, the other side is claimed normally.

### 4.8 Level progression & difficulty

| Level | Qix | Notes |
|---|---|---|
| 1–2 | 1 | Baseline speeds |
| 3+ | 2 | Split-the-Qix available; Qix speed rises |
| every 4 levels | — | Sparx speed +1 step |
| higher levels | — | Time-to-Super-Sparx effectively shortens; waves may spawn as Super Sparx outright |

Exact speed curves are tuning parameters owned by the Technical Design (§6.9); they must be data-driven (single difficulty table) so playtesting can adjust them without code changes.

### 4.9 Death & game over

On death: one life is lost; the incomplete Stix is erased (claimed territory persists); extra Sparx despawn; Sparx timer resets; a death animation plays (marker explodes into rays flying to the screen edges); the marker respawns at bottom-center of the current unclaimed-region boundary. When lives are exhausted: game-over sequence, then high-score entry if earned (§8.4), then return to attract mode.

### 4.10 Two-player alternating

Classic arcade 2-player: players alternate on death, each with independent score, lives, level, and multiplier. Player indicator shown between turns. (Roadmap: post-core phase; single-player is the v1 critical path.)

---

## 5. Attract mode (required feature)

The original Qix's attract mode was famously instructional — effectively a built-in tutorial — and is a required, faithful feature of this recreation. It runs whenever no game is in progress, looping:

1. **Title screen** — QIX logo, "PRESS START" (any key / tap), copyright-style footer for this project.
2. **Tutorial screens** (scripted, with live-rendered demonstrations on a mini playfield, using the original's text beats):
   - "YOUR MARKER — CONTROLLED WITH JOYSTICK" (adapted per active input: keyboard/touch)
   - "TO DRAW STIX — PRESS FAST OR SLOW"
   - "CLAIM AREAS BY JOINING WALLS WITH STIX" (demo draws and fills a box)
   - "SCORES BASED ON AREA — FAST SCORE 250 / SLOW SCORE 500" (the same demo box drawn each way)
   - "CLAIM MORE THAN 75% OF PLAYFIELD FOR SPECIAL BONUS"
   - "YOUR OPPONENTS:" showcase — THE QIX, SPARX, THE FUSE, and a live demonstration of the **SPIRAL DEATH TRAP**
3. **High-score table** — "QIX KICKERS", top 10 from localStorage.
4. **Demo game** — a scripted/AI-driven game plays itself with caption overlays ("EVADE QIX", "DODGE SPARX"), driven through the real simulation with recorded or heuristic inputs, deterministic via seeded RNG.

Requirements:
- Any input at any point starts a game immediately (with audio unlock, §6.4).
- The demo game must use the real game engine (no canned video) so it always reflects true behavior.
- Attract audio: muted by default until the user has interacted at least once with the page (browser autoplay policy); thereafter attract mode may play at reduced volume.

## 6. Audio design (required feature)

Sound in Qix is sparse but load-bearing — the Fuse hiss is gameplay-critical information. All SFX are **procedurally generated** (ZzFX-style parameter arrays) — zero audio asset files.

### 6.1 Sound inventory

| Sound | Character | Trigger / behavior |
|---|---|---|
| Background drone | Low ambient hum, subtly shifting | Loops during gameplay; intensity rises slightly as claimed % nears target |
| Draw tone | Rising tone while drawing | Loops while drawing; pitch differs fast vs. slow |
| **Fuse hiss** | Urgent crackle/hiss | Starts the instant the player stalls mid-draw (before the Fuse is visible); stops on movement; **must be clearly audible over everything** (ducks other audio) |
| Fill (fast) | Quick ascending sweep | On fast-claim fill animation |
| Fill (slow) | Deeper, richer sweep | On slow-claim fill animation |
| Sparx spawn | Short jingle | Each Sparx wave spawn |
| Super Sparx mutation | Alarm sting | When Sparx turn blue |
| Death | Explosion burst | Marker death animation |
| Level clear | Fanfare | Level-complete tally screen |
| Split-the-Qix | Distinct triumphant sting | On split (multiplier increment) |
| Menu/UI | Blip | Attract navigation, name entry, pause |

### 6.2 Audio behaviors

- Master volume slider + mute toggle, persisted in `localStorage`.
- Fuse hiss priority: sidechain/duck the drone and draw tone while the fuse sound plays.
- Death/level-clear stop all gameplay loops cleanly (no stuck loops).
- Pause silences gameplay audio (resumes on unpause).

### 6.3 Attract-mode audio

Tutorial beats have accent blips; the demo game plays its normal SFX at reduced volume; high-score table is silent except a periodic accent. All subject to the autoplay-unlock rule below.

### 6.4 Autoplay policy compliance

The Web Audio context is created/resumed only after the first user gesture. Before unlock, the game runs silently (attract mode included) and shows a small "🔇 tap for sound" hint. The first gesture (including "press start") unlocks audio.

---

## 7. Visual design

- **Palette:** black background; thin white walls; cyan/blue fast-claimed fills; dark red slow-claimed fills; red incomplete Stix; grey fuse-burned line; yellow HUD text; red-and-white diamond marker; multicolor (red/blue/green cycling) Qix streamer; white Sparx (blue when Super).
- **Fill animation:** claimed regions paint in with a sweeping fill (with matching fill sound), not an instant flood.
- **HUD (top band):** score (and 2P score), high score, claimed % vs. target, lives markers, Sparx time line (red bar shrinking from both ends), level indicator, active multiplier (when > 1×).
- **Feel:** crisp 1-unit lines at any scale (not blurry upscaling); optional subtle glow on lines and the Qix (performance permitting); death rays animation; level-clear tally screen showing `PERCENTAGE / THRESHOLD 75% / BONUS (n − 75) × 1000`.
- No licensed Taito assets or logos — an original QIX-style wordmark rendered in code.

---

## 8. Screens & flows

### 8.1 State flow

```
Boot → Attract loop (Title → Tutorial → High Scores → Demo) 
     → [any input] → Game start
Game: Level intro → Playing ⇄ Paused
      Playing → Death sequence → (lives left? next turn : Game over)
      Playing → Level clear (tally) → next Level intro
Game over → (qualifying score? Name entry) → Attract loop
```

### 8.2 Level intro

Brief overlay: level number, "PLAYER 1" (or 2), enemies fade/spawn in, short spawn jingle, then control handover.

### 8.3 Pause

`Esc`/`P` or pause button (touch). Freezes simulation and audio; overlay with resume/restart/quit-to-attract; quit requires confirmation.

### 8.4 High scores & name entry

- Top 10, three-character arcade-style name entry (up/down cycles letters, draw-button confirms; direct typing also accepted on keyboard).
- Persisted in `localStorage` (versioned key); "QIX KICKERS" table shown in attract rotation and after game over.

### 8.5 Settings ("operator menu")

Accessible from the title screen — a nod to the original's CMOS test-mode settings:

| Setting | Default | Range |
|---|---|---|
| Claim target % | 75 | 50–99 |
| Lives | 3 | 1–9 |
| Sparx time line (s) | 37 | 10–99 |
| Master volume / mute | 100% / off | — |
| Touch controls | auto | auto/on/off |
| Reset high scores | — | confirm |

Settings persist in `localStorage`. Gameplay-affecting settings display a "custom settings" tag next to scores earned with non-default values (high-score table integrity).

---

## 9. Input specification

| Action | Keyboard | Touch | Gamepad (optional) |
|---|---|---|---|
| Move | Arrow keys / WASD | Virtual d-pad (left thumb zone) | D-pad / left stick (4-way gated) |
| Fast draw | `X` / `.` / `Shift` | Right-side FAST button | A |
| Slow draw | `Z` / `,` / `Ctrl` | Right-side SLOW button | B |
| Start / confirm | `Enter` / `Space` | Tap | Start |
| Pause | `Esc` / `P` | Pause icon | Start (in game) |

- Physical-key (`e.code`) based, layout-independent; keys rebindable is a stretch goal.
- Touch layout: playfield letterboxed top; controls in bottom thumb zones; buttons sized ≥ 48 px; multi-touch (move + draw simultaneously) required.
- Input is sampled once per simulation tick into a snapshot (deterministic, replayable — this is what powers the attract demo).

---

## 10. Future ideas (explicitly out of v1 scope)

Captured from the Qix family for a possible v2 "Modern Mode": adjustable/85–90% targets with extra-life reward (Qix II), retraceable lines and power-ups (Super Qix), enemy freeze / weapons / boss win conditions (Volfied), reveal-a-picture levels (Gals Panic), online leaderboards, level layouts with pre-placed walls.

---

## 11. Success criteria

1. **Fidelity:** every rule in §4 implemented and covered by automated tests; a side-by-side player familiar with the arcade original finds no behavioral discrepancies in core play.
2. **Completeness:** attract mode (all four rotation segments), audio inventory (§6.1), HUD, pause, high scores, settings — all shipped.
3. **Performance:** steady 60 fps on a 2020-era mid-range phone; < 300 KB transfer; interactive < 2 s.
4. **Quality gates:** all unit + e2e tests green in CI; type-check and lint clean; deployed and playable at the public GitHub Pages URL.
5. **Handoff quality:** each roadmap phase independently verifiable by its stated acceptance checks.

## 12. References

- StrategyWiki — Qix Gameplay/Walkthrough; Wikipedia — Qix
- GameFAQs FAQs: War_Doc (arcade), Revned (NES), brian_sulpher (GB)
- MAME driver `src/mame/taito/qix.cpp` (hardware + operator CMOS settings: threshold, time line, turns)
- pyqix (YogaSurfTech) — frame-level faithful remake; attract-mode script transcription
- Taito Qix arcade manual (archive.org); Museum of the Game / arcade-history entries
