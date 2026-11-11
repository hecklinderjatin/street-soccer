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
  `export const context={postId:'t3_fk',username:'tester',userId:'t2_tester',subredditId:'t5_test',subredditName:'street_soccer_dev',postData:{matchType:'freekick'}};
export const canRunAsUser=async()=>true;
export const requestExpandedMode=(event,entry)=>{if(!event.isTrusted||event.type!=='click')throw Error('Practice requires native click');window.__expandedEntry=entry;};
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

  await page.addInitScript(() =>
    localStorage.setItem(
      'street-soccer:joined:t2_tester:t5_test:self-confirmed',
      'yes'
    )
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '/freekick-challenge.html?debug');
  await ready();
  await page.evaluate(() =>
    window.__game.scene.getScene('FreeKick').setOverlay('help')
  );
  await page.waitForTimeout(150);
  const help = await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    return {
      images: s.overlayLayer.list.filter((n) => n.type === 'Image').length,
      overflow: s.overlayLayer.list
        .filter(
          (n) =>
            n.type === 'BitmapText' &&
            n.y > 180 &&
            n.y < 950 &&
            n.getBounds().right > s.scale.width - 48
        )
        .map((n) => n.text),
    };
  });
  assert.ok(help.images >= 5);
  assert.deepEqual(help.overflow, []);
  await page.screenshot({ path: '/tmp/freekick-help-polished.png' });
  await page.evaluate(() => {
    const g = window.__game,
      s = g.scene.getScene('FreeKick');
    s.setOverlay(null);
    g.scene.pause('FreeKick');
    s.resultFx.show(false, 'WIDE', 0xffa300, 'CHALLENGE FAILED');
    s.resultFx.update(0.5, 2, s.scale.width, s.scale.height, true);
  });
  await page.waitForTimeout(100);
  const fx = await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    return {
      y: s.resultFx.title.y,
      h: s.scale.height,
      box: s.resultFx.back.commandBuffer.length,
    };
  });
  assert.ok(fx.y < fx.h * 0.4);
  assert.equal(fx.box, 0);
  await page.screenshot({ path: '/tmp/freekick-wide-polished.png' });
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('FreeKick');
    s.records.start();
    s.lives = 0;
    s.shots = 3;
    s.gameOver();
  });
  await page.locator('.fk-results-screen').waitFor();
  assert.equal(await page.locator('.results-stats > div').count(), 6);
  assert.equal(
    await page
      .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
      .isVisible(),
    true
  );
  await page.getByRole('link', { name: 'PRACTICE', exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__expandedEntry),
    'freekick-practice'
  );
  await page.getByRole('link', { name: 'PLAYGROUND', exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__expandedEntry),
    'freekick-playground'
  );
  await page
    .getByRole('button', { name: 'HIGHEST SCORE', exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector('.results-board ol')?.textContent.includes('alice')
  );
  await page
    .getByRole('button', { name: 'FASTEST GOALS', exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector('.results-board ol')
      ?.textContent.includes('125 km/h')
  );
  assert.equal(saves.length, 1);
  assert.equal(saves[0].mode, 'challenge');
  assert.equal(saves[0].result.mode, 'challenge');

  for (const [width, height] of [
    [320, 480],
    [390, 600],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const buttons = await page
      .locator('.results-actions .casual-button:visible')
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().toJSON())
      );
    assert.equal(buttons.length, 5);
    assert.equal(buttons[1].top, buttons[2].top);
    assert.equal(buttons[3].top, buttons[4].top);
    if (width < height) {
      assert.ok(buttons[0].width > buttons[1].width);
      assert.ok(
        buttons[0].top < buttons[1].top && buttons[1].top < buttons[3].top
      );
    } else {
      assert.ok(buttons.every((button) => button.top === buttons[0].top));
    }
    assert.equal(
      await page
        .locator('.results-panel')
        .evaluate((e) => e.scrollWidth > e.clientWidth),
      false
    );
    assert.equal(
      await page.locator('.results-panel').evaluate((panel) => {
        const box = panel.getBoundingClientRect();
        const screen = panel.parentElement.getBoundingClientRect();
        return box.top >= screen.top && box.bottom <= screen.bottom;
      }),
      true
    );
    if (width === 390)
      await page.screenshot({
        path: join(tmpdir(), 'freekick-results-polished.png'),
      });
  }
  assert.deepEqual(errors, []);
  console.log(
    'Free Kick UI passed: HUD help illustrations, wrapped descriptions, raised unboxed feedback, six aligned stat tiles and aligned actions with the full card visible at three sizes.'
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
