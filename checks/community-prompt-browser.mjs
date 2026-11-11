// Real DOM popup with mocked Reddit consent/API. No application build or Reddit writes.
import { chromium } from 'playwright';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
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
  await page.route('http://preview.local/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<body></body>' })
  );
  await page.goto('http://preview.local');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addStyleTag({
    content:
      readFileSync('src/client/style.css', 'utf8').replace(
        /^@import.*$/gm,
        ''
      ) +
      '\n' +
      readFileSync('src/client/ui/communityPrompt.css', 'utf8'),
  });
  await page.evaluate(() => {
    window.context = {
      postId: 't3_p',
      userId: 't2_u',
      subredditId: 't5_s',
      subredditName: 'street_soccer_dev',
    };
    window.writes = 0;
    window.allowed = true;
    window.ok = true;
    window.canRunAsUser = async (e) => {
      if (!e.isTrusted) throw Error('Untrusted');
      if (window.deferConsent)
        return new Promise((resolve) => {
          window.resolveConsent = resolve;
        });
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
                error: 'Could not join. Please retry.',
                code: 'REDDIT_JOIN_FAILED',
                reference: 'test-ref',
              },
      };
    };
  });
  for (const [file, name] of [
    ['src/client/ui/glyphs.ts', 'GLYPHS'],
    ['src/client/ui/pixelLabel.ts', 'pixelLabel'],
    ['src/client/ui/casualScreen.ts', 'casualButton'],
    ['src/client/ui/communityPrompt.ts', 'communityPrompt'],
  ])
    await page.addScriptTag({
      content:
        '{const exports={};' +
        compile(file) +
        `;window.${name}=exports.${name};}`,
    });
  const open = async (portrait) =>
    page.evaluate((p) => {
      document.body.innerHTML =
        '<section id="results"><button>RESULTS</button></section>';
      window.prompt = window.communityPrompt(
        document.querySelector('#results'),
        p
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
      await page
        .locator('#results')
        .evaluate((e) => e.inert && e.style.visibility === 'hidden'),
      true
    );
    assert.match(
      await page.locator('.community-permission-note').textContent(),
      /Reddit will ask for permission/
    );
    assert.equal(await page.evaluate(() => window.writes), 0);
    await page
      .getByRole('button', { name: 'CONTINUE TO RESULTS', exact: true })
      .scrollIntoViewIfNeeded();
    const bounds = await page
      .getByRole('button', { name: 'CONTINUE TO RESULTS', exact: true })
      .boundingBox();
    assert.ok(
      bounds.x >= 0 && bounds.y >= 0 && bounds.y + bounds.height <= height
    );
    const cols = await page
      .locator('.community-prompt-actions')
      .evaluate(
        (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length
      );
    assert.equal(cols, portrait ? 1 : 2);
    if (width === 390 || width === 844) await page.waitForTimeout(220);
    await page.screenshot({
      path: portrait
        ? '/tmp/community-portrait.png'
        : '/tmp/community-landscape.png',
    });
    await page
      .getByRole('button', { name: 'CONTINUE TO RESULTS', exact: true })
      .click();
    assert.equal(await page.locator('.community-prompt').count(), 0);
    assert.equal(
      await page.locator('#results').evaluate((e) => e.inert),
      false
    );
  }
  await open(true);
  await page.evaluate(() => (window.allowed = false));
  await page
    .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector('[role=status]').textContent.includes('not approved')
  );
  assert.equal(await page.evaluate(() => window.writes), 0);
  assert.equal(await page.locator('.community-prompt').count(), 0);
  assert.equal(
    await page.locator('.community-result-note.is-success').count(),
    0
  );
  await open(true);
  await page.evaluate(() => {
    window.allowed = true;
    window.ok = false;
  });
  await page
    .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector('[role=status]')
      .textContent.includes('Could not join')
  );
  assert.equal(await page.locator('.community-prompt').count(), 0);
  assert.equal(
    await page.locator('.community-result-note.is-success').count(),
    0
  );
  assert.match(
    await page.locator('.community-result-note').textContent(),
    /test-ref/
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'RETRY JOIN', exact: true })
      .isVisible(),
    true
  );
  await page.evaluate(() => {
    window.ok = true;
    window.deferConsent = true;
  });
  await page.getByRole('button', { name: 'RETRY JOIN', exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('.community-prompt')
  );
  assert.equal(await page.locator('#results').evaluate((e) => e.inert), false);
  assert.match(
    await page.locator('.community-result-note').textContent(),
    /Waiting/
  );
  assert.equal(await page.evaluate(() => window.writes), 1);
  await page.evaluate(() => window.resolveConsent(true));
  await page.waitForFunction(() =>
    document
      .querySelector('.community-result-note.is-success')
      ?.textContent.includes('Thanks for joining')
  );
  assert.equal(await page.evaluate(() => window.writes), 2);
  await open(true);
  assert.equal(await page.locator('.community-prompt').count(), 0);
  await page.evaluate(() => (window.context.userId = 't2_other'));
  await open(false);
  assert.equal(await page.locator('.community-prompt').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.community-prompt').count(), 0);
  await open(true);
  await page.evaluate(() => window.prompt.destroy());
  assert.equal(await page.locator('#results').evaluate((e) => e.inert), false);
  await open(true);
  await page
    .getByRole('button', { name: 'JOIN COMMUNITY', exact: true })
    .click();
  await page.evaluate(() => {
    window.prompt.destroy();
    window.resolveConsent(true);
  });
  await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.writes), 2);
  assert.equal(await page.locator('.community-result-note').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'Community popup passed: portrait/landscape fit, results gating, optional continue, trusted consent, denial/error/retry, successful-join suppression, account isolation and cleanup.'
  );
} finally {
  await browser.close();
}
