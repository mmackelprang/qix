import { expect, test } from '@playwright/test';

/** Shell UAT: attract rotation, start, pause, game over → name entry. */

const summary = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__qix?.getSummary());

const advance = (page: import('@playwright/test').Page, n: number) =>
  page.evaluate((ticks) => window.__qix?.advanceTicks(ticks), n);

test('attract mode cycles all four segments and loops', async ({ page }) => {
  await page.goto('/?test&seed=1');
  await page.waitForFunction(() => window.__qix !== undefined);
  expect((await summary(page))?.phase).toBe('attract');
  expect((await summary(page))?.attractSegment).toBe('title');

  const seen = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    await advance(page, 500);
    const s = await summary(page);
    if (s) seen.add(s.attractSegment);
    if (seen.size === 4) break;
  }
  expect([...seen].sort()).toEqual(['demo', 'scores', 'title', 'tutorial']);
});

test('pressing start during attract begins a game', async ({ page }) => {
  await page.goto('/?test&seed=1');
  await page.waitForFunction(() => window.__qix !== undefined);
  await advance(page, 600); // deep into the tutorial segment
  await page.keyboard.press('Space');
  await advance(page, 1);
  const s = await summary(page);
  expect(s?.phase).toBe('game');
  expect(s?.mode).toBe('levelIntro');
  expect(s?.lives).toBe(3);
});

test('pause freezes the simulation and Q quits to attract', async ({ page }) => {
  await page.goto('/?test&seed=1&autostart');
  await page.waitForFunction(() => window.__qix !== undefined);
  await advance(page, 130);
  expect((await summary(page))?.mode).toBe('playing');

  await page.keyboard.press('Escape');
  await advance(page, 1);
  expect((await summary(page))?.paused).toBe(true);
  const before = await summary(page);
  await advance(page, 60);
  const after = await summary(page);
  expect(after?.sparxTimer).toBe(before?.sparxTimer); // sim frozen

  await page.keyboard.press('Escape');
  await advance(page, 5);
  expect((await summary(page))?.paused).toBe(false);

  await page.keyboard.press('Escape');
  await advance(page, 1);
  await page.keyboard.press('KeyQ');
  await advance(page, 1);
  expect((await summary(page))?.phase).toBe('attract');
});

test('a qualifying game over runs name entry and persists the score', async ({ page }) => {
  await page.goto('/?test&seed=6&autostart&lives=1');
  await page.waitForFunction(() => window.__qix !== undefined);
  // Empty the table so any score qualifies (test-mode hook).
  await page.evaluate(() => window.__qix?.setScores([]));
  await advance(page, 121);

  // Score a little with a closed corner box…
  await page.keyboard.down('ArrowLeft');
  await advance(page, 20);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('KeyX');
  await page.keyboard.down('ArrowUp');
  await advance(page, 10); // (88,256) → (88,236)
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await advance(page, 10); // → (108,236)
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await advance(page, 10); // → (108,256): claim completes
  await page.keyboard.up('ArrowDown');
  const played = await summary(page);
  expect(played?.score ?? 0).toBeGreaterThan(0);
  // …then bait the fuse: draw into the field and stall with X held.
  await page.keyboard.down('ArrowUp');
  await advance(page, 10);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('KeyX');
  // Stall mid-draw or idle until dead; then hold through game over.
  for (let i = 0; i < 30; i += 1) {
    const s = await summary(page);
    if (s?.phase === 'nameEntry') break;
    await advance(page, 200);
  }
  expect((await summary(page))?.phase).toBe('nameEntry');

  // Type a name and confirm.
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyC');
  await page.keyboard.press('KeyE');
  await advance(page, 1);
  await page.keyboard.press('Enter');
  await advance(page, 1);
  const s = await summary(page);
  expect(s?.phase).toBe('attract');
  expect(s?.attractSegment).toBe('scores');
  const scores = await page.evaluate(() => window.__qix?.getScores());
  expect(scores?.[0]?.name).toBe('ACE');

  // Persistence across reload.
  await page.reload();
  await page.waitForFunction(() => window.__qix !== undefined);
  const reloaded = await page.evaluate(() => window.__qix?.getScores());
  expect(reloaded?.[0]?.name).toBe('ACE');
});
