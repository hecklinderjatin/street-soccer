import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  KIT_NAMES,
  PLAYER_HAIR_TEXTURE,
  PLAYER_SKIN_TEXTURE,
  SOURCE_SHEETS,
  bakeLookLayers,
  bakePlayerAtlas,
  playerTexture,
  type Pixels,
} from '../src/client/art/playerSheets';
import { readPng, writePng } from './png';

// Bakes the player atlases the game loads: the big editable sheets in
// public/art become one small atlas per kit plus the grey skin / hair look
// layers, as PNGs in art-baked/. scripts/optimize_art.py then writes the
// WebP files the game ships (public-release/art). `npm run art:release`
// runs both; do it after changing any player sheet or the kit / recolour
// tables in playerSheets.ts, and commit public-release with the change.

const root = process.cwd();
const source = resolve(root, 'public/art');
const target = resolve(root, 'art-baked');

mkdirSync(target, { recursive: true });
// Drop atlases of kits that no longer exist (optimize_art ships every one).
for (const file of readdirSync(target))
  if (file.startsWith('player-')) rmSync(resolve(target, file));
const started = Date.now();
const sheets = SOURCE_SHEETS.map((sheet) =>
  readPng(resolve(source, `${sheet.file}.png`))
);
const save = (key: string, pixels: Pixels) => {
  const path = resolve(target, `${key}.png`);
  writePng(path, pixels);
  console.log(`${key}.png ${(statSync(path).size / 1024).toFixed(0)} KiB`);
};
for (const kit of KIT_NAMES) {
  const atlas = bakePlayerAtlas(kit, sheets);
  save(playerTexture(kit), atlas);
  if (kit === 'pink') {
    // The looks cover every pose, keepers' included.
    const { skin, hair } = bakeLookLayers(bakePlayerAtlas(kit, sheets, true));
    save(PLAYER_SKIN_TEXTURE, skin);
    save(PLAYER_HAIR_TEXTURE, hair);
  }
}
console.log(
  `baked ${KIT_NAMES.length + 2} atlases in ${((Date.now() - started) / 1000).toFixed(1)} s`
);
