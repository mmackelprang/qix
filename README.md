# Qix

A faithful, browser-playable recreation of **Qix** (Taito America, 1981) in modern TypeScript — Canvas 2D rendering, procedural Web Audio sound, near-zero runtime dependencies, 60 fps, installable as a PWA.

> **Status:** design complete, implementation not yet started. This repository currently contains the full product and engineering documentation, ready for a phased (agentic) build.

## Documentation

| Document | Purpose |
|---|---|
| [**docs/PRD.md**](docs/PRD.md) | Product requirements — vision, complete game-mechanics specification (researched against the MAME driver and faithful remakes), attract mode, audio design, screens, input, success criteria |
| [**docs/TECHNICAL_DESIGN.md**](docs/TECHNICAL_DESIGN.md) | Technical design — stack selection with rationale, architecture (pure deterministic simulation + thin render/audio shells), grid/flood-fill capture algorithm, enemy systems, testing strategy |
| [**docs/ROADMAP.md**](docs/ROADMAP.md) | Phased delivery plan — 8 phases with tasks, exit criteria, and a builder contract for agentic implementation |

## The game in one paragraph

Steer a diamond marker along the playfield border and draw lines (**Stix**) into open territory — fast (blue, 1× points) or slow (red, 2× points). Close a region and the side without the **Qix** (a writhing multicolor line-storm) is claimed. Claim 75% to win the level — while **Sparx** patrol the walls, a **Fuse** burns down your line whenever you hesitate, and one careless spiral can seal your fate. From level 3, two Qix appear: split them into separate regions to end the level instantly and multiply all future scoring.

## Planned stack

TypeScript (~6.0) · Vite 8 · Canvas 2D (no engine) · zzfx + Web Audio · Vitest 4 · Playwright · Biome · GitHub Pages + PWA. Rationale in the [technical design](docs/TECHNICAL_DESIGN.md#2-technology-stack).

## License

[MIT](LICENSE). This is an original fan recreation of the game's mechanics and style; it uses no original Taito assets, code, or trademarks.
