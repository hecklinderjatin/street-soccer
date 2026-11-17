// Production loading regression across the shared match loader and Free Kick entries.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});
const config = {
  difficulty: 'normal',
  durationSec: 120,
  startGoalsAgainst: 0,
  locked: false,
  home: { name: 'YOU', jersey: 'pink', formation: '2-1-1' },
  away: { name: 'OPP', jersey: 'blue', formation: '2-1-1' },
};
try {
  for (const mode of [
    'classic',
    'custom',
    'comeback',
    'hold-lead',
    'survival',
    'chaos',
    'casual',
    'challenge',
    'infinity',
    'practice',
    'playground',
  ]) {
    if (process.argv.length > 2 && !process.argv.slice(2).includes(mode))
      continue;
    const fk = ['challenge', 'infinity', 'practice', 'playground'].includes(
      mode
    );
    for (const scenario of [
      'normal',
      'failed',
      ...(mode === 'classic' ? ['stalled'] : []),
    ]) {
      const failed = scenario !== 'normal';
      const page = await browser.newPage({
        viewport: { width: 390, height: 600 },
      });
      const errors = [],
        art = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const daily = ['comeback', 'hold-lead', 'survival', 'chaos'].includes(
        mode
      );
      const entry = fk
        ? `freekick-${mode}`
        : ['casual', 'custom'].includes(mode)
          ? 'casual'
          : 'index';
      await page.addInitScript(
        ({ mode, fk, daily, config }) => {
          window.devvit = {
            context: {
              postId: 't3_loading',
              postData: {
                matchType: fk ? 'freekick' : daily ? 'daily' : 'classic',
                match: {
                  ...config,
                  ...(daily
                    ? {
                        dailyMode: mode,
                        startGoalsAgainst: mode === 'comeback' ? 1 : 0,
                        startGoalsFor: mode === 'hold-lead' ? 1 : 0,
                        difficulty: mode === 'survival' ? 'noob' : 'normal',
                        ...(mode === 'chaos'
                          ? { chaosEffect: 'slippery', chaosStrength: 100 }
                          : {}),
                      }
                    : {}),
                },
                freeKick: {
                  mode: mode === 'infinity' ? 'infinity' : 'challenge',
                  ...{
                    kicker: 'pink',
                    wall: 'blue',
                    lives: 3,
                    goals: 5,
                    distanceM: 25,
                    wallGapM: 9,
                    difficulty: 'normal',
                  },
                },
              },
            },
          };
          localStorage.setItem('street-soccer-muted', 'true');
        },
        { mode, fk, daily, config }
      );
      let broken = failed,
        attempts = 0;
      await page.route('http://localhost/**', (route) => {
        const { pathname } = new URL(route.request().url());
        if (pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
        if (pathname.startsWith('/art/')) art.push(pathname);
        // Alternate between first-stage player art and second-stage ball art.
        const target = fk
          ? '/art/player-pink-preview.webp'
          : mode === 'classic'
            ? '/art/ball-shot-authored.webp'
            : '/art/player-pink.webp';
        if (pathname === target) {
          attempts++;
          if (broken && scenario === 'stalled') return;
          if (broken) return route.abort();
        }
        return route.fulfill({ path: resolve('dist/client', '.' + pathname) });
      });
      const start = async () => {
        if (mode === 'practice')
          await page
            .getByRole('button', { name: 'START PRACTICE', exact: true })
            .click();
        if (mode === 'casual' || mode === 'custom')
          await page
            .getByRole('button', { name: 'START MATCH', exact: true })
            .click();
      };
      await page.goto(`http://localhost/${entry}.html?debug`);
      await start();
      if (failed) {
        await page
          .getByRole('heading', { name: 'Couldn’t load the game' })
          .waitFor({ timeout: 28000 });
        const atFailure = attempts;
        await page.waitForTimeout(300);
        assert.equal(attempts, atFailure, `${mode} repeated failed downloads`);
        broken = false;
        await page.getByRole('button', { name: 'Retry' }).click();
        await start();
      }
      await page.waitForFunction(
        (fk) =>
          fk
            ? window.__game?.scene.getScene('FreeKick')?.stage
            : window.__game?.scene.getScene('Match')?.ready,
        fk
      );
      if (daily)
        assert.equal(
          await page.evaluate(
            () => window.__game.scene.getScene('Match').config.dailyMode
          ),
          mode
        );
      if (fk) {
        assert.equal(
          await page.evaluate(() => {
            const scene = window.__game.scene.getScene('FreeKick');
            const frames = [
              'freekick1',
              'freekick7',
              'freekick12',
              'wall4',
              'hurt4',
              'keeper_idle3',
              'dive6',
              'jump4',
              'block1',
            ];
            return [
              'player-pink',
              'player-blue',
              'player-awayKeeper',
              'player-skin',
              'player-hair',
            ].every((key) =>
              frames.every((name) => scene.textures.get(key).has(name))
            );
          }),
          true,
          'all gameplay poses available in compact atlases'
        );
        assert.ok(art.includes('/art/player-pink-preview.webp'));
        assert.ok(!art.includes('/art/player-pink.webp'));
        const sizes = await Promise.all(
          art
            .filter((path) => path.endsWith('-preview.webp'))
            .map(async (path) => ({
              compact: (await stat(resolve('dist/client', '.' + path))).size,
              full: (
                await stat(
                  resolve('dist/client', '.' + path.replace('-preview', ''))
                )
              ).size,
            }))
        );
        assert.ok(
          sizes.reduce((n, s) => n + s.compact, 0) <
            sizes.reduce((n, s) => n + s.full, 0) * 0.3
        );
      }
      assert.deepEqual(errors, [], `${mode} browser errors`);
      console.log(
        `${mode}: ${failed ? `${scenario} art, bounded attempts, Retry` : 'normal startup'} passed`
      );
      await page.close();
    }
  }
} finally {
  await browser.close();
}
