import { expect, test } from '@playwright/test';

/** Audio unlock and mute-persistence smoke UAT (PRD §6.4). */
test('audio unlocks on first gesture and mute persists across reloads', async ({ page }) => {
  await page.goto('/?test&seed=1');
  await page.waitForFunction(() => window.__qix !== undefined);

  const before = await page.evaluate(() => window.__qix?.getAudioInfo());
  expect(before?.unlocked).toBe(false);

  // Any key is a gesture: the engine context is created.
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__qix?.getAudioInfo().unlocked === true);

  // M toggles mute; the preference persists across a reload.
  await page.keyboard.press('KeyM');
  expect((await page.evaluate(() => window.__qix?.getAudioInfo()))?.muted).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__qix !== undefined);
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__qix?.getAudioInfo().unlocked === true);
  expect((await page.evaluate(() => window.__qix?.getAudioInfo()))?.muted).toBe(true);
  // Clean up for other tests.
  await page.keyboard.press('KeyM');
});
