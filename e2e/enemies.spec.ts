import { expect, test } from '@playwright/test';

/** Automated UAT for the Phase 3 threat model: Sparx patrols and the Fuse. */

const summary = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__qix?.getSummary());

const advance = (page: import('@playwright/test').Page, n: number) =>
  page.evaluate((ticks) => window.__qix?.advanceTicks(ticks), n);

test('standing still on the border gets the player caught by a Sparx', async ({ page }) => {
  await page.goto('/?test&seed=1&autostart');
  await page.waitForFunction(() => window.__qix !== undefined);
  await advance(page, 121);
  expect((await summary(page))?.mode).toBe('playing');
  expect((await summary(page))?.sparxCount).toBe(2);

  // Do nothing. A sparx patrols half the perimeter (~512 units) to reach
  // the bottom-center spawn point.
  let s = await summary(page);
  for (let i = 0; i < 8 && s?.lives === 3; i += 1) {
    await advance(page, 120);
    s = await summary(page);
  }
  // Death sequence runs, then the life is deducted.
  await advance(page, 120);
  s = await summary(page);
  expect(s?.lives).toBe(2);
  expect(s?.lastDeathCause).toBe('sparx');
});

test('stalling on a short stix near the wall is punished by the fuse', async ({ page }) => {
  await page.goto('/?test&seed=6&autostart');
  await page.waitForFunction(() => window.__qix !== undefined);
  await advance(page, 121);

  // Short draw up from the bottom wall, then freeze.
  await page.keyboard.down('KeyX');
  await page.keyboard.down('ArrowUp');
  await advance(page, 8); // 16 units up
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('KeyX');

  // Fuse: hiss at once, ignition after ~60 ticks, burn 16 edges at 1/2
  // ticks each — well before any patrol reaches us with this seed.
  await advance(page, 62);
  let s = await summary(page);
  expect(s?.fuseBurning).toBe(true);
  await advance(page, 16 * 2 + 100 + 10);
  s = await summary(page);
  expect(s?.lastDeathCause).toBe('fuse');
  expect(s?.lives).toBe(2);
  // Respawned at the stix origin on the bottom wall.
  expect(s?.marker).toEqual({ x: 128, y: 256 });
});
