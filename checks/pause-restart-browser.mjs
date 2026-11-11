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
export const canRunAsUser=async()=>true;
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

  for (const entry of [
    'freekick.html',
    'freekick-challenge.html',
    'freekick-practice.html',
  ]) {
    await page.goto(base + '/' + entry + '?debug');
    if (entry.includes('practice')) {
      await page.locator('#practice-level').selectOption('3');
      await page.locator('button[type=submit]').click();
    }
    await ready();
    const before = await page.evaluate(() => {
      const s = window.__game.scene.getScene('FreeKick');
      s.score = 750;
      s.goals = 2;
      s.shots = 5;
      s.streak = 2;
      s.bestStreak = 2;
      s.lives = 1;
      const id = s.records.id;
      s.setOverlay(null, true);
      s.setOverlay('pause');
      return {
        id,
        practice: s.practice,
        level: s.practiceLevel,
        challenge: s.challenge,
      };
    });
    const position = await page.evaluate(() => {
      const g = window.__game,
        s = g.scene.getScene('FreeKick'),
        r = g.canvas.getBoundingClientRect();
      const b = s.overlayLayer.list.find((n) => n.label?.text === 'RESTART');
      const quit = document
        .querySelector('.fk-pause-quit')
        .getBoundingClientRect();
      return {
        x: r.x + (b.x * r.width) / g.scale.width,
        y: r.y + (b.y * r.height) / g.scale.height,
        quitTop: quit.top,
        restartBottom: r.y + ((b.y + 40) * r.height) / g.scale.height,
      };
    });
    assert.ok(position.quitTop > position.restartBottom);
    await page.mouse.click(position.x, position.y, { delay: 70 });
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => {
      const s = window.__game.scene.getScene('FreeKick');
      return {
        id: s.records.id,
        score: s.score,
        goals: s.goals,
        shots: s.shots,
        lives: s.lives,
        maxLives: s.maxLives,
        overlay: s.overlay,
        practice: s.practice,
        level: s.practiceLevel,
        challenge: s.challenge,
        streak: s.streak,
        bestStreak: s.bestStreak,
      };
    });
    assert.notEqual(after.id, before.id);
    assert.equal(after.score, 0);
    assert.equal(after.goals, 0);
    assert.equal(after.shots, 0);
    assert.equal(after.streak, 0);
    assert.equal(after.bestStreak, 0);
    assert.equal(after.lives, after.maxLives);
    assert.equal(after.overlay, 'details');
    assert.equal(after.practice, before.practice);
    assert.equal(after.level, before.level);
    assert.deepEqual(after.challenge, before.challenge);
    assert.equal(await page.locator('.fk-pause-quit').count(), 0);
  }
  assert.equal(saves.length, 0);
  assert.equal(posts.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    'Free Kick pause restart passed: Play, Challenge and chosen-level Practice reset progress, preserve settings, renew run IDs, clear pause UI and never save partial runs.'
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
