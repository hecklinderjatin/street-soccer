// Run after the production build to exercise the shipped trimmed Phaser.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const origin = 'http://localhost';
  await page.route(`${origin}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
    return route.fulfill({ path: resolve('dist/client', '.' + pathname) });
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const entry of ['infinity', 'challenge', 'practice', 'playground']) {
    await page.goto(`${origin}/freekick-${entry}.html?debug`);
    if (entry === 'practice')
      await page.getByRole('button', { name: 'START PRACTICE' }).click();
    await page
      .waitForFunction(
        () => window.__game?.scene.getScene('FreeKick')?.stage,
        null,
        {
          timeout: 15000,
        }
      )
      .catch((error) => {
        throw new Error(
          `Free Kick ${entry} did not start: ${errors.join('; ')}`,
          {
            cause: error,
          }
        );
      });
    await page.locator('#boot-loading').waitFor({ state: 'hidden' });
    if (entry === 'challenge') {
      await page.evaluate(() => {
        const scene = window.__game.scene.getScene('FreeKick');
        scene.lives = 0;
        scene.gameOver();
      });
      const replay = page.getByRole('button', { name: 'PLAY AGAIN' });
      assert.equal(
        await replay.evaluate(
          (button) => getComputedStyle(button).backgroundColor
        ),
        'rgb(0, 228, 54)'
      );
    }
    assert.deepEqual(errors, [], `Free Kick ${entry} failed during startup`);
  }
  console.log('Production Free Kick starts in all four entrypoints.');
} finally {
  await browser.close();
}
