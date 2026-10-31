// Run against `npm start`. This mocks Reddit's host context and messages;
// it does not create posts or establish live Reddit integration readiness.
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
const config = {
  difficulty: 'hard',
  durationSec: 120,
  startGoalsAgainst: 2,
  locked: true,
  home: { name: 'RED', jersey: 'red', formation: '3-1' },
  away: { name: 'BLUE', jersey: 'blue', formation: '1-2-1' },
};

async function pageFor(viewport, postData) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const mutations = [];
  const gameRequests = [];
  const completed = new Set();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    // Existing gameplay tests simulate analytics being unavailable. Dedicated
    // Journeys tests cover accepted/denied/outage lifecycle requests.
    if (path.startsWith('/api/journeys/'))
      return route.fulfill({ status: 204 });
    if (path === '/api/speed-leaders')
      return route.fulfill({
        json: {
          day: '2026-10-31',
          top: [
            { rank: 1, username: 'rocket', kmh: 131 },
            { rank: 2, username: 'tester', kmh: 112 },
          ],
          me: { rank: 2, username: 'tester', kmh: 112 },
        },
      });
    if (path.startsWith('/api/games')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        gameRequests.push({ path, id: body.id });
        if (path.endsWith('/complete')) completed.add(body.id);
      }
      return route.fulfill({
        json: { registered: true, gamesPlayed: 127 + completed.size },
      });
    }
    if (request.method() === 'POST') mutations.push(path);
    return route.fulfill({
      json: {
        day: '2026-10-24',
        top: [
          { rank: 1, username: 'street_legend', goalsFor: 4, goalsAgainst: 1 },
          { rank: 2, username: 'backheel_hero', goalsFor: 3, goalsAgainst: 1 },
          {
            rank: 3,
            username: 'a_very_long_reddit_username',
            goalsFor: 2,
            goalsAgainst: 0,
          },
        ],
        me: null,
      },
    });
  });
  if (postData)
    await page.addInitScript((data) => {
      window.devvit = {
        context: {
          postId: 't3_test',
          subredditName: 'test',
          username: 'tester',
          postData: data,
        },
        entrypoints: {
          game: `${location.origin}/index.html`,
          casual: `${location.origin}/casual.html`,
        },
        webViewMode: 2,
      };
      window.hostMessages = [];
      addEventListener('message', (event) => {
        if (event.data?.type === 'devvit-internal')
          window.hostMessages.push(event.data);
      });
    }, postData);
  return { page, context, errors, mutations, gameRequests };
}

async function finishBriefing(page) {
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').detailsLayer.visible
  );
  // Startup Escape advances to controls rather than skipping both pages.
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').helpLayer.visible
  );
  assert.equal(
    await page.evaluate(() => window.__game.scene.isPaused('Match')),
    true
  );
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Hud');
    const back = h.helpLayer.list.find(
      (item) => item.x === 430 && item.y === 660
    );
    back.emit('pointerdown');
    back.emit('pointerup');
  });
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').detailsLayer.visible
  );
  const clock = await page.evaluate(
    () => window.__game.scene.getScene('Match').flow.clock
  );
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Hud');
    const next = h.detailsLayer.list.find(
      (item) => item.x === 640 && item.y === 647
    );
    next.emit('pointerdown');
    next.emit('pointerup');
  });
  await page.waitForFunction(
    () => window.__game.scene.getScene('Hud').helpLayer.visible
  );
  assert.equal(
    await page.evaluate(() => window.__game.scene.isPaused('Match')),
    true
  );
  assert.equal(
    await page.evaluate(() => window.__game.scene.getScene('Match').flow.clock),
    clock
  );
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Hud');
    const play = h.helpLayer.list.find(
      (item) => item.x === 800 && item.y === 660
    );
    play.emit('pointerdown');
    play.emit('pointerup');
  });
  await waitForMatch(page);
}

async function waitForMatch(page, paused = false) {
  await page.waitForFunction(
    () => {
      const game = window.__game;
      return game?.scene.isActive('Hud') && game.scene.getScene('Match')?.ready;
    },
    null,
    { timeout: 60000 }
  );
  await page.waitForFunction(
    (expected) => window.__game.scene.isPaused('Match') === expected,
    paused
  );
}

const capture = async (page) =>
  page.evaluate(() => {
    const s = window.__game.scene.getScene('Match');
    return {
      score: s.flow.score,
      difficulty: s.botDifficulty,
      homeSkill: s.homeBrain.skill.thinkSec,
      awaySkill: s.awayBrain.skill.thinkSec,
      awayPress: s.awayBrain.style.pressGapScale,
      awayPush: s.awayBrain.style.pushAttack.def,
      homeOutlet: s.homeBrain.style.outletForward,
      phase: s.flow.phase,
      golden: s.flow.goldenGoal,
      elapsed: s.flow.elapsedSec,
      mission: s.hudState.mission,
      config: s.config,
    };
  });
const goal = async (page, team, ends = false) => {
  const before = await capture(page);
  await page.evaluate((team) => {
    const s = window.__game.scene.getScene('Match');
    s.flow.phase = 'live';
    s.flow.awaitingKickoff = false;
    s.flow.clockRunning = false;
    s.flow.elapsedSec += 10;
    s.flow.clock = s.config.durationSec - s.flow.elapsedSec;
    s.flow.onGoal(team);
  }, team);
  assert.equal(
    (await capture(page)).difficulty,
    before.difficulty,
    'no tier change inside celebration'
  );
  await page.evaluate(
    () => (window.__game.scene.getScene('Match').flow.phaseTime = 2.79)
  );
  if (ends)
    await page
      .getByRole('button', { name: 'PLAY AGAIN', exact: true })
      .waitFor();
  else
    await page.waitForFunction(
      () => window.__game.scene.getScene('Match').flow.phase === 'kickoff'
    );
};
try {
  for (const mode of ['comeback', 'hold-lead', 'survival']) {
    const match = {
      ...config,
      dailyMode: mode,
      difficulty: mode === 'survival' ? 'noob' : 'hard',
      durationSec: mode === 'survival' ? 300 : 120,
      ...(mode === 'survival' ? { survivalGoals: 7, survivalConceded: 4 } : {}),
      startGoalsFor: mode === 'hold-lead' ? 2 : 0,
      startGoalsAgainst: mode === 'comeback' ? 2 : 0,
    };
    const { page, context, errors, mutations } = await pageFor(
      { width: 390, height: 600 },
      { matchType: 'daily', match }
    );
    const reports = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/result' && r.method() === 'POST')
        reports.push(r.postDataJSON());
    });
    await page.goto(new URL('splash.html?debug', base).href);
    await page.locator('.mobile-play').waitFor();
    const tag = await page.locator('.mobile-match-tag').textContent();
    assert.ok(
      tag.includes(
        mode === 'hold-lead'
          ? 'SHIELD'
          : mode === 'survival'
            ? 'RAMPAGE'
            : mode.toUpperCase()
      )
    );
    assert.equal(
      await page.locator('.mobile-start').textContent(),
      mode === 'survival' ? '7 / 4' : mode === 'hold-lead' ? '2 – 0' : '0 – 2'
    );
    if (mode === 'survival') {
      assert.equal(
        await page.locator('.mobile-difficulty').textContent(),
        'RAMPAGE'
      );
      assert.equal(
        await page.locator('.mobile-difficulty').getAttribute('data-level'),
        'rising'
      );
      assert.ok(
        (
          await page.locator('.mobile-difficulty').getAttribute('aria-label')
        ).includes('goalkeeper')
      );
    }
    const feed = await page
      .locator('#mobile-lobby')
      .evaluate((e) => ({ width: e.clientWidth, scroll: e.scrollWidth }));
    assert.ok(feed.scroll <= feed.width, JSON.stringify(feed));
    if (process.env.CASUAL_SCREENSHOTS)
      await page.screenshot({
        path: `${process.env.CASUAL_SCREENSHOTS}/${mode}-preview.png`,
      });
    for (const viewport of [
      { width: 320, height: 480 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(
        () =>
          document
            .querySelector('#mobile-lobby')
            .classList.contains('is-portrait') ===
          innerHeight > innerWidth
      );
      const geometry = await page.locator('#mobile-lobby').evaluate((e) => ({
        scroll: e.scrollWidth - e.clientWidth,
        play: e.querySelector('.mobile-play').getBoundingClientRect().bottom,
        height: innerHeight,
      }));
      assert.ok(
        geometry.scroll <= 1 && geometry.play <= geometry.height,
        JSON.stringify({ mode, viewport, geometry })
      );
    }
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto(new URL('index.html?debug', base).href);
    await waitForMatch(page, true);
    await finishBriefing(page);
    await waitForMatch(page);
    let state = await capture(page);
    assert.deepEqual(state.score, {
      home: match.startGoalsFor,
      away: match.startGoalsAgainst,
    });
    if (mode === 'comeback') {
      assert.equal(state.awayPush, 65);
      await goal(page, 'home');
      assert.equal((await capture(page)).awayPush, 65);
      await goal(page, 'home');
      assert.equal((await capture(page)).awayPush, 140);
      await goal(page, 'home');
      assert.equal((await capture(page)).awayPush, 330);
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('Match');
        s.flow.score = { home: 2, away: 2 };
        s.flow.phase = 'live';
        s.flow.clockRunning = true;
        s.flow.clock = 0.01;
        s.flow.elapsedSec = 119.99;
      });
      await page
        .getByRole('button', { name: 'PLAY AGAIN', exact: true })
        .waitFor();
      assert.equal(
        await page.locator('.results-hero h1').textContent(),
        'TRY AGAIN'
      );
      assert.equal((await capture(page)).golden, false);
    } else if (mode === 'hold-lead') {
      assert.equal(state.awayPush, 330);
      assert.equal(state.homeOutlet, true);
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('Match');
        s.flow.phase = 'live';
        s.flow.awaitingKickoff = false;
        s.flow.clockRunning = false;
        s.flow.clock = 20;
      });
      await page.waitForFunction(() =>
        window.__game.scene.getScene('Match').pendingTactic.includes('allOut')
      );
      assert.equal(
        (await capture(page)).awayPush,
        330,
        'late pressure waits before changing'
      );
      await page.evaluate(
        () => (window.__game.scene.getScene('Match').simTime += 2.1)
      );
      await page.waitForFunction(
        () =>
          window.__game.scene.getScene('Match').awayBrain.style.pushAttack
            .def === 390
      );
      await goal(page, 'away');
      assert.equal((await capture(page)).awayPush, 330);
      await goal(page, 'away');
      assert.equal((await capture(page)).awayPush, 140);
      await goal(page, 'away');
      assert.equal((await capture(page)).awayPush, 65);
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('Match');
        s.flow.score = { home: 3, away: 2 };
        s.flow.phase = 'live';
        s.flow.clockRunning = true;
        s.flow.clock = 0.01;
        s.flow.elapsedSec = 119.99;
      });
      await page
        .getByRole('button', { name: 'PLAY AGAIN', exact: true })
        .waitFor();
      assert.equal(
        await page.locator('.results-hero h1').textContent(),
        'CLEARED!'
      );
    } else {
      const levels = ['noob', 'easy', 'normal', 'hard', 'pro', 'pro', 'pro'];
      let previous = Infinity;
      const homeSkill = (await capture(page)).homeSkill;
      for (let i = 0; i < 7; i++) {
        state = await capture(page);
        assert.equal(state.difficulty, levels[i]);
        if (i < 5) assert.ok(state.awaySkill < previous);
        else assert.equal(state.awaySkill, previous);
        previous = state.awaySkill;
        assert.equal(state.homeSkill, homeSkill, 'home teammates stay Normal');
        assert.ok(state.mission.includes(`${i}/7 GOALS`));
        await goal(page, 'home', i === 6);
      }
      assert.equal(
        await page.locator('.results-hero h1').textContent(),
        'CLEARED!'
      );
      assert.equal(reports.at(-1).goalsFor, 7);
      assert.ok(
        reports.at(-1).elapsedSec >= 70 && reports.at(-1).elapsedSec <= 75
      );
      assert.equal(reports.at(-1).difficulty, 'noob');
      await page
        .getByRole('button', { name: 'PLAY AGAIN', exact: true })
        .click();
      await waitForMatch(page);
      state = await capture(page);
      assert.equal(state.difficulty, 'noob');
      assert.deepEqual(state.score, { home: 0, away: 0 });
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('Match');
        s.flow.score = { home: 6, away: 3 };
        s.resetForKickoff();
      });
      await goal(page, 'away', true);
      assert.equal(
        await page.locator('.results-hero h1').textContent(),
        'TRY AGAIN'
      );
      assert.equal(reports.at(-1).goalsFor, 6);
      assert.equal(reports.at(-1).goalsAgainst, 4);
      await page
        .getByRole('button', { name: 'PLAY AGAIN', exact: true })
        .click();
      await waitForMatch(page);
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('Match');
        s.flow.score = { home: 6, away: 0 };
        s.flow.phase = 'live';
        s.flow.clockRunning = true;
        s.flow.clock = 0.01;
        s.flow.elapsedSec = 299.99;
      });
      await page
        .getByRole('button', { name: 'PLAY AGAIN', exact: true })
        .waitFor();
      assert.equal(
        await page.locator('.results-hero h1').textContent(),
        'TRY AGAIN'
      );
    }
    assert.ok(reports.length >= 1);
    assert.ok(reports.every((r) => r.mode === 'competitive'));
    if (process.env.CASUAL_SCREENSHOTS)
      await page.screenshot({
        path: `${process.env.CASUAL_SCREENSHOTS}/${mode}-result.png`,
      });
    for (const viewport of [
      { width: 320, height: 480 },
      { width: 844, height: 390 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(
        () =>
          Math.abs(
            document.querySelector('.results-screen').getBoundingClientRect()
              .height - innerHeight
          ) < 1
      );
      const layout = await page.locator('.results-screen').evaluate((e) => ({
        scroll: e.scrollHeight - e.clientHeight,
        bottom: e.querySelector('.results-actions').getBoundingClientRect()
          .bottom,
        height: innerHeight,
      }));
      assert.ok(
        layout.scroll <= 1 && layout.bottom <= layout.height,
        JSON.stringify({ mode, viewport, layout })
      );
    }
    await page
      .getByRole('button', { name: 'PLAY CASUAL', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'START MATCH', exact: true })
      .click();
    await waitForMatch(page, true);
    state = await capture(page);
    assert.equal(state.config.dailyMode, undefined);
    assert.equal(state.mission, '');
    assert.deepEqual(state.score, { home: 0, away: 0 });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `ok Daily ${mode}: preview, starting score, tactics, endings, results, replay, responsive layout and Casual separation`
    );
  }
} catch (error) {
  for (const ctx of browser.contexts())
    for (const page of ctx.pages())
      console.error(
        await page
          .evaluate(() => {
            const s = window.__game?.scene.getScene('Match');
            return {
              phase: s?.flow?.phase,
              score: s?.flow?.score,
              difficulty: s?.botDifficulty,
              elapsed: s?.flow?.elapsedSec,
              mode: s?.config?.dailyMode,
            };
          })
          .catch(() => null)
      );
  throw error;
} finally {
  await browser.close();
}
