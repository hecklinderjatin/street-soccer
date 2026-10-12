import Phaser from 'phaser';
import { PAL } from '../ui/palette';
import { fill, makeTexture, paintRows } from './pixelArt';

// Upright props around the court, drawn as camera-facing billboards
// (see render/Billboard.ts). Sizes are in art pixels.

export const HOOP_KEY = 'prop-hoop';
export const HOOP_W = 18;
export const HOOP_H = 40;

export const CAR_W = 40;
export const CAR_H = 14;
export const CAR_COLORS = [
  PAL.red,
  PAL.blue,
  PAL.yellow,
  PAL.green,
  PAL.white,
  PAL.orange,
  PAL.pink,
  PAL.lavender,
];
export const carKey = (index: number) => `prop-car-${index}`;

// Spectators: 8x14 art pixels, two frames (idle, cheer with arms up).
export const FAN_W = 8;
export const FAN_H = 14;
export const FAN_VARIANTS = 12;
export const fanKey = (index: number) => `prop-fan-${index}`;

const FAN_FRAMES: Record<'idle' | 'cheer', string[]> = {
  idle: [
    '..hhhh..',
    '.hhhhhh.',
    '.hssssh.',
    '..ssss..',
    '...ss...',
    '.tttttt.',
    'tttttttt',
    'stttttts',
    'stttttts',
    '.tttttt.',
    '.pppppp.',
    '.pp..pp.',
    '.pp..pp.',
    '.oo..oo.',
  ],
  cheer: [
    's.hhhh.s',
    'shhhhhhs',
    'shsssshs',
    't.ssss.t',
    't..ss..t',
    'tttttttt',
    '.tttttt.',
    '.tttttt.',
    '.tttttt.',
    '.tttttt.',
    '.pppppp.',
    '.pp..pp.',
    '.pp..pp.',
    '.oo..oo.',
  ],
};

export function createSceneryTextures(scene: Phaser.Scene) {
  makeTexture(scene, HOOP_KEY, HOOP_W, HOOP_H, paintHoop);
  CAR_COLORS.forEach((color, i) => {
    makeTexture(scene, carKey(i), CAR_W, CAR_H, (ctx) => paintCar(ctx, color));
  });

  // Varied spectators: shirt, hair, skin and trousers picked per variant.
  const shirts = [
    PAL.red,
    PAL.blue,
    PAL.yellow,
    PAL.green,
    PAL.orange,
    PAL.pink,
    PAL.white,
    PAL.lavender,
    PAL.plum,
  ];
  const hair = [PAL.black, PAL.brown, PAL.yellow, PAL.darkGray, PAL.orange];
  const skin = [PAL.peach, PAL.peach, PAL.brown];
  const pants = [PAL.navy, PAL.darkGray, PAL.black, PAL.blue];
  for (let i = 0; i < FAN_VARIANTS; i++) {
    const palette = {
      t: shirts[i % shirts.length] ?? PAL.red,
      h: hair[(i * 3) % hair.length] ?? PAL.black,
      s: skin[(i * 5) % skin.length] ?? PAL.peach,
      p: pants[(i * 7) % pants.length] ?? PAL.navy,
      o: PAL.black,
    };
    makeTexture(
      scene,
      fanKey(i),
      FAN_W * 2,
      FAN_H,
      (ctx) => {
        paintRows(ctx, FAN_FRAMES.idle, palette, 0, 0);
        paintRows(ctx, FAN_FRAMES.cheer, palette, FAN_W, 0);
      },
      [
        { name: 'idle', x: 0, y: 0, w: FAN_W, h: FAN_H },
        { name: 'cheer', x: FAN_W, y: 0, w: FAN_W, h: FAN_H },
      ]
    );
  }
}

// Basketball hoop: pole, backboard with target square, orange rim and net.
function paintHoop(ctx: CanvasRenderingContext2D) {
  fill(ctx, 7, 10, 4, HOOP_H - 10, PAL.black);
  fill(ctx, 8, 10, 2, HOOP_H - 10, PAL.darkGray);
  fill(ctx, 0, 0, HOOP_W, 11, PAL.black);
  fill(ctx, 1, 1, HOOP_W - 2, 9, PAL.white);
  fill(ctx, 6, 4, 6, 5, PAL.orange);
  fill(ctx, 7, 5, 4, 3, PAL.white);
  fill(ctx, 4, 10, 10, 2, PAL.orange);
  for (let y = 12; y < 16; y++) {
    const inset = y - 11;
    for (let x = 4 + inset; x < 14 - inset; x += 2)
      fill(ctx, x + (y % 2), y, 1, 1, PAL.white);
  }
}

// Side view of a small hatchback, facing right (flip for left).
function paintCar(ctx: CanvasRenderingContext2D, color: number) {
  // Silhouette: lower body and cabin, outlined in black.
  fill(ctx, 0, 5, CAR_W, 6, PAL.black);
  fill(ctx, 8, 0, 22, 6, PAL.black);
  fill(ctx, 1, 6, CAR_W - 2, 4, color);
  fill(ctx, 9, 1, 20, 5, color);
  // Windows with a pillar between.
  fill(ctx, 10, 2, 8, 3, PAL.blue);
  fill(ctx, 20, 2, 8, 3, PAL.blue);
  fill(ctx, 11, 2, 2, 1, PAL.white, 0.7);
  // Shade along the sill, lights, bumper.
  fill(ctx, 1, 9, CAR_W - 2, 1, PAL.black, 0.35);
  fill(ctx, CAR_W - 2, 6, 1, 2, PAL.yellow);
  fill(ctx, 1, 6, 1, 2, PAL.red);
  fill(ctx, 0, 9, 3, 1, PAL.lightGray);
  fill(ctx, CAR_W - 3, 9, 3, 1, PAL.lightGray);
  // Wheels.
  for (const wx of [5, 27]) {
    fill(ctx, wx, 8, 8, 6, PAL.black);
    fill(ctx, wx + 1, 7, 6, 1, PAL.black);
    fill(ctx, wx + 3, 10, 2, 2, PAL.lightGray);
  }
}
