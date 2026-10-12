import Phaser from 'phaser';
import { PAL } from '../ui/palette';
import { makeTexture, paintRows } from './pixelArt';

// 6x6 art-pixel ball with two frames; alternating them as it rolls makes
// the patches look like they turn.
export const BALL_KEY = 'ball';
export const BALL_W = 6;

const FRAMES: Record<'a' | 'b', string[]> = {
  a: ['.kkkk.', 'kwwdwk', 'kwddwk', 'kwwwdk', 'kdwwwk', '.kkkk.'],
  b: ['.kkkk.', 'kdwwwk', 'kwwdwk', 'kwddwk', 'kwwwwk', '.kkkk.'],
};

// Soft oval shadow drawn on the ground under the ball, so its height reads
// in perspective (it shrinks and fades as the ball rises).
export const BALL_SHADOW_KEY = 'ball-shadow';

export function createBallTexture(scene: Phaser.Scene) {
  makeTexture(scene, BALL_SHADOW_KEY, BALL_W, 3, (ctx) => {
    paintRows(ctx, ['.kkkk.', 'kkkkkk', '.kkkk.'], { k: PAL.black });
  });
  const palette = { k: PAL.black, w: PAL.white, d: PAL.darkGray };
  makeTexture(
    scene,
    BALL_KEY,
    BALL_W * 2,
    BALL_W,
    (ctx) => {
      paintRows(ctx, FRAMES.a, palette, 0, 0);
      paintRows(ctx, FRAMES.b, palette, BALL_W, 0);
    },
    [
      { name: 'a', x: 0, y: 0, w: BALL_W, h: BALL_W },
      { name: 'b', x: BALL_W, y: 0, w: BALL_W, h: BALL_W },
    ]
  );
}
