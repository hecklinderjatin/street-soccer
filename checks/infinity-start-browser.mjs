// Exercise the affected post's startup through a real swipe, using a webview
// script inventory deduplicated by content like a fresh Devvit upload.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('dist/client');
const scripts = new Set(),
  hashes = new Set();
for (const name of (await readdir(root))
  .filter((name) => name.endsWith('.js'))
  .sort()) {
  const hash = createHash('sha256')
    .update(await readFile(resolve(root, name)))
    .digest('hex');
  if (!hashes.has(hash)) scripts.add('/' + name);
  hashes.add(hash);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const errors = [],
    missing = [],
    starts = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.devvit = {
      context: {
        postId: 't3_1xtr5jv',
        postData: {
          matchType: 'freekick',
          freeKick: {
            mode: 'infinity',
            kicker: 'black',
            wall: 'blue',
            lives: 3,
            difficulty: 'easy',
            distanceM: 25,
            goals: 0,
            wallGapM: 9,
          },
        },
      },
    };
    localStorage.setItem('street-soccer-muted', 'true');
  });
  await page.route('http://localhost/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/freekick/start') {
      const body = route.request().postDataJSON();
      starts.push(body);
      return route.fulfill({ json: { id: body.id, day: '2026-11-18' } });
    }
    if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
    if (pathname.endsWith('.js') && !scripts.has(pathname)) {
      missing.push(pathname);
      return route.fulfill({ status: 404, body: 'Missing uploaded asset' });
    }
    return route.fulfill({ path: resolve(root, '.' + pathname) });
  });
  await page.goto('http://localhost/freekick-infinity.html?debug');
  await page.waitForFunction(
    () => window.__game?.scene.getScene('FreeKick')?.overlay === 'details'
  );
  await page.locator('#boot-loading').waitFor({ state: 'detached' });
  const press = async (label) => {
    const point = await page.evaluate((label) => {
      const g = window.__game,
        s = g.scene.getScene('FreeKick');
      const button = s.overlayLayer.list.find(
        (button) => button.label?.text === label
      );
      if (!button) throw Error('Missing button: ' + label);
      const r = g.canvas.getBoundingClientRect();
      return {
        x: r.x + (button.x * r.width) / g.scale.width,
        y: r.y + (button.y * r.height) / g.scale.height,
      };
    }, label);
    // Let Phaser process the press on a frame before releasing the button.
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.evaluate(() =>
      new Promise((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
      )
    );
    await page.mouse.up();
  };
  await press('START GAME');
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').overlay === null
  );
  const swipe = await page.evaluate(() => {
    const g = window.__game,
      s = g.scene.getScene('FreeKick');
    const ball = s.ballLayout(),
      r = g.canvas.getBoundingClientRect();
    return {
      x: r.x + (ball.x * r.width) / g.scale.width,
      y: r.y + (ball.y * r.height) / g.scale.height,
    };
  });
  await page.mouse.move(swipe.x, swipe.y);
  await page.mouse.down();
  await page.mouse.move(swipe.x - 45, swipe.y - 120, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').shots === 1
  );
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').play?.outcome,
    null,
    { timeout: 15000 }
  );
  assert.equal(starts[0]?.mode, 'infinity');
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').overlay === 'pause'
  );
  await press('RESTART');
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').overlay === 'details'
  );
  await press('START GAME');
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('FreeKick');
    return s.overlay === null && s.phase === 'aim' && s.shots === 0;
  });
  assert.deepEqual(missing, []);
  assert.deepEqual(errors, []);
  const output = resolve('..', 'output');
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: resolve(output, 'infinity-start.png') });
  console.log(
    'Infinity upload/start passed: deduplicated scripts, real post settings, briefing, Start Game, swipe, shot outcome, pause and restart.'
  );
} finally {
  await browser.close();
}
