// Real Free Kick renderer/UI served directly from source; Reddit/Redis APIs mocked.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const scratch = await mkdtemp(join(tmpdir(), 'fk-flow-'));
const sdk = join(scratch, 'client.ts');
await writeFile(
  sdk,
  `export const context={postId:'t3_fk',username:'tester',postData:{matchType:'freekick'}};
export const requestExpandedMode=()=>{};
export const exitExpandedMode=event=>{if(!event.isTrusted||event.type!=='click')throw Error('Quit requires native click');window.__exited=true;};
export const showForm=async form=>{(window.__forms??=[]).push(form);return {action:window.__cancel?'CANCELED':'SUBMITTED',values:{comment:'Great run',includeStats:true}};};
export const showToast=value=>{window.__toast=value;};`
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
    fs: { allow: [process.cwd(), scratch] },
  },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--mute-audio',
    ],
  });
  const address = server.httpServer.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const errors = [],
    starts = [],
    saves = [],
    posts = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const boards = {
    day: '2026-11-08',
    score: {
      top: [{ rank: 1, username: 'alice', value: 1000 }],
      me: { rank: 2, username: 'tester', value: 750 },
    },
    speed: {
      top: [{ rank: 1, username: 'bob', value: 125 }],
      me: { rank: 2, username: 'tester', value: 120 },
    },
  };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      route.request().method() === 'POST'
        ? route.request().postDataJSON()
        : null;
    if (path === '/api/freekick/start') {
      starts.push(body);
      return route.fulfill({ json: { id: body.id, day: '2026-11-08' } });
    }
    if (path === '/api/freekick/result') {
      saves.push(body);
      return route.fulfill({ json: boards });
    }
    if (path === '/api/freekick/post-score') {
      posts.push(body);
      return route.fulfill({ json: { commentId: 't1_shared' } });
    }
    if (path === '/api/freekick/leaders')
      return route.fulfill({ json: boards });
    return route.fulfill({ status: 204 });
  });
  const ready = async () =>
    page.waitForFunction(
      () => window.__game?.scene.getScene('FreeKick')?.overlay === 'details',
      null,
      { timeout: 60000 }
    );
  const press = async (label) => {
    const point = await page.evaluate((label) => {
      const g = window.__game,
        s = g.scene.getScene('FreeKick');
      const button = s.overlayLayer?.list.find((b) => b.label?.text === label);
      if (!button) throw Error('Missing button ' + label);
      const b = button.getBounds(),
        r = g.canvas.getBoundingClientRect();
      return {
        x: r.x + (b.centerX * r.width) / g.scale.width,
        y: r.y + (b.centerY * r.height) / g.scale.height,
      };
    }, label);
    await page.mouse.click(point.x, point.y, { delay: 70 });
    await page.waitForTimeout(80);
  };
  await page.goto(base + '/freekick.html?debug');
  await ready();
  const clock = await page.evaluate(
    () => window.__game.scene.getScene('FreeKick').clock
  );
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(() => window.__game.scene.getScene('FreeKick').clock),
    clock
  );
  assert.equal(starts.length, 0);
  await press('NEXT');
  assert.equal(
    await page.evaluate(() => window.__game.scene.getScene('FreeKick').overlay),
    'help'
  );
  await press('START');
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').overlay === null
  );
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.shoot({ power: 0.65, contact: s.contact, targetY: 715 });
  });
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').play?.t > 0.05
  );
  const pause = await page.evaluate(() => {
    const g = window.__game,
      s = g.scene.getScene('FreeKick'),
      b = { centerX: s.pauseButton.x, centerY: s.pauseButton.y },
      r = g.canvas.getBoundingClientRect();
    return {
      x: r.x + (b.centerX * r.width) / g.scale.width,
      y: r.y + (b.centerY * r.height) / g.scale.height,
    };
  });
  await page.mouse.click(pause.x, pause.y, { delay: 70 });
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').overlay === 'pause'
  );
  const frozen = await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    return [s.clock, s.play.t];
  });
  await page.waitForTimeout(200);
  assert.deepEqual(
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('FreeKick');
      return [s.clock, s.play.t];
    }),
    frozen
  );
  await press('HOW TO PLAY');
  await press('NEXT');
  await press('PAUSE');
  assert.equal(
    await page.evaluate(() => window.__game.scene.getScene('FreeKick').overlay),
    'pause'
  );
  await press('RESUME');
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').overlay === null
  );
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.score = 750;
    s.goals = 3;
    s.shots = 6;
    s.lives = 0;
    s.bestStreak = 3;
    s.fastestGoalKmh = 120;
    s.runStartedAt = s.clock - 30;
    s.gameOver();
  });
  await page.locator('.fk-results-screen').waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector('.results-actions button:nth-child(2)').disabled
  );
  assert.equal(saves.length, 1);
  assert.equal(saves[0].result.fastestGoalKmh, 120);
  assert.equal(saves[0].result.shots, 6);
  await page
    .getByRole('button', { name: 'FASTEST GOALS', exact: true })
    .click();
  assert.match(
    await page.locator('.results-board ol').textContent(),
    /125 KM\/H/
  );
  await page
    .getByRole('button', { name: 'HIGHEST SCORE', exact: true })
    .click();
  assert.match(
    await page.locator('.results-board ol').textContent(),
    /1,?000 pts/
  );
  for (const [width, height] of [
    [320, 480],
    [390, 600],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    assert.ok(
      await page
        .locator('.results-actions')
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1)
    );
    assert.ok(
      await page
        .locator('.results-panel')
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1)
    );
  }
  await page.evaluate(() => (window.__cancel = true));
  await page
    .getByRole('button', { name: 'POST MY SCORE', exact: true })
    .click();
  await page.waitForTimeout(50);
  assert.equal(posts.length, 0);
  await page.evaluate(() => (window.__cancel = false));
  await page
    .getByRole('button', { name: 'POST MY SCORE', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('.results-actions button:nth-child(2)').disabled
  );
  assert.equal(posts.length, 1);
  assert.equal('result' in posts[0], false);
  assert.equal(posts[0].id, starts[0].id);
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  await ready();
  assert.equal(await page.locator('.fk-results-screen').count(), 0);
  assert.equal(saves.length, 1);
  await press('NEXT');
  await press('START');
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').setOverlay('pause')
  );
  await page.getByRole('link', { name: 'QUIT', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__exited), true);
  assert.equal(saves.length, 1, 'quit does not rank a partial run');
  await page.setViewportSize({ width: 390, height: 600 });
  const previousStarts = starts.length,
    previousSaves = saves.length;
  await page.goto(base + '/freekick-practice.html?debug');
  await page.locator('#practice-level').selectOption('3');
  await page
    .getByRole('button', { name: 'START PRACTICE', exact: true })
    .click();
  await ready();
  assert.equal(
    await page.evaluate(
      () => window.__game.scene.getScene('FreeKick').practice
    ),
    true
  );
  await press('NEXT');
  await press('START');
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.shoot({ power: 0.65, contact: s.contact, targetY: 715 });
  });
  await page.waitForFunction(
    () => window.__game.scene.getScene('FreeKick').play?.t > 0.05
  );
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').setOverlay('pause')
  );
  await press('NEW SPOT');
  assert.equal(
    await page.evaluate(
      () => window.__game.scene.getScene('FreeKick').setup.level.level
    ),
    3
  );
  assert.equal(starts.length, previousStarts);
  assert.equal(saves.length, previousSaves);
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').setOverlay('pause')
  );
  await page.getByRole('link', { name: 'QUIT', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__exited), true);
  assert.deepEqual(errors, []);
  console.log(
    'Free Kick flow passed: default details/controls, pause/help return, frozen flight, results, both boards, native score confirmation/cancel, resize, replay and trusted quit'
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
