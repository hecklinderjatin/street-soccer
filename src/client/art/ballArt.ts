import Phaser from 'phaser';
import { PAL } from '../ui/palette';
import { makeTexture, paintRows } from './pixelArt';

// Authored rolling ball, with a separate logical size to preserve gameplay scale.
export const BALL_KEY = 'ball';
export const BALL_W = 6;
export const BALL_TEXTURE_W = 64;
export const BALL_FRAMES = ['a', 'b', 'c', 'd']; // four supplied rolling views
export { AUTHORED_BALL_TEXTURE, AUTHORED_SHOT_BALL_TEXTURE } from './assetList';
import { AUTHORED_BALL_TEXTURE, AUTHORED_SHOT_BALL_TEXTURE } from './assetList';
export const BALL_SHOT_TEXTURE_W = 96;
export const BALL_SHOT_FRAMES = Array.from(
  { length: 6 },
  (_, i) => `shot${i + 1}`
);

// Soft oval shadow drawn on the ground under the ball, so its height reads
// in perspective (it shrinks and fades as the ball rises).
export const BALL_SHADOW_KEY = 'ball-shadow';

export function createBallTexture(scene: Phaser.Scene) {
  makeTexture(scene, BALL_SHADOW_KEY, BALL_W, 3, (ctx) => {
    paintRows(ctx, ['.kkkk.', 'kkkkkk', '.kkkk.'], { k: PAL.black });
  });
  if (scene.textures.exists(BALL_KEY)) return;
  const source = scene.textures.get(AUTHORED_BALL_TEXTURE).getSourceImage();
  const shotSource = scene.textures
    .get(AUTHORED_SHOT_BALL_TEXTURE)
    .getSourceImage();
  if (!(
    source instanceof HTMLImageElement || source instanceof HTMLCanvasElement
  ))
    throw new Error('Authored ball artwork must be an image or canvas');
  if (!(
    shotSource instanceof HTMLImageElement ||
    shotSource instanceof HTMLCanvasElement
  ))
    throw new Error('Authored shot ball artwork must be an image or canvas');
  makeTexture(
    scene,
    BALL_KEY,
    BALL_TEXTURE_W * BALL_FRAMES.length +
      BALL_SHOT_TEXTURE_W * BALL_SHOT_FRAMES.length,
    BALL_SHOT_TEXTURE_W,
    (ctx) => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0);
      ctx.drawImage(shotSource, BALL_TEXTURE_W * BALL_FRAMES.length, 0);
    },
    [
      ...BALL_FRAMES.map((name, i) => ({
        name,
        x: i * BALL_TEXTURE_W,
        y: 0,
        w: BALL_TEXTURE_W,
        h: BALL_TEXTURE_W,
      })),
      ...BALL_SHOT_FRAMES.map((name, i) => ({
        name,
        x: BALL_TEXTURE_W * BALL_FRAMES.length + i * BALL_SHOT_TEXTURE_W,
        y: 0,
        w: BALL_SHOT_TEXTURE_W,
        h: BALL_SHOT_TEXTURE_W,
      })),
    ]
  );
}
