// Run against the production build. The browser receives a simulated Reddit host.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const [entry, mode] of [
    ['index', 'classic'],
    ['index', 'daily'],
    ['casual', 'casual'],
    ['freekick-challenge', 'freekick'],
    ['freekick-infinity', 'freekick'],
    ['freekick-practice', 'freekick'],
    ['freekick-playground', 'freekick'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 480 } });
    let blockDownload = true;
    await page.addInitScript((matchType) => {
      window.devvit = {
        context: { postId: 't3_test', postData: { matchType } },
        webViewMode: 2,
      };
      window.hostMessages = [];
      addEventListener('message', (event) => {
        if (event.data?.type === 'devvit-internal')
          window.hostMessages.push(event.data);
      });
    }, mode);
    await page.route('http://localhost/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (blockDownload && pathname === '/ProjectedPlane.js')
        return route.abort();
      if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
      return route.fulfill({ path: resolve('dist/client', '.' + pathname) });
    });

    const start = async () => {
      if (entry === 'freekick-practice')
        await page.getByRole('button', { name: 'START PRACTICE' }).click();
      if (entry === 'freekick-playground')
        await page.getByRole('button', { name: 'Create Game' }).click();
    };
    await page.goto(`http://localhost/${entry}.html?debug`);
    await start();
    const error = page.getByRole('heading', { name: 'Couldn’t load the game' });
    await error.waitFor();
    assert.ok(await error.evaluate((title) => document.activeElement === title));
    await page.getByRole('button', { name: 'Back to post' }).click();
    await page.waitForFunction(() =>
      window.hostMessages.some(
        (message) => message.immersiveMode?.immersiveMode === 1
      )
    );

    blockDownload = false;
    await Promise.all([
      page.waitForEvent('domcontentloaded'),
      page.getByRole('button', { name: 'Retry' }).click(),
    ]);
    await start();
    await page.locator('#boot-loading').waitFor({ state: 'detached' });
    await page.locator('canvas').waitFor();
    assert.equal(await error.count(), 0);
    await page.close();
    console.log(`${entry} / ${mode}: blocked download, exit, and retry passed`);
  }
} finally {
  await browser.close();
}
