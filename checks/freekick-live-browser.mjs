// Exercise the actual WebGL preview from Vite source, with a mocked Reddit host.
// No production/application build or live Reddit operations.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const scratch = await mkdtemp(join(tmpdir(), 'street-soccer-preview-'));
const sdk = join(scratch, 'client.ts');
await writeFile(
  sdk,
  `import Phaser from 'phaser';
// The shipped trimmed renderer omits Linear; match that API here.
delete Phaser.Math.Linear;
export const context = { postId: 't3_preview', postData: { matchType:'freekick', description:'Play or practise your free kicks.' } };
export const requestExpandedMode = (_event, entry) => { window.__expanded = entry; };`
);
const server = await createServer({
  configFile: false,
  root: process.cwd() + '/src/client',
  publicDir: process.cwd() + '/public-release',
  resolve: { alias: { '@devvit/web/client': sdk } },
  define: { __JOURNEYS_ENABLED__: 'false' },
  server: {
    host: '127.0.0.1',
    port: 0,
    fs: { allow: [process.cwd(), '/tmp'] },
  },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const errors = [],
    writes = [],
    sounds = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(r.url());
    if (r.url().includes('.mp3')) sounds.push(r.url());
  });
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: {
        day: '2026-11-08',
        score: {
          top: [{ rank: 1, username: 'ItsJstar', value: 500 }],
          me: null,
        },
        speed: { top: [], me: null },
      },
    })
  );
  const address = server.httpServer.address();
  assert.ok(address && typeof address === 'object');
  await page.goto(`http://127.0.0.1:${address.port}/splash.html?debug`);
  await page.waitForFunction(
    () => window.__freekickPreview?.scene.getScene('FreeKickPreview')?.stage,
    null,
    { timeout: 60000 }
  );
  await page.evaluate(() =>
    localStorage.setItem('street-soccer-freekick-best', '12345')
  );
  await page.waitForFunction(
    () =>
      window.__freekickPreview.scene.getScene('FreeKickPreview').attempt >= 2,
    null,
    { timeout: 30000 }
  );
  const shot = await page.evaluate(() => {
    const s = window.__freekickPreview.scene.getScene('FreeKickPreview');
    return {
      attempt: s.attempt,
      clock: s.clock,
      phase: s.play ? (s.play.outcome ?? 'flight') : 'setup',
    };
  });
  console.log('Real renderer auto-repeats:', shot);
  if (process.env.FREEKICK_PREVIEW_SCREENSHOT)
    await page.screenshot({ path: process.env.FREEKICK_PREVIEW_SCREENSHOT });
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.deepEqual(sounds, []);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('street-soccer-freekick-best')
    ),
    '12345'
  );
  for (const [width, height] of [
    [320, 400],
    [320, 480],
    [390, 600],
    [720, 1100],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const bounds = await page.locator('.freekick-practice').boundingBox();
    assert.ok(bounds && bounds.y + bounds.height <= height);
    const ball = await page.evaluate(() => {
      const g = window.__freekickPreview,
        s = g.scene.getScene('FreeKickPreview'),
        p = { x: 0, y: 0, z: 0, scale: 0, depth: 0 };
      s.cam.project(s.setup.spot.x, s.setup.spot.y, 10, p);
      return {
        y: (p.y * g.canvas.getBoundingClientRect().height) / g.scale.height,
        details: document
          .querySelector('.freekick-lobby-details')
          .getBoundingClientRect().top,
      };
    });
    assert.ok(
      ball.y < ball.details,
      `${width}x${height}: ball stays above actions ${JSON.stringify(ball)}`
    );
    console.log('Live preview fit:', width, height, ball);
  }
  await page.evaluate(() => {
    document.querySelector('#game').style.top = '200vh';
  });
  await page.waitForFunction(() => !window.__freekickPreview.loop.running);
  const stopped = await page.evaluate(
    () => window.__freekickPreview.scene.getScene('FreeKickPreview').clock
  );
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(
      () => window.__freekickPreview.scene.getScene('FreeKickPreview').clock
    ),
    stopped
  );
  await page.evaluate(() => {
    document.querySelector('#game').style.top = '0';
  });
  await page.waitForFunction(() => window.__freekickPreview.loop.running);
  await page.locator('.freekick-challenge').click();
  assert.equal(
    await page.evaluate(() => window.__expanded),
    'freekick-challenge'
  );
  await page.locator('.freekick-practice').click();
  assert.equal(
    await page.evaluate(() => window.__expanded),
    'freekick-practice'
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(sounds, []);
  console.log(
    'Actual preview: off-screen sleep/resume, actions, no audio/metrics/best-score writes passed'
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
