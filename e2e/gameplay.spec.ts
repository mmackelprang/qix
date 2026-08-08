import { expect, test } from '@playwright/test';

/**
 * Automated UAT: play the game for real through keyboard events and the
 * deterministic tick driver, and verify a territory claim end to end.
 */
test('drawing a line across the field claims the non-Qix side', async ({ page }) => {
  await page.goto('/?test&seed=1');
  await page.waitForFunction(() => window.__qix !== undefined);

  const before = await page.evaluate(() => window.__qix?.getSummary());
  expect(before?.claimedPercent).toBe(0);
  // Marker spawns bottom-center of the 256×256 field.
  expect(before?.marker).toEqual({ x: 128, y: 256 });

  // Hold Up + Fast (X) and advance until the line crosses the whole field.
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('KeyX');
  await page.evaluate(() => window.__qix?.advanceTicks(150));
  await page.keyboard.up('KeyX');
  await page.keyboard.up('ArrowUp');

  const after = await page.evaluate(() => window.__qix?.getSummary());
  // The vertical line at x=128 splits the field; the Qix stand-in sits in
  // the right half, so the left half (exactly 50%) is claimed.
  expect(after?.claimedPercent).toBeCloseTo(50);
  expect(after?.drawing).toBe(false);
  expect(after?.marker).toEqual({ x: 128, y: 0 });
});

test('releasing the draw button mid-draw halts the marker', async ({ page }) => {
  await page.goto('/?test&seed=1');
  await page.waitForFunction(() => window.__qix !== undefined);

  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('KeyX');
  await page.evaluate(() => window.__qix?.advanceTicks(10));
  await page.keyboard.up('KeyX');
  const midDraw = await page.evaluate(() => window.__qix?.getSummary());
  expect(midDraw?.drawing).toBe(true);

  await page.evaluate(() => window.__qix?.advanceTicks(30));
  const halted = await page.evaluate(() => window.__qix?.getSummary());
  expect(halted?.marker).toEqual(midDraw?.marker);
  expect(halted?.drawing).toBe(true);
});
