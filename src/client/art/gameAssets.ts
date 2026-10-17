import Phaser from 'phaser';
import {
  AUTHORED_BALL_TEXTURE,
  AUTHORED_SHOT_BALL_TEXTURE,
  type Asset,
} from './assetList';
import { BALL_KEY, createBallTexture } from './ballArt';
import { createCourtTextures } from './pitchArt';
import { registerPlayerAtlases } from './playerArt';
import { createSceneryTextures } from './sceneryArt';

// Everything a match needs that is downloaded or painted once per game.
// Boot fetches it in the background while the menu is up and then prepares
// it, so PLAY only has to place the players; the match does whatever is
// still missing if PLAY comes first.

// The file lists live in assetList.ts (no Phaser: the early-download
// script uses them too).
export { REST_ASSETS, firstAssets, matchAssets, type Asset } from './assetList';

// The ball's source sheets are not needed once the ball atlas is built.
function missing(scene: Phaser.Scene, asset: Asset) {
  if (scene.textures.exists(asset.key)) return false;
  return !(
    (asset.key === AUTHORED_BALL_TEXTURE ||
      asset.key === AUTHORED_SHOT_BALL_TEXTURE) &&
    scene.textures.exists(BALL_KEY)
  );
}

// Queues the missing ones on `scene`'s loader (the caller starts it);
// returns how many were queued.
export function queueAssets(scene: Phaser.Scene, assets: readonly Asset[]) {
  let queued = 0;
  for (const asset of assets) {
    if (!missing(scene, asset)) continue;
    scene.load.image(asset.key, asset.url);
    queued++;
  }
  return queued;
}

// How many of `assets` are in (for a progress readout).
export function assetsLoaded(scene: Phaser.Scene, assets: readonly Asset[]) {
  return assets.filter((asset) => !missing(scene, asset)).length;
}

// One-time preparation, one step per frame so the menu / loading screen
// stays responsive. Each step does nothing if already done. Painting needs
// no downloads, so it runs while the art is still coming in; the rest needs
// the downloaded art.
type Step = readonly [string, (scene: Phaser.Scene) => void];
export const PAINT_STEPS: readonly Step[] = [
  ['court', createCourtTextures],
  ['scenery', createSceneryTextures],
];
export const PREPARE_STEPS: readonly Step[] = [
  ['player frames', registerPlayerAtlases],
  ['ball', createBallTexture],
];
