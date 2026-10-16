import Phaser from 'phaser';
import { PAL } from '../ui/palette';
import {
  makeTexture,
  paintEllipseRing,
  paintRows,
  paintRing,
} from './pixelArt';
import {
  CARRY_FRAMES,
  CELEBRATION_FRAMES,
  DOWN_DIAGONAL_FRAMES,
  DOWN_FRAMES,
  HOLD_FRAMES,
  IDLE_FRAMES,
  KEEPER_IDLE_FRAMES,
  KIT_NAMES,
  PLAYER_ATLAS_KEYS,
  RUN_FRAMES,
  SHOOT_FRAMES,
  UP_DIAGONAL_FRAMES,
  UP_FRAMES,
  atlasFrames,
  playerTexture,
  type Kit,
} from './playerSheets';

// Player sprites: one ready-made atlas per kit plus the grey skin / hair
// look layers, baked at build time from the authored sheets (see
// playerSheets.ts and `npm run art:release`). The game only downloads them
// and names their frames; nothing is drawn or recoloured on the device.
export {
  LOOKS,
  PLAYER_HAIR_TEXTURE,
  PLAYER_HEIGHT,
  PLAYER_ORIGIN_Y,
  PLAYER_PX,
  PLAYER_SKIN_TEXTURE,
  playerTexture,
  type Kit,
  type Look,
} from './playerSheets';

// Number of goal celebrations the scorer picks from.
export const CELEBRATION_STYLES = CELEBRATION_FRAMES.length;

// The standing frame (also what a stopped animation falls back to).
export const IDLE_FRAME = 'idle1';
export type RunView = 'side' | 'up' | 'down' | 'up-diagonal' | 'down-diagonal';
export const runAnim = (kit: Kit, view: RunView = 'side') =>
  `player-${kit}-run${view === 'side' ? '' : `-${view}`}`;
export const shootAnim = (kit: Kit) => `player-${kit}-shoot`;
export const celebrateAnim = (kit: Kit, style: number) =>
  `player-${kit}-celebrate-${style}`;
export const idleAnim = (kit: Kit) => `player-${kit}-idle`;
export const holdAnim = (kit: Kit, moving = false) =>
  `player-${kit}-${moving ? 'carry' : 'hold'}`;
// Run frames per second at walking pace (Player scales it with speed).
export const RUN_FPS = 16; // Eight authored poses in the half-second stride.

export const MARKER_TARGET = 'marker-target';
export const MARKER_ARROW = 'marker-arrow';

// Names the frames of the loaded atlases and creates the animations and
// marker textures. Once per game; later calls do nothing. Atlases not
// loaded yet are skipped (and so are their kits' animations).
export function registerPlayerAtlases(scene: Phaser.Scene) {
  for (const key of PLAYER_ATLAS_KEYS) {
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    if (texture.has(IDLE_FRAME)) continue;
    for (const f of atlasFrames()) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
  for (const kit of KIT_NAMES)
    if (scene.textures.exists(playerTexture(kit))) createAnimations(scene, kit);

  // Pass target: the teammate a pass would go to right now. Controlled
  // player: an arrow overhead (the ring with a pointer on the ground is
  // drawn by the Match scene).
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

function createAnimations(scene: Phaser.Scene, kit: Kit) {
  if (scene.anims.exists(idleAnim(kit))) return;
  const key = playerTexture(kit);
  const frames = (names: readonly string[]) =>
    names.map((frame) => ({ key, frame }));
  scene.anims.create({
    key: holdAnim(kit, true),
    frames: frames(CARRY_FRAMES),
    frameRate: 12,
    repeat: -1,
  });
  scene.anims.create({
    key: holdAnim(kit),
    frames: frames(HOLD_FRAMES),
    frameRate: 4,
    repeat: -1,
  });
  // Standing: a slow weight shift.
  scene.anims.create({
    key: idleAnim(kit),
    frames: frames(
      kit === 'homeKeeper' || kit === 'awayKeeper'
        ? KEEPER_IDLE_FRAMES // gloved goalkeeper stance
        : IDLE_FRAMES
    ),
    frameRate: 4,
    repeat: -1,
  });
  // Running: the full 8-frame stride.
  scene.anims.create({
    key: runAnim(kit),
    frames: frames(RUN_FRAMES),
    frameRate: RUN_FPS,
    repeat: -1,
  });
  const views: readonly [RunView, readonly string[]][] = [
    ['up', UP_FRAMES],
    ['down', DOWN_FRAMES],
    ['up-diagonal', UP_DIAGONAL_FRAMES],
    ['down-diagonal', DOWN_DIAGONAL_FRAMES],
  ];
  for (const [view, names] of views)
    scene.anims.create({
      key: runAnim(kit, view),
      frames: frames(names),
      frameRate: RUN_FPS / 2,
      repeat: -1,
    });
  // Shooting (and keeper kicks): played once when the ball is struck.
  scene.anims.create({
    key: shootAnim(kit),
    frames: frames(SHOOT_FRAMES),
    frameRate: 14,
    repeat: 0,
  });
  // Goal celebrations by the scorer: six poses each, on a loop.
  CELEBRATION_FRAMES.forEach((set, style) =>
    scene.anims.create({
      key: celebrateAnim(kit, style),
      frames: frames(set),
      frameRate: 6,
      repeat: -1,
    })
  );
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
