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
  `export const context={postId:'t3_fk',username:'tester',postData:{matchType:'freekick',freeKick:{kicker:'pink',wall:'blue',lives:2,goals:3,distanceM:20,wallFromGoalM:10,difficulty:'hard'}}};
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
  define: { __JOURNEYS_ENABLED__: 'true' },
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
  let denied = false;
  const events = [];
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
    if (path.startsWith('/api/journeys/')) {
      events.push({ path, body });
      if (path.endsWith('/start'))
        return route.fulfill({
          json: { journeyId: denied ? '' : `fk_${events.length}` },
        });
      return route.fulfill({ status: 204 });
    }
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
      const b = button,
        r = g.canvas.getBoundingClientRect();
      return {
        x: r.x + (b.x * r.width) / g.scale.width,
        y: r.y + (b.y * r.height) / g.scale.height,
      };
    }, label);
    await page.mouse.click(point.x, point.y, { delay: 70 });
    await page.waitForTimeout(80);
  };

  const count = (suffix) =>
    events.filter((e) => e.path.endsWith(suffix)).length;
  const waitCount = async (suffix, n) => {
    await assert.doesNotReject(async () => {
      for (let i = 0; i < 100 && count(suffix) < n; i++)
        await page.waitForTimeout(30);
      assert.equal(count(suffix), n);
    });
  };
  for (const practice of [false, true]) {
    events.length = 0;
    await page.goto(
      base +
        '/' +
        (practice ? 'freekick-practice' : 'freekick-challenge') +
        '.html?debug'
    );
    if (practice) {
      await page.locator('#practice-level').selectOption('3');
      await page.locator('button[type=submit]').click();
    }
    await ready();
    assert.equal(count('/start'), 0, 'briefing does not start');
    await press('NEXT');
    assert.equal(count('/start'), 0, 'help does not start');
    await press('PLAY');
    await waitCount('/start', 1);
    assert.deepEqual(events.find((e) => e.path.endsWith('/start')).body, {
      mode: practice ? 'freekick-practice' : 'freekick-challenge',
      difficulty: 'hard',
      durationSec: 0,
      rematch: false,
      level: practice ? 3 : 5,
      goalTarget: practice ? 0 : 3,
      lives: practice ? 0 : 2,
    });
    const time = await page.evaluate(() => {
      const s = window.__game.scene.getScene('FreeKick');
      s.setOverlay('pause');
      return s.clock;
    });
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => window.__game.scene.getScene('FreeKick').clock),
      time
    );
    if (practice) {
      await press('NEW SPOT');
      assert.equal(count('/start'), 1);
      assert.equal(count('/end'), 0);
      await page.evaluate(() =>
        window.__game.scene.getScene('FreeKick').setOverlay('pause')
      );
    }
    await press('RESTART');
    await ready();
    await waitCount('/end', 1);
    assert.equal(
      events.find((e) => e.path.endsWith('/end')).body.outcome,
      'quit'
    );
    assert.equal(count('/start'), 1, 'restart waits for commitment');
    await press('START GAME');
    await waitCount('/start', 2);
    assert.equal(
      events.filter((e) => e.path.endsWith('/start'))[1].body.rematch,
      true
    );
    if (practice) {
      await page.evaluate(() =>
        window.__game.scene.getScene('FreeKick').setOverlay('pause')
      );
      await page.locator('.fk-pause-quit').click();
      await waitCount('/end', 2);
      assert.equal(
        events.filter((e) => e.path.endsWith('/end'))[1].body.mode,
        'freekick-practice'
      );
      assert.equal(saves.length, 0, 'practice never writes records');
    } else {
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('FreeKick');
        s.score = 2400;
        s.goals = 3;
        s.shots = 4;
        s.gameOver();
        s.finishJourney(false);
      });
      await waitCount('/end', 2);
      const result = events.filter((e) => e.path.endsWith('/end'))[1].body;
      assert.equal(result.outcome, 'cleared');
      assert.equal(result.points, 2400);
      assert.equal(result.goalsFor, 3);
      assert.equal(result.goalsAgainst, 1);
      await page
        .getByRole('button', { name: 'PLAY AGAIN', exact: true })
        .click();
      await ready();
      assert.equal(count('/start'), 2, 'replay waits for start');
      await press('START GAME');
      await waitCount('/start', 3);
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('FreeKick');
        s.lives = 0;
        s.gameOver();
      });
      await waitCount('/end', 3);
      assert.equal(
        events.filter((e) => e.path.endsWith('/end'))[2].body.outcome,
        'failed'
      );
      assert.notEqual(
        result.journeyId,
        events.filter((e) => e.path.endsWith('/end'))[2].body.journeyId
      );
    }
  }
  denied = true;
  events.length = 0;
  await page.goto(base + '/freekick-challenge.html?debug');
  await ready();
  await press('START GAME');
  await waitCount('/start', 1);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.lives = 0;
    s.gameOver();
  });
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).waitFor();
  await page.waitForTimeout(200);
  assert.equal(count('/end'), 0, 'denied receipt emits no follow-up');
  assert.deepEqual(errors, []);
  console.log(
    'Free Kick Journeys browser passed: briefing/help exclusion, committed start, pause, New Spot, restart, completion/failure, replay, Practice quit and denied receipt.'
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
