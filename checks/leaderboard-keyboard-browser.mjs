// Run after the production build with a mock Reddit host and leaderboard.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const board = {
  top: Array.from({ length: 8 }, (_, index) => ({
    rank: index + 1,
    username: `Player${index + 1}`,
    goalsFor: 3,
    goalsAgainst: 1,
    value: 120,
    kmh: 120,
  })),
  me: null,
};
try {
  for (const matchType of ['classic', 'daily', 'freekick']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    await page.addInitScript((type) => {
      window.devvit = {
        context: { postId: 't3_test', postData: { matchType: type } },
        webViewMode: 1,
      };
    }, matchType);
    await page.route('http://localhost/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/api/freekick/leaders')
        return route.fulfill({ json: { score: board, speed: board } });
      if (pathname.endsWith('-leaders')) return route.fulfill({ json: board });
      if (pathname.startsWith('/api/'))
        return route.fulfill({ json: { gamesPlayed: 8 } });
      return route.fulfill({ path: resolve('dist/client', '.' + pathname) });
    });
    await page.goto('http://localhost/splash.html');
    const opener = page.getByRole('button', { name: 'ALL >', exact: true });
    const dialog = page.getByRole('dialog');
    const close = page.getByRole('button', { name: 'Close leaderboard' });
    const next = page.getByRole('button', { name: 'NEXT ›', exact: true });
    const prev = page.getByRole('button', { name: '‹ PREV', exact: true });
    const focused = (locator) =>
      locator.evaluate((node) => document.activeElement === node);

    await opener.focus();
    await page.keyboard.press('Enter');
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    assert.ok(await focused(close));
    await next.waitFor();
    await page.keyboard.press('Shift+Tab');
    assert.ok(await focused(next));
    await page.keyboard.press('Tab');
    assert.ok(await focused(close));
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    assert.ok(await focused(prev));
    await page.keyboard.press('Enter');
    assert.ok(await focused(next));

    const speed = dialog.getByRole('button', { name: 'FASTEST GOALS' });
    await speed.focus();
    await page.keyboard.press('Enter');
    await dialog.getByText('120 km/h').first().waitFor();
    assert.ok(await focused(speed));
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(await focused(opener));
    await page.setViewportSize({ width: 950, height: 640 });
    await page.keyboard.press('Enter');
    assert.ok(await focused(close));
    await close.click();
    assert.ok(await focused(opener));
    console.log(`${matchType}: opening, tab wrapping, pagination, and dismissal passed`);
    await page.close();
  }
} finally {
  await browser.close();
}
