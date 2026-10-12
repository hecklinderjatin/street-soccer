import Phaser from 'phaser';
import type { Team } from '../../shared/types';
import { PAL } from '../ui/palette';
import {
  makeTexture,
  paintEllipseRing,
  paintRows,
  paintRing,
} from './pixelArt';

// Placeholder character sprites until the artist's atlases arrive:
// 10x16 art pixels, front-facing, three frames (idle, run1, run2).
export const PLAYER_W = 10;
export const PLAYER_H = 16;

const BODY = [
  '...kkkk...',
  '..khhhhk..',
  '..khsshk..',
  '..kssssk..',
  '...kssk...',
  '..kttttk..',
  '.kttttttk.',
  '.ksttttsk.',
  '.ksttttsk.',
  '..kttttk..',
  '..kwwwwk..',
  '..kwwwwk..',
];
const LEGS: Record<string, string[]> = {
  idle: ['...s..s...', '...s..s...', '...s..s...', '..oo..oo..'],
  run1: ['..s....s..', '..s....s..', '.s......s.', '.oo....oo.'],
  run2: ['....ss....', '....ss....', '....ss....', '...oooo...'],
};
const FRAMES = Object.keys(LEGS);

// Outfield kits per team, plus distinct goalkeeper kits.
export type Kit = Team | 'homeKeeper' | 'awayKeeper';
const KITS: Record<Kit, { shirt: number; shorts: number }> = {
  home: { shirt: PAL.red, shorts: PAL.white },
  away: { shirt: PAL.blue, shorts: PAL.navy },
  homeKeeper: { shirt: PAL.green, shorts: PAL.black },
  awayKeeper: { shirt: PAL.yellow, shorts: PAL.black },
};
const KIT_NAMES: readonly Kit[] = ['home', 'away', 'homeKeeper', 'awayKeeper'];

export const playerTexture = (kit: Kit) => `player-${kit}`;
export const runAnim = (kit: Kit) => `player-${kit}-run`;

export const MARKER_TARGET = 'marker-target';
export const MARKER_ARROW = 'marker-arrow';

export function createPlayerTextures(scene: Phaser.Scene) {
  for (const kitName of KIT_NAMES) {
    const kit = KITS[kitName];
    const palette = {
      k: PAL.black,
      h: PAL.brown,
      s: PAL.peach,
      t: kit.shirt,
      w: kit.shorts,
      o: PAL.black,
    };
    const key = playerTexture(kitName);
    const created = makeTexture(
      scene,
      key,
      PLAYER_W * FRAMES.length,
      PLAYER_H,
      (ctx) => {
        FRAMES.forEach((frame, i) => {
          paintRows(
            ctx,
            [...BODY, ...(LEGS[frame] ?? [])],
            palette,
            i * PLAYER_W,
            0
          );
        });
      },
      FRAMES.map((name, i) => ({
        name,
        x: i * PLAYER_W,
        y: 0,
        w: PLAYER_W,
        h: PLAYER_H,
      }))
    );
    if (created) {
      scene.anims.create({
        key: runAnim(kitName),
        frames: ['run1', 'idle', 'run2', 'idle'].map((frame) => ({
          key,
          frame,
        })),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  // Controlled-player marker: an arrow overhead (and a facing arrow on the
  // ground, drawn as lines by the Match scene).
  // Pass target: the teammate a pass would go to right now.
  makeTexture(scene, MARKER_TARGET, 18, 18, (ctx) => {
    paintEllipseRing(ctx, 9, 9, 9, 9, 1.6, PAL.blue);
  });
  makeTexture(scene, MARKER_ARROW, 7, 4, (ctx) => {
    paintRows(ctx, ['kkkkkkk', '.kyyyk.', '..kyk..', '...k...'], {
      k: PAL.black,
      y: PAL.yellow,
    });
  });
}

// Joystick parts, painted at art resolution (radius in art pixels).
export const STICK_BASE = 'stick-base';
export const STICK_BAND = 'stick-band';
export const STICK_KNOB = 'stick-knob';

export function createStickTextures(
  scene: Phaser.Scene,
  radius: number,
  sprintAt: number
) {
  const size = radius * 2;
  const inner = radius * sprintAt;
  makeTexture(scene, STICK_BASE, size, size, (ctx) => {
    paintRing(ctx, radius, radius, radius, 0, PAL.black, 0.3);
    paintRing(ctx, radius, radius, radius, radius - 1, PAL.white, 0.9);
    paintRing(ctx, radius, radius, inner + 0.5, inner - 0.5, PAL.white, 0.35);
  });
  // White so it can be tinted (yellow = sprinting, red = sprint locked).
  makeTexture(scene, STICK_BAND, size, size, (ctx) => {
    paintRing(ctx, radius, radius, radius - 1, inner + 0.5, PAL.white, 1);
  });
  const knob = Math.round(radius * 0.36);
  makeTexture(scene, STICK_KNOB, knob * 2, knob * 2, (ctx) => {
    paintRing(ctx, knob, knob, knob, 0, PAL.black, 1);
    paintRing(ctx, knob, knob, knob - 1, 0, PAL.white, 1);
    paintRing(ctx, knob - 1, knob - 1, knob * 0.4, 0, PAL.lightGray, 1);
  });
}

// Round action button of a given radius (art pixels): a light disc, tinted
// per action, with a dark rim and a bevel. Returns the texture key.
export function createButtonTexture(scene: Phaser.Scene, radius: number) {
  const key = `button-disc-${radius}`;
  const size = radius * 2;
  makeTexture(scene, key, size, size, (ctx) => {
    paintRing(ctx, radius, radius, radius, 0, PAL.black, 1);
    paintRing(ctx, radius, radius, radius - 1, 0, PAL.white, 1);
    paintRing(
      ctx,
      radius + 1,
      radius + 1,
      radius - 1,
      radius - 3,
      PAL.black,
      0.3
    );
    paintRing(
      ctx,
      radius - 1,
      radius - 1,
      radius - 3,
      radius - 4,
      PAL.white,
      0.6
    );
  });
  return key;
}
