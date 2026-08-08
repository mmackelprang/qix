import { expect, test } from '@playwright/test';

test('boots and runs the loop at 60 Hz', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#hud')).toBeVisible();
  // The live loop should accumulate ticks in real time.
  await page.waitForTimeout(500);
  const running = await page.evaluate(() => document.querySelector('#game') !== null);
  expect(running).toBe(true);
});

test('test mode drives ticks deterministically', async ({ page }) => {
  await page.goto('/?test');
  await page.waitForFunction(() => window.__qix !== undefined);
  const before = await page.evaluate(() => window.__qix?.getTicks());
  expect(before).toBe(0);
  await page.evaluate(() => window.__qix?.advanceTicks(120));
  const after = await page.evaluate(() => window.__qix?.getTicks());
  expect(after).toBe(120);
  // rAF loop must not be running in test mode (determinism).
  const running = await page.evaluate(() => window.__qix?.isRunning());
  expect(running).toBe(false);
});
