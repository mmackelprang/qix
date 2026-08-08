// All tuning constants and (later) difficulty tables live here — the single
// place playtesting adjusts numbers. Values sourced from docs/PRD.md §4.

/** Simulation tick rate (Hz) and derived tick length in ms. */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Logical playfield size in grid units (matches the original's raster). */
export const FIELD_W = 256;
export const FIELD_H = 256;

/** HUD band height in logical units, drawn above the playfield. */
export const HUD_H = 48;

/** Total logical canvas size. */
export const LOGICAL_W = FIELD_W;
export const LOGICAL_H = HUD_H + FIELD_H;

/** Marker speed in grid units per tick when fast-drawing / wall-riding. */
export const PLAYER_SPEED = 2;

/** Claim target percentage (operator default). */
export const DEFAULT_TARGET_PERCENT = 75;

/** Lives (operator default, "NUMBER OF TURNS"). */
export const DEFAULT_LIVES = 3;

/** Sparx time line in seconds (operator default). */
export const DEFAULT_SPARX_TIME_S = 37;

/** Palette (PRD §7). */
export const COLORS = {
  background: '#000000',
  wall: '#ffffff',
  claimedFast: '#00b0b0',
  claimedSlow: '#912412',
  stix: '#ff2020',
  stixBurned: '#555555',
  hudText: '#ffd020',
  marker: '#ff3030',
  markerCore: '#ffffff',
} as const;
