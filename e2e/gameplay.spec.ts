import { expect, test } from '@playwright/test';

/**
 * Automated UAT: play the game for real through keyboard events and the
 * deterministic tick driver. Seeded runs make every assertion exact.
 */

const summary = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__qix?.getSummary());

const advance = (page: import('@playwright/test').Page, n: number) =>
  page.evaluate((ticks) => window.__qix?.advanceTicks(ticks), n);

async function skipIntro(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => window.__qix !== undefined);
  await advance(page, 121);
  expect((await summary(page))?.mode).toBe('playing');
}

test('claiming a corner box scores by area and keeps playing', async ({ page }) => {
  await page.goto('/?test&seed=1&autostart&speed=200');
  await skipIntro(page);

  // Draw a small box near the bottom edge, far from the Qix's spawn:
  // left along the wall, up, right, back down to the wall.
  await page.keyboard.down('ArrowLeft');
  await advance(page, 20); // (128,256) → (88,256)
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('KeyX');
  await page.keyboard.down('ArrowUp');
  await advance(page, 10); // → (88,236)
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await advance(page, 20); // → (128,236)
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await advance(page, 10); // → (128,256): completes on the bottom wall
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('KeyX');

  const s = await summary(page);
  // Box is 40×20 cells = 800 of 65,536 → 1.220703125%.
  expect(s?.claimedPercent).toBeCloseTo((800 / 65536) * 100, 5);
  // Fast claim: floor(1.2207… × 100) = 122 points.
  expect(s?.score).toBe(122);
  expect(s?.mode).toBe('playing');
  expect(s?.drawing).toBe(false);
  expect(s?.lives).toBe(3);
});

test('reaching the target ends the level with a bonus and advances', async ({ page }) => {
  // Operator target lowered to 30% for a fast UAT loop.
  await page.goto('/?test&seed=3&target=30&autostart&speed=200');
  await skipIntro(page);

  // Claim the left ~38% of the field: ride left along the bottom, then
  // draw straight up at x=98 (Qix roams near center at spawn height).
  await page.keyboard.down('ArrowLeft');
  await advance(page, 15); // (128,256) → (98,256)
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('KeyX');
  await page.keyboard.down('ArrowUp');
  await advance(page, 140); // draw to the top wall
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('KeyX');

  const s = await summary(page);
  expect(s?.mode).toBe('levelClear');
  // Left of x=98: 98×256 cells = 38.28125%. Fast claim floor(3828.125) =
  // 3828 points, plus (38 − 30) × 1000 bonus.
  expect(s?.score).toBe(3828 + 8000);
  expect(s?.level).toBe(1);

  // The tally screen holds, then the next level begins.
  await advance(page, 200);
  const next = await summary(page);
  expect(next?.mode === 'levelIntro' || next?.mode === 'playing').toBe(true);
  expect(next?.level).toBe(2);
  expect(next?.claimedPercent).toBe(0);
  expect(next?.score).toBe(3828 + 8000);
});

test('halting mid-draw in the open field is eventually fatal', async ({ page }) => {
  await page.goto('/?test&seed=1&autostart&speed=200');
  await skipIntro(page);

  // Draw up into the middle of the field and stop — the fuse ignites and
  // the Qix roams; one of them will get us (seeded, so deterministic).
  await page.keyboard.down('KeyX');
  await page.keyboard.down('ArrowUp');
  await advance(page, 55); // → (128, 146), mid-field
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('KeyX');

  // Advance in chunks until the death sequence has run.
  let lives = 3;
  for (let i = 0; i < 40 && lives === 3; i += 1) {
    await advance(page, 200);
    const s = await summary(page);
    lives = s?.lives ?? 3;
    if (s?.mode === 'death') {
      await advance(page, 100); // let the sequence resolve
      lives = (await summary(page))?.lives ?? lives;
    }
  }
  const s = await summary(page);
  expect(s?.lives).toBe(2);
  expect(s?.drawing).toBe(false);
  // Respawned where the stix began: bottom-center wall. (A patrolling
  // sparx may legitimately be mid-way through a second kill by now.)
  expect(s?.marker).toEqual({ x: 128, y: 256 });
  expect(s?.mode === 'playing' || s?.mode === 'death').toBe(true);
});

test('default game speed is authentic: 1 unit per tick on the wall', async ({ page }) => {
  await page.goto('/?test&seed=1&autostart');
  await page.waitForFunction(() => window.__qix !== undefined);
  await page.evaluate(() => window.__qix?.advanceTicks(121));
  expect((await summary(page))?.speedPercent).toBe(100);
  await page.keyboard.down('ArrowLeft');
  await page.evaluate(() => window.__qix?.advanceTicks(10));
  await page.keyboard.up('ArrowLeft');
  const s = await summary(page);
  // 10 ticks at 1 unit/tick — the 1981 marker pace.
  expect(s?.marker).toEqual({ x: 118, y: 256 });
});
