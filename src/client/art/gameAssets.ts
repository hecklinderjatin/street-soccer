import Phaser from 'phaser';
import {
  AUTHORED_BALL_TEXTURE,
  AUTHORED_SHOT_BALL_TEXTURE,
  BALL_KEY,
  createBallTexture,
} from './ballArt';
import { createCourtTextures } from './pitchArt';
import { registerPlayerAtlases } from './playerArt';
import {
  PLAYER_HAIR_TEXTURE,
  PLAYER_SKIN_TEXTURE,
  playerTexture,
} from './playerSheets';
import { createSceneryTextures } from './sceneryArt';

// Everything a match needs that is downloaded or painted once per game.
// Boot fetches it in the background while the menu is up and then prepares
// it, so PLAY only has to place the players; the match does whatever is
// still missing if PLAY comes first.

export type Asset = { key: string; url: string };
const atlas = (key: string): Asset => ({ key, url: `/art/${key}.webp` });

// First what every match opens with (the outfield kits and the looks), then
// the keepers and the ball.
export const FIRST_ASSETS: readonly Asset[] = [
  atlas(playerTexture('home')),
  atlas(playerTexture('away')),
  atlas(PLAYER_SKIN_TEXTURE),
  atlas(PLAYER_HAIR_TEXTURE),
];
export const REST_ASSETS: readonly Asset[] = [
  atlas(playerTexture('homeKeeper')),
  atlas(playerTexture('awayKeeper')),
  { key: AUTHORED_BALL_TEXTURE, url: '/art/ball-authored.webp' },
  { key: AUTHORED_SHOT_BALL_TEXTURE, url: '/art/ball-shot-authored.webp' },
];
const ALL_ASSETS = [...FIRST_ASSETS, ...REST_ASSETS];

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
export function queueAssets(
  scene: Phaser.Scene,
  assets: readonly Asset[] = ALL_ASSETS
) {
  let queued = 0;
  for (const asset of assets) {
    if (!missing(scene, asset)) continue;
    scene.load.image(asset.key, asset.url);
    queued++;
  }
  return queued;
}

// How many of the downloads are in (for a progress readout).
export function assetsLoaded(scene: Phaser.Scene) {
  return ALL_ASSETS.filter((asset) => !missing(scene, asset)).length;
}
export const ASSET_COUNT = ALL_ASSETS.length;

// One-time preparation once everything is downloaded, one step per frame so
// the menu stays responsive. Each step does nothing if already done.
export const PREPARE_STEPS: readonly [string, (scene: Phaser.Scene) => void][] =
  [
    ['player frames', registerPlayerAtlases],
    ['ball', createBallTexture],
    ['court', createCourtTextures],
    ['scenery', createSceneryTextures],
  ];
