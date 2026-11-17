// Production Infinity startup, including stalled and failed artwork requests.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});
try {
  for (const scenario of [
    'normal',
    'stalled-prefetch',
    'failed-art',
    'stalled-art',
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 600 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.devvit = {
        context: {
          postId: 't3_infinity',
          postData: {
            matchType: 'freekick',
            freeKick: {
              mode: 'infinity',
              kicker: 'pink',
              wall: 'blue',
              lives: 3,
            },
          },
        },
      };
      localStorage.setItem('street-soccer-muted', 'true');
    });
    let kitRequests = 0;
    await page.route('http://localhost/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
      if (pathname === '/art/player-pink-preview.webp') {
        kitRequests++;
        if (scenario === 'failed-art') return route.abort();
        if (
          scenario === 'stalled-art' ||
          (scenario === 'stalled-prefetch' && kitRequests === 1)
        )
          return;
      }
      return route.fulfill({ path: resolve('dist/client', '.' + pathname) });
    });
    const started = Date.now();
    await page.goto('http://localhost/freekick-infinity.html?debug', {
      waitUntil: 'domcontentloaded',
    });
    if (scenario === 'failed-art' || scenario === 'stalled-art') {
      await page
        .getByRole('heading', { name: 'Couldn’t load the game' })
        .waitFor({ timeout: 22000 });
      // A real retry must recover once the network is healthy.
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await page.route('http://localhost/**', (route) => {
        const { pathname } = new URL(route.request().url());
        if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
        return route.fulfill({ path: resolve('dist/client', '.' + pathname) });
      });
      await page.getByRole('button', { name: 'Retry' }).click();
    }
    await page.waitForFunction(
      () => window.__game?.scene.getScene('FreeKick')?.overlay === 'details',
      null,
      { timeout: 12000 }
    );
    assert.equal(await page.locator('.launch-error').count(), 0);
    assert.deepEqual(errors, []);
    if (scenario === 'stalled-prefetch') assert.equal(kitRequests, 2);
    console.log(
      `${scenario}: Infinity ready (${Date.now() - started} ms), no browser errors`
    );
    await page.close();
  }
} finally {
  await browser.close();
}
