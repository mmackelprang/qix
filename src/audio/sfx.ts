/**
 * The complete SFX inventory (PRD §6.1) as ZzFX parameter arrays — the
 * game ships zero audio asset files. Tune with the ZzFX sound designer
 * (https://killedbyapixel.github.io/ZzFX/) and paste rows back here.
 */

export type SfxName =
  | 'fillFast'
  | 'fillSlow'
  | 'sparxSpawn'
  | 'superSparx'
  | 'death'
  | 'levelClear'
  | 'split'
  | 'spawn'
  | 'gameOver'
  | 'blip';

type ZzfxParams = readonly (number | undefined)[];

export const SFX: Readonly<Record<SfxName, ZzfxParams>> = {
  // Quick ascending sweep — fast-claim fill.
  fillFast: [1.1, , 539, 0, 0.04, 0.29, 1, 1.65, , , 537, 0.02, 0.02, , , , 0.04],
  // Deeper, richer sweep — slow-claim fill (2x points deserve 2x bass).
  fillSlow: [1.2, , 270, 0.02, 0.08, 0.35, 1, 1.5, , , 270, 0.04, 0.04, , , , 0.1],
  // Short two-note jingle — sparx wave enters.
  sparxSpawn: [0.8, , 150, 0.05, 0.15, 0.02, , 2.0, , , 300, 0.1],
  // Alarm sting — sparx turn blue.
  superSparx: [1, , 730, , 0.06, 0.1, 2, 0.1, , , , , , , , , 0.1],
  // Explosion burst — marker death.
  death: [1.3, , 333, 0.01, 0, 0.9, 4, 1.9, , , , , , 0.5, , 0.6],
  // Rising fanfare — level tally.
  levelClear: [1, , 940, 0.05, 0.2, 0.3, , 1.7, , , 200, 0.05, 0.1],
  // Triumphant zap — split the qix.
  split: [1, , 662, , 0.11, 0.26, 2, 1.84, -9.9, , , , , 0.5, , 0.3, 0.1],
  // Soft chime — level start / respawn.
  spawn: [0.7, , 440, 0.02, 0.1, 0.18, , 1.4, , , 220, 0.06],
  // Descending dirge — game over.
  gameOver: [1.2, , 220, 0.1, 0.4, 0.7, 1, 1.2, -3, , -100, 0.15],
  // UI blip — menus, name entry.
  blip: [0.5, , 1000, , 0.01, 0.03, , , , , , , , , , , , 0.5],
};
