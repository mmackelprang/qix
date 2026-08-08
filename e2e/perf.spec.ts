import { expect, test } from '@playwright/test';

/** Performance budget UAT (PRD §2): the sim must be far faster than realtime. */
test('2000 simulation ticks complete well under realtime', async ({ page }) => {
  await page.goto('/?test&seed=1&autostart');
  await page.waitForFunction(() => window.__qix !== undefined);
  const elapsedMs = await page.evaluate(() => {
    const start = performance.now();
    window.__qix?.advanceTicks(2000);
    return performance.now() - start;
  });
  // 2000 ticks is 33.3s of gameplay; budget it at 10% of realtime.
  expect(elapsedMs).toBeLessThan(3334);
});
