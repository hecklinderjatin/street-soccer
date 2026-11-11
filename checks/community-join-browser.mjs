// Source-only results action checks, mocked consent/API, no application build.
import { chromium } from 'playwright';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const compile = (file) => {
  const ast = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const plain = ts.factory.updateSourceFile(
    ast,
    ast.statements.filter((n) => !ts.isImportDeclaration(n))
  );
  return ts.transpileModule(ts.createPrinter().printFile(plain), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('http://preview.local/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<body></body>' })
  );
  await page.goto('http://preview.local');
  await page.addStyleTag({
    content:
      readFileSync('src/client/style.css', 'utf8').replace(
        /^@import.*$/gm,
        ''
      ) +
      '\n' +
      readFileSync('src/client/ui/communityJoin.css', 'utf8'),
  });
  await page.evaluate(() => {
    window.context = {
      postId: 't3_p',
      userId: 't2_u',
      subredditId: 't5_s',
      subredditName: 'street_soccer_dev',
    };
    window.allowed = true;
    window.ok = true;
    window.writes = 0;
    window.played = 0;
    window.canRunAsUser = async (e) => {
      if (!e.isTrusted) throw Error('Untrusted');
      if (window.deferConsent)
        return new Promise((resolve) => (window.resolveConsent = resolve));
      return window.allowed;
    };
    window.fetch = async () => {
      window.writes++;
      return {
        ok: window.ok,
        status: window.ok ? 200 : 503,
        json: async () =>
          window.ok
            ? { joined: true }
            : {
                error: 'SDK permission error: internal details',
                reference: 'test-ref',
              },
      };
    };
  });
  for (const [file, name] of [
    ['src/client/ui/glyphs.ts', 'GLYPHS'],
    ['src/client/ui/pixelLabel.ts', 'pixelLabel'],
    ['src/client/ui/casualScreen.ts', 'casualButton'],
    ['src/client/ui/communityJoin.ts', 'communityJoin'],
  ])
    await page.addScriptTag({
      content:
        '{const exports={};' +
        compile(file) +
        `;window.${name}=exports.${name};}`,
    });
  const open = async (portrait) =>
    page.evaluate((p) => {
      window.community?.destroy();
      document.body.innerHTML =
        '<section id="results" class="casual-screen results-screen"><div class="results-panel"><h1>RUN COMPLETE</h1><section class="results-board">7-DAY LEADERBOARDS</section><div class="results-actions"><button class="casual-button">PLAY AGAIN</button><button class="casual-button secondary">POST MY SCORE</button><button class="casual-button secondary">PLAY CUSTOM</button></div></div></section>';
      document.querySelector('.results-actions button').onclick = () =>
        window.played++;
      document.querySelector('.results-actions button').focus();
      window.community = window.communityJoin(
        document.querySelector('#results')
      );
    }, portrait);
  for (const [width, height, portrait] of [
    [320, 480, true],
    [390, 600, true],
    [844, 390, false],
    [1280, 720, false],
  ]) {
    await page.setViewportSize({ width, height });
    await open(portrait);
    assert.equal(
      await page.locator('[role=dialog],.community-prompt').count(),
      0
    );
    assert.equal(
      await page
        .locator('#results')
        .evaluate((e) => e.inert || e.style.visibility === 'hidden'),
      false
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      'PLAY AGAIN'
    );
    assert.equal(await page.evaluate(() => window.writes), 0);
    assert.equal(
      await page
        .locator('.results-panel')
        .evaluate((e) =>
          e
            .querySelector('.results-actions')
            .lastElementChild.classList.contains('community-join-button')
        ),
      true
    );
    assert.equal(
      await page
        .locator('.results-panel')
        .evaluate((e) => e.scrollWidth > e.clientWidth),
      false
    );
    await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
    const actions = await page.locator('.results-actions > button').evaluateAll(
      (buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON())
    );
    assert.ok(actions.every((button) => button.width === actions[0].width));
    assert.equal(actions[3].top, actions[portrait ? 2 : 0].top);
    assert.ok(actions.every((button) => button.top >= 0 && button.bottom <= height));
    if (width === 390 || width === 844)
      await page.screenshot({
        path: portrait
          ? join(tmpdir(), 'community-inline-portrait.png')
          : join(tmpdir(), 'community-inline-landscape.png'),
      });
  }
  assert.equal(await page.evaluate(() => window.played), 4);
  await page.evaluate(() => (window.allowed = false));
  await page
    .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[role=status]').textContent ===
      'Couldn’t join right now. You can join from the community page.'
  );
  assert.equal(await page.evaluate(() => window.writes), 0);
  await page.evaluate(() => {
    window.allowed = true;
    window.ok = false;
  });
  await page
    .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[role=status]').textContent ===
      'Couldn’t join right now. You can join from the community page.'
  );
  assert.equal(
    await page.getByRole('button', { name: 'RETRY JOIN', exact: true }).count(),
    0
  );
  await page.evaluate(() => {
    window.ok = true;
    window.deferConsent = true;
  });
  await page
    .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
    .click();
  await page.getByRole('button', { name: 'PLAY AGAIN', exact: true }).click();
  assert.equal(await page.evaluate(() => window.played), 5);
  assert.equal(await page.evaluate(() => window.writes), 1);
  await page.evaluate(() => window.resolveConsent(true));
  await page.waitForFunction(() =>
    document
      .querySelector('.community-join-status.is-success')
      ?.textContent.includes('Thanks')
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
      .isVisible(),
    false
  );
  assert.equal(await page.evaluate(() => window.writes), 2);
  await open(true);
  assert.equal(await page.locator('.community-join-button').count(), 0);
  await page.evaluate(() => (window.context.userId = 't2_other'));
  await open(true);
  assert.equal(await page.locator('.community-join-button').count(), 1);
  await page
    .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
    .click();
  await page.evaluate(() => {
    window.community.destroy();
    window.resolveConsent(true);
  });
  await page.waitForTimeout(20);
  assert.equal(await page.evaluate(() => window.writes), 2);
  assert.equal(await page.locator('.community-join-button').count(), 0);
  await page.evaluate(() =>
    localStorage.setItem(
      'street-soccer:joined:t2_other:t5_s:self-confirmed',
      'yes'
    )
  );
  await open(true);
  assert.equal(
    await page.locator('.community-join-button').count(),
    1,
    'old popup preference must not hide the result button'
  );
  assert.deepEqual(errors, []);
  console.log(
    'Inline results Join passed: immediate usable results, no popup/focus trap, placement, responsive layout, consent/error/success, no retry, suppression and cleanup.'
  );
} finally {
  await browser.close();
}
