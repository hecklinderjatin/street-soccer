// Built Custom matches: persisted kit selection, loaded frames and shared JOIN.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});
try {
  for (const [home, away] of [
    ['lime', 'gold'],
    ['navy', 'coral'],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('http://localhost/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
      return route.fulfill({ path: resolve('dist/client', pathname.slice(1)) });
    });
    await page.addInitScript(
      ({ home, away }) => {
        window.devvit = {
          context: {
            postId: 't3_kits',
            userId: 't2_kits',
            subredditId: 't5_kits',
            subredditName: 'test',
            username: 'KitTester',
            postData: { matchType: 'classic' },
          },
        };
        localStorage.setItem(
          'street-soccer:casual:v1',
          JSON.stringify({
            mode: 'casual',
            locked: false,
            difficulty: 'normal',
            durationSec: 30,
            startGoalsAgainst: 0,
            home: { name: 'HOME', jersey: home, formation: '2-1-1' },
            away: { name: 'AWAY', jersey: away, formation: '2-1-1' },
          })
        );
      },
      { home, away }
    );
    await page.goto('http://localhost/casual.html?debug');
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole('status', { name: 'Your colour' }).textContent(),
      home.toUpperCase()
    );
    assert.equal(
      await page.getByRole('status', { name: 'Opponent colour' }).textContent(),
      away.toUpperCase()
    );
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .click();
    await page.waitForFunction(
      () => window.__game?.scene.getScene('Match')?.ready
    );
    for (const kit of [home, away]) {
      const frames = await page.evaluate(
        (kit) =>
          window.__game.textures.get(`player-${kit}`).getFrameNames().length,
        kit
      );
      assert.ok(frames > 20, `${kit}: game atlas and named frames loaded`);
    }
    await page.evaluate(
      async (kits) => {
        for (const kit of kits) {
          const preview = new Image();
          preview.src = `/art/player-${kit}-preview.webp`;
          await preview.decode();
          if (!preview.naturalWidth || !preview.naturalHeight)
            throw Error('Missing preview atlas');
        }
        window.__game.scene.getScene('Hud').setOverlay(null, true);
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
      },
      [home, away]
    );
    await page.screenshot({ path: `/tmp/team-kits-${home}-${away}.png` });
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      s.flow.score = { home: 1, away: 0 };
      s.flow.finished = true;
      window.__game.scene.resume('Match');
    });
    await page.getByRole('button', { name: 'JOIN', exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
        .count(),
      0
    );
    assert.equal(
      await page
        .getByRole('button', { name: 'JOIN', exact: true })
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      'rgb(41, 173, 255)'
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    'New kit browser passed: Lime/Gold/Navy/Coral persisted selectors, built game atlas frames, Custom result and cyan JOIN.'
  );
} finally {
  await browser.close();
}
