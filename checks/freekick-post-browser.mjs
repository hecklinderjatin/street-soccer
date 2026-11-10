// Source-only DOM checks: no application build, Phaser renderer or live Reddit calls.
import { chromium } from 'playwright';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const compile = (file, practice = false) => {
  const ast = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  let plain = ts.factory.updateSourceFile(
    ast,
    ast.statements.filter((n) => !ts.isImportDeclaration(n))
  );
  if (practice) {
    const transformed = ts.transform(plain, [
      (context) => (root) => {
        const visit = (node) =>
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? ts.factory.createCallExpression(
                ts.factory.createIdentifier('loadPracticeGame'),
                undefined,
                []
              )
            : ts.visitEachChild(node, visit, context);
        return ts.visitNode(root, visit);
      },
    ]);
    plain = transformed.transformed[0];
  }
  return ts.transpileModule(ts.createPrinter().printFile(plain), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [width, height] of [
    [320, 400],
    [320, 480],
    [390, 600],
    [720, 1100],
  ]) {
    await page.setViewportSize({ width, height });
    await page.setContent('<div id="game"></div>');
    await page.addStyleTag({
      content:
        readFileSync('src/client/style.css', 'utf8') +
        '\n' +
        readFileSync('src/client/freekick/lobby.css', 'utf8') +
        '\n' +
        readFileSync('src/client/freekick/records.css', 'utf8'),
    });
    await page.evaluate(() => {
      window.calls = [];
      window.context = {
        postId: 't3_free',
        postData: {
          description:
            '<img onerror="bad()"> Standalone free kick practice and play.',
        },
      };
      window.FK = { lives: 3, goalsPerLevel: 2 };
      window.freeKickChallenge = () => ({
        kicker: 'pink',
        wall: 'blue',
        lives: 3,
        goals: 5,
        distanceM: 25,
        wallFromGoalM: 14,
        difficulty: 'normal',
      });
      window.DIFFICULTY_LABEL = { normal: 'NORMAL' };
      window.measurePlay = () => {};
      window.fetch = async () => ({
        ok: true,
        json: async () => ({
          day: '2026-11-08',
          score: {
            top: [{ rank: 1, username: 'alice', value: 500 }],
            me: null,
          },
          speed: { top: [{ rank: 1, username: 'bob', value: 120 }], me: null },
        }),
      });
      window.watchFreeKickPreview = () => () => {};
      window.requestExpandedMode = (_event, entry) => window.calls.push(entry);
    });
    await page.addScriptTag({
      content:
        '{const exports={};' +
        compile('src/client/ui/glyphs.ts') +
        ';window.GLYPHS=exports.GLYPHS;}',
    });
    await page.addScriptTag({
      content:
        '{const exports={};' +
        compile('src/client/ui/pixelLabel.ts') +
        ';window.pixelLabel=exports.pixelLabel;}',
    });
    await page.addScriptTag({
      content:
        '{const exports={};' +
        compile('src/client/freekick/leaderboard.ts') +
        ';window.freeKickFeedBoard=exports.freeKickFeedBoard;}',
    });
    await page.addScriptTag({
      content:
        '{const exports={};' +
        compile('src/client/freekick/lobby.ts') +
        ';exports.showFreeKickLobby();}',
    });
    for (const selector of ['.freekick-challenge', '.freekick-practice']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(
        box && box.x >= 0 && box.y >= 0 && box.y + box.height <= height,
        `${selector} fits ${width}x${height}`
      );
    }
    assert.equal(await page.locator('img[onerror]').count(), 0);
    // The card has no leaderboard since Play left it (2026-11-11).
    assert.equal(await page.locator('.mobile-board-modal').count(), 0);
    await page.locator('.freekick-challenge').click();
    await page.locator('.freekick-practice').click();
    assert.deepEqual(await page.evaluate(() => window.calls), [
      'freekick-challenge',
      'freekick-practice',
    ]);
    console.log(
      `Free Kick card ${width}x${height}: visible actions, safe description, correct expanded routes`
    );
  }
  await page.setViewportSize({ width: 390, height: 600 });
  await page.setContent(
    '<div id="freekick"></div><div id="boot-loading"></div>'
  );
  await page.addStyleTag({
    content: readFileSync('src/client/freekick.css', 'utf8'),
  });
  await page.evaluate(() => {
    window.FK = { maxLevel: 8 };
    window.startEarlyDownloads = () => {};
    window.practiceStarts = [];
    window.loadPracticeGame = async () => ({
      createFreeKickGame: (...args) => window.practiceStarts.push(args),
    });
  });
  await page.addScriptTag({
    content:
      '{const exports={};' +
      compile('src/client/freekick-practice.ts', true) +
      '}',
  });
  await page.locator('#practice-level').selectOption('3');
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.practiceStarts.length === 1);
  assert.deepEqual(await page.evaluate(() => window.practiceStarts), [
    [true, 3],
  ]);
  assert.equal(await page.locator('.freekick-practice-setup').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'Practice setup: chosen level reaches practice game, no page errors'
  );
} finally {
  await browser.close();
}
