// Local Phaser integration with mocked Reddit APIs; no posts or scores leave
// the browser. Run against npm run serve after npm run build.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const snap = (page) =>
  page.evaluate(() => {
    const s = window.__game.scene.getScene('Match'),
      r = s.rules;
    const goals = s.court.goals.map((g) => ({
      top: g.top,
      bottom: g.bottom,
      height: g.pitch.goalHeight,
    }));
    const z = s.court.planes
      .filter((p) => p.mesh.texture.key === 'court-endwall')
      .flatMap((p) => Array.from(p.world).filter((_, i) => i % 3 === 2));
    return {
      config: s.config,
      rules: r,
      goals,
      wall: Math.max(...z),
      mission: s.hudState.mission,
      allSame: s.everyone.every((p) => p.rules === r) && s.ball.rules === r,
      rain: s.weather.graphics?.commandBuffer.length ?? 0,
    };
  });
const briefing = async (page) => {
  await page.waitForFunction(
    () =>
      window.__game?.scene.getScene('Match')?.ready &&
      window.__game.scene.isActive('Hud'),
    null,
    { timeout: 60000 }
  );
  if (
    await page.evaluate(
      () => window.__game.scene.getScene('Hud').detailsLayer.visible
    )
  ) {
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => !window.__game.scene.isPaused('Match'));
};
try {
  for (const [effect, strength] of [
    ['power', 100],
    ['power', 50],
    ['power', 150],
    ['slippery', 150],
    ['goals', 50],
    ['goals', 150],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 600 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      ({ effect, strength }) => {
        window.devvit = {
          context: {
            postId: 't3_chaos',
            subredditName: 'test',
            username: 'tester',
            postData: {
              matchType: 'daily',
              match: {
                dailyMode: 'chaos',
                chaosEffect: effect,
                chaosStrength: strength,
                difficulty: 'normal',
                durationSec: 30,
                startGoalsAgainst: 1,
                locked: true,
                home: { name: 'YOU', jersey: 'red', formation: '1-2-1' },
                away: { name: 'CPU', jersey: 'blue', formation: '2-2' },
              },
            },
          },
          entrypoints: {
            game: `${location.origin}/index.html`,
            casual: `${location.origin}/casual.html`,
          },
          webViewMode: 2,
        };
      },
      { effect, strength }
    );
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith('/api/journeys/'))
        return route.fulfill({ status: 204 });
      if (path.startsWith('/api/games'))
        return route.fulfill({ json: { registered: true, gamesPlayed: 12 } });
      return route.fulfill({ json: { day: '2026-10-31', top: [], me: null } });
    });
    await page.goto(new URL('splash.html?debug', base).href);
    await page.locator('.mobile-play').waitFor();
    assert.equal(
      await page.locator('.mobile-match-tag').textContent(),
      'CHAOS'
    );
    assert.ok(
      (await page.locator('.mobile-challenge').textContent()).includes(
        `${strength}%`
      )
    );
    await page.waitForFunction(
      () => window.__game?.scene.getScene('Match')?.ready,
      null,
      { timeout: 60000 }
    );
    const preview = await snap(page);
    if (effect === 'goals') {
      assert.ok(Math.abs(preview.wall - (138.6 * strength) / 100) < 0.001);
      assert.ok(
        Math.abs(
          preview.goals[0].bottom -
            preview.goals[0].top -
            (300.3 * strength) / 100
        ) < 0.001
      );
    }
    if (process.env.CHAOS_SCREENSHOTS) {
      await mkdir(process.env.CHAOS_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: `${process.env.CHAOS_SCREENSHOTS}/${effect}-${strength}-preview.png`,
      });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(new URL('index.html?debug', base).href);
    await briefing(page);
    const initial = await snap(page);
    assert.equal(initial.allSame, true);
    assert.equal(initial.rules.strength, strength);
    assert.ok(initial.mission.includes(`${strength}%`));
    assert.equal(initial.config.startGoalsAgainst, 1);
    assert.equal(initial.rules.power, effect === 'power' ? strength / 100 : 1);
    assert.equal(
      initial.rules.movement,
      effect === 'slippery' ? strength / 100 : 1
    );
    assert.equal(
      initial.rules.tackle,
      effect === 'slippery' ? strength / 100 : 1
    );
    if (effect === 'slippery') {
      assert.ok(initial.rain > 0);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(
        () => window.__game.scene.getScene('Match').weather.reduced.matches
      );
      await page.waitForFunction(
        () =>
          window.__game.scene.getScene('Match').weather.graphics.commandBuffer
            .length < 10
      );
      assert.ok((await snap(page)).rain < 10);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 390, height: 600 });
      await page.waitForFunction(() => {
        const w = window.__game.scene.getScene('Match').weather;
        return (
          !w.reduced.matches &&
          w.graphics.commandBuffer.length > 0 &&
          w.graphics.commandBuffer.length < 200
        );
      });
      assert.ok(
        (await snap(page)).rain < initial.rain,
        'mobile rain uses a smaller draw budget'
      );
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    // A real keyboard shot exercises the human action path and launch metrics.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      s.flow.phase = 'live';
      s.flow.awaitingKickoff = false;
      s.flow.clockRunning = true;
      for (const p of s.everyone) {
        p.x = 300;
        p.y = 300;
        p.lockUntil = 99999;
      }
      const p = s.home.find((p) => p.role === 'outfield');
      p.x = 1800;
      p.y = 715;
      p.heading = 0;
      p.speed = 0;
      p.vx = p.vy = 0;
      p.lockUntil = 0;
      s.setControlled(p);
      s.ball.placeAt(1820, 715);
      s.ball.owner = p;
      s.ball.lastTouch = p;
      p.dribbleAngle = 0;
      p.dribbleDist = 20;
      s.rig.snapTo(2100, 715);
    });
    await page.keyboard.down('k');
    await page.waitForFunction(
      () => window.__game.scene.getScene('Match').chargeSince !== null
    );
    await page.evaluate(() => {
      window.__game.scene.getScene('Match').chargeSince =
        performance.now() / 1000;
    });
    await page.keyboard.up('k');
    await page.waitForFunction(
      () => window.__game.scene.getScene('Match').ball.goalStrike?.human
    );
    const speed = await page.evaluate(
      () => window.__game.scene.getScene('Match').ball.goalStrike.kmh
    );
    await page.waitForTimeout(150);
    if (process.env.CHAOS_SCREENSHOTS)
      await page.screenshot({
        path: `${process.env.CHAOS_SCREENSHOTS}/${effect}-${strength}-match.png`,
      });
    // Legitimate shot crosses the goal line, preserving its actual launch speed.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      Object.assign(s.ball, {
        x: 2658,
        y: 715,
        z: 20,
        vx: 10,
        vy: 0,
        vz: 0,
        owner: null,
      });
    });
    await page.waitForFunction(
      () => window.__game.scene.getScene('Match').flow.phase === 'goal'
    );
    assert.equal(
      await page.evaluate(
        () => window.__game.scene.getScene('Match').fastestGoalKmh
      ),
      speed
    );
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem('street-soccer:fastest-goal:v1:ranked')
      ),
      null
    );
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      s.flow.score = { home: 2, away: 1 };
      s.flow.elapsedSec = 30;
      s.flow.finished = true;
    });
    await page
      .getByRole('button', { name: 'PLAY AGAIN', exact: true })
      .waitFor();
    assert.ok(
      (await page.locator('.results-chaos-effect').textContent()).includes(
        `${strength}%`
      )
    );
    if (effect === 'slippery') {
      for (const viewport of [
        { width: 320, height: 480 },
        { width: 390, height: 600 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(150);
        const geometry = await page
          .locator('.results-screen')
          .evaluate((root) => ({
            overflow: root.scrollWidth - root.clientWidth,
            scroll: root.scrollHeight - root.clientHeight,
            bottom: root
              .querySelector('.results-actions')
              .getBoundingClientRect().bottom,
            height: innerHeight,
          }));
        assert.ok(
          geometry.overflow <= 1 &&
            geometry.scroll <= 1 &&
            geometry.bottom <= geometry.height,
          JSON.stringify(geometry)
        );
        if (process.env.CHAOS_SCREENSHOTS)
          await page.screenshot({
            path: `${process.env.CHAOS_SCREENSHOTS}/results-${viewport.width}.png`,
          });
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
    await briefing(page);
    assert.deepEqual(
      (await snap(page)).rules,
      initial.rules,
      'rematch restores identical settings'
    );
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Match');
      s.flow.elapsedSec = 30;
      s.flow.finished = true;
    });
    await page
      .getByRole('button', { name: 'PLAY CUSTOM', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .click();
    await briefing(page);
    const casual = await snap(page);
    assert.equal(casual.rules.effect, null);
    assert.equal(casual.rules.power, 1);
    assert.equal(casual.rules.movement, 1);
    assert.equal(casual.rules.pitch.goalMouth, 300.3);
    assert.equal(casual.rules.pitch.endWallHeight, 138.6);
    assert.equal(casual.rain, 0);
    assert.equal(casual.config.chaosEffect, undefined);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `Chaos ${effect} ${strength}%: preview, geometry, actual shot/goal, results, replay, reduced motion and Casual isolation passed`
    );
  }
} finally {
  await browser.close();
}
