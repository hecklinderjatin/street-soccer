// Exercise the real normal-match pause callback without a production build.
import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const file = 'src/client/scenes/HudScene.ts';
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
const code = ts.transpileModule(ts.createPrinter().printFile(plain), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const node = () => ({
  setOrigin() {
    return this;
  },
  setInteractive() {
    return this;
  },
  setDepth() {
    return this;
  },
});
const exports = {};
class Button {
  constructor(_s, x, y, label, click, opts) {
    Object.assign(this, { x, y, label, click, opts });
  }
}
vm.runInNewContext(code, {
  exports,
  Phaser: { Scene: class {} },
  VIEW: { width: 1280, height: 720 },
  PX: 4,
  PAL: { black: 0, green: 1, red: 2, yellow: 3, blue: 4, orange: 5 },
  TextButton: Button,
  pixelText: node,
});
for (const desktop of [false, true])
  for (const mode of [
    'classic',
    'casual',
    'comeback',
    'defend',
    'survival',
    'chaos',
  ]) {
    const scene = new exports.HudScene();
    const config = {
      mode: mode === 'casual' ? 'casual' : 'competitive',
      dailyMode: mode,
      durationSec: 120,
      home: { formation: '2-1-1' },
      away: { formation: '3-1' },
    };
    const calls = [];
    let buttons;
    scene.desktop = desktop;
    scene.hud = { config, onMatchQuit: () => calls.push('abandon') };
    scene.releaseInputs = () => calls.push('release');
    scene.scene = {
      stop: (name) => calls.push(['stop', name]),
      start: (name, data) => calls.push(['start', name, data]),
    };
    scene.add = {
      rectangle: node,
      container: (_x, _y, items) => {
        buttons = items.filter((n) => n instanceof Button);
        return node();
      },
    };
    scene.buildPauseLayer();
    const restart = buttons.find((b) => b.label === 'RESTART');
    assert.ok(restart);
    const ys = buttons.map((b) => b.y).sort((a, b) => a - b);
    assert.ok(ys.every((y, i) => i === 0 || y - ys[i - 1] >= 90));
    restart.click();
    restart.click();
    assert.equal(calls.filter((n) => n === 'release').length, 1);
    assert.equal(calls.filter((n) => n === 'abandon').length, 1);
    const starts = calls.filter((n) => Array.isArray(n) && n[0] === 'start');
    assert.equal(starts.length, 1);
    assert.equal(starts[0][1], 'Match');
    assert.deepEqual(JSON.parse(JSON.stringify(starts[0][2])), {
      ...config,
      rematch: true,
    });
    assert.equal(config.rematch, undefined);
  }
console.log(
  'Normal pause restart passed: touch/desktop spacing, every match mode, same settings, released input and duplicate-click guard.'
);
