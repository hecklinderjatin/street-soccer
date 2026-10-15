import type { Team } from '../../shared/types';
import { PAL } from '../ui/palette';

// Player atlas layout and the build-time bake of the authored sheets.
// Pure data and pixel maths (no Phaser, no DOM): the game uses the layout
// to name frames, and `npm run art:bake` (scripts/bake-player-atlases.ts)
// uses the bake functions to turn the big editable sheets in public/art
// into small ready-to-use atlases in public-release/art. Nothing is
// recoloured or resized on the player's device.

const DETAIL = 4; // frame pixels per pose unit; frames are 224 x 128
export const PLAYER_W = 56 * DETAIL; // room for extended slides and keeper gloves
export const PLAYER_H = 32 * DETAIL;
// World px per sprite pixel: the frame is 96 world px tall.
export const PLAYER_PX = 3.0 / DETAIL;
export const PLAYER_HEIGHT = PLAYER_H * PLAYER_PX;
// Sprite origin (fraction of the frame height) where the boots meet the
// ground; the rows below hold the shadow.
export const PLAYER_ORIGIN_Y = 30 / 32;
const SHADOW_ROW = 29 * DETAIL; // the shadow sits below the boots

export const IDLE_FRAMES = ['idle1', 'idle2', 'idle3', 'idle4'];
export const RUN_FRAMES = Array.from({ length: 8 }, (_, i) => `run${i + 1}`);
export const SHOOT_FRAMES = [
  'shoot_windup',
  'shoot_contact',
  'shoot_follow',
  'shoot_recover',
];
export const UP_FRAMES = Array.from({ length: 4 }, (_, i) => `run_up${i + 1}`);
export const DOWN_FRAMES = Array.from(
  { length: 4 },
  (_, i) => `run_down${i + 1}`
);
export const UP_DIAGONAL_FRAMES = Array.from(
  { length: 4 },
  (_, i) => `run_up_diagonal${i + 1}`
);
export const DOWN_DIAGONAL_FRAMES = Array.from(
  { length: 4 },
  (_, i) => `run_down_diagonal${i + 1}`
);
export const TACKLE_FRAMES = Array.from(
  { length: 8 },
  (_, i) => `tackle${i + 1}`
);
export const DIVE_FRAMES = Array.from({ length: 6 }, (_, i) => `dive${i + 1}`);
export const HOLD_FRAMES = Array.from({ length: 4 }, (_, i) => `hold${i + 1}`);
export const HURT_FRAMES = Array.from({ length: 4 }, (_, i) => `hurt${i + 1}`);
export const CARRY_FRAMES = Array.from(
  { length: 6 },
  (_, i) => `carry${i + 1}`
);
// Goal celebrations (fists and jump, knee slide, dance): six poses each.
export const CELEBRATION_FRAMES = ['a', 'b', 'c'].map((set) =>
  Array.from({ length: 6 }, (_, i) => `celebrate_${set}${i + 1}`)
);

// Every atlas (each kit and the two look layers) holds these frames in this
// order, ATLAS_COLUMNS to a row: 8 x 224 = 1792 px wide, within the 2048 px
// texture limit of older mobile GPUs.
const ATLAS_COLUMNS = 8;
const FRAMES = [
  'idle1',
  'idle2',
  'idle3',
  ...RUN_FRAMES,
  ...SHOOT_FRAMES,
  'idle4',
  ...UP_FRAMES,
  ...DOWN_FRAMES,
  ...UP_DIAGONAL_FRAMES,
  ...DOWN_DIAGONAL_FRAMES,
  ...TACKLE_FRAMES,
  ...DIVE_FRAMES,
  ...HOLD_FRAMES,
  ...HURT_FRAMES,
  ...CARRY_FRAMES,
  ...CELEBRATION_FRAMES.flat(),
];
export const ATLAS_W = PLAYER_W * ATLAS_COLUMNS;
export const ATLAS_H = PLAYER_H * Math.ceil(FRAMES.length / ATLAS_COLUMNS);

export function atlasFrames() {
  return FRAMES.map((name, i) => ({
    name,
    x: (i % ATLAS_COLUMNS) * PLAYER_W,
    y: Math.floor(i / ATLAS_COLUMNS) * PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
  }));
}

// Outfield kits per team, plus distinct goalkeeper kits. Shades are the
// colours of the far-side limbs and the back of the shirt.
export type Kit = Team | 'homeKeeper' | 'awayKeeper';
type KitColors = {
  shirt: number;
  shirtShade: number;
  shirtHighlight: number;
  shorts: number;
  shortsShade: number;
  socks: number;
  sockShade: number;
};
const KITS: Record<Kit, KitColors> = {
  home: {
    shirt: PAL.kitPink,
    shirtShade: PAL.kitPinkShade,
    shirtHighlight: PAL.kitPinkLight,
    shorts: PAL.kitPink,
    shortsShade: PAL.kitPinkShade,
    socks: PAL.kitPink,
    sockShade: PAL.kitPinkShade,
  },
  away: {
    shirt: PAL.kitBlue,
    shirtShade: PAL.kitBlueShade,
    shirtHighlight: PAL.kitBlueLight,
    shorts: PAL.kitBlueShade,
    shortsShade: PAL.ink,
    socks: PAL.kitBlue,
    sockShade: PAL.kitBlueShade,
  },
  homeKeeper: {
    shirt: PAL.kitGreen,
    shirtShade: PAL.kitGreenShade,
    shirtHighlight: PAL.kitGreenLight,
    shorts: PAL.ink,
    shortsShade: PAL.black,
    socks: PAL.kitGreen,
    sockShade: PAL.kitGreenShade,
  },
  awayKeeper: {
    shirt: PAL.kitGold,
    shirtShade: PAL.kitGoldShade,
    shirtHighlight: PAL.kitGoldLight,
    shorts: PAL.ink,
    shortsShade: PAL.black,
    socks: PAL.kitGold,
    sockShade: PAL.kitGoldShade,
  },
};
export const KIT_NAMES: readonly Kit[] = [
  'home',
  'away',
  'homeKeeper',
  'awayKeeper',
];

// Texture keys; the baked file of each is public-release/art/<key>.png.
export const playerTexture = (kit: Kit) => `player-${kit}`;
export const PLAYER_SKIN_TEXTURE = 'player-skin';
export const PLAYER_HAIR_TEXTURE = 'player-hair';
export const PLAYER_ATLAS_KEYS = [
  ...KIT_NAMES.map(playerTexture),
  PLAYER_SKIN_TEXTURE,
  PLAYER_HAIR_TEXTURE,
];

// Player looks: skin and hair (beard included) are separate grey layers
// over the kit sprite, tinted per player, so every look shares the same two
// textures. Each tint is the colour the brightest skin / hair pixel gets;
// darker pixels keep their shading below it.
export type Look = { skin: number; hair: number };
export const LOOKS: readonly Look[] = [
  { skin: 0xf8b078, hair: 0xa05a2c }, // the original: tanned, brown hair
  { skin: 0xd8945c, hair: 0x3a3430 }, // olive, black hair
  { skin: 0xa86c44, hair: 0x2c2826 }, // brown, black hair
  { skin: 0xfcc89c, hair: 0xf0c878 }, // fair, blond hair
  { skin: 0x7c4c30, hair: 0x262220 }, // dark, black hair
  { skin: 0xf4b88c, hair: 0xd0582c }, // light, red hair
];
// Brightness (0-255 luma) that maps to the full tint: about the lightest
// common skin / hair tone in the authored art. Brighter pixels clamp.
const SKIN_REF_LUMA = 187;
const HAIR_REF_LUMA = 80;

// The dive poses lie diagonal or flat, so shirt / shorts / socks are split
// by slanted lines (cell px of the 1152 x 724 dive cells) instead of rows.
// A line runs from (x1, y1) to (x2, y2); the feet side is on the right of
// that direction (screen y down).
type SplitLine = readonly [number, number, number, number];
type KitSplit = { waist: SplitLine; shortsEnd: SplitLine };
const DIVE_CROUCH: KitSplit = {
  waist: [430, 460, 710, 410],
  shortsEnd: [450, 530, 790, 500],
};
const DIVE_LAUNCH: KitSplit = {
  waist: [590, 400, 700, 285],
  shortsEnd: [690, 500, 810, 340],
};
const DIVE_STRETCH: KitSplit = {
  waist: [610, 600, 655, 415],
  shortsEnd: [790, 600, 815, 420],
};
const DIVE_LANDED: KitSplit = {
  waist: [540, 670, 575, 450],
  shortsEnd: [660, 670, 660, 470],
};
function pastLine(l: SplitLine, x: number, y: number) {
  const [x1, y1, x2, y2] = l;
  return (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1) > 0;
}

// The authored source sheets (public/art/<file>.png): cells of cellW x 724
// px, `columns` to a row, poses in frame order, boots on `ground`. Pink
// clothing is recoloured per kit: shirt above `waist`, shorts above
// `shortsEnd` (cell y per pose), socks below; the dive splits by slanted
// lines instead.
const SOURCE_H = 724;
type SourceSheet = {
  file: string;
  frames: readonly string[];
  cellW: number;
  columns: number;
  ground: number;
  waist: readonly number[];
  shortsEnd: readonly number[];
  splits?: readonly KitSplit[];
};
const RUN_VIEW_WAIST = [376, 379, 376, 379];
const RUN_VIEW_SHORTS = [480, 489, 480, 489];
const STAND_WAIST = [446, 430, 449, 449];
const STAND_SHORTS = [552, 536, 555, 555];
const runView = (file: string, frames: readonly string[]): SourceSheet => ({
  file,
  frames,
  cellW: 640,
  columns: 4,
  ground: 681,
  waist: RUN_VIEW_WAIST,
  shortsEnd: RUN_VIEW_SHORTS,
});
const celebration = (
  file: string,
  frames: readonly string[],
  waist: readonly number[],
  shortsEnd: readonly number[]
): SourceSheet => ({
  file,
  frames,
  cellW: 720,
  columns: 3,
  ground: 681,
  waist,
  shortsEnd,
});
export const SOURCE_SHEETS: readonly SourceSheet[] = [
  {
    file: 'player-idle-authored',
    frames: IDLE_FRAMES,
    cellW: 352,
    columns: 4,
    ground: 695,
    waist: STAND_WAIST,
    shortsEnd: STAND_SHORTS,
  },
  {
    file: 'player-run-authored',
    frames: RUN_FRAMES,
    cellW: 640,
    columns: 4,
    ground: 681,
    waist: [399, 388, 389, 388, 392, 379, 395, 377],
    shortsEnd: [510, 494, 508, 494, 513, 492, 513, 495],
  },
  {
    file: 'player-shoot-authored',
    frames: SHOOT_FRAMES,
    cellW: 640,
    columns: 4,
    ground: 681,
    waist: [391, 405, 443, 396],
    shortsEnd: [517, 529, 486, 517],
  },
  runView('player-run-up-authored', UP_FRAMES),
  runView('player-run-down-authored', DOWN_FRAMES),
  runView('player-run-up-diagonal-authored', UP_DIAGONAL_FRAMES),
  runView('player-run-down-diagonal-authored', DOWN_DIAGONAL_FRAMES),
  {
    file: 'player-tackle-authored',
    frames: TACKLE_FRAMES,
    cellW: 1024,
    columns: 4,
    ground: 681,
    waist: [395, 450, 540, 555, 535, 455, 445, 400],
    shortsEnd: [520, 565, 630, 640, 635, 605, 580, 540],
  },
  {
    // Crouch, launch x2, full stretch x2, landed.
    file: 'player-dive-authored',
    frames: DIVE_FRAMES,
    cellW: 1152,
    columns: 3,
    ground: 681,
    waist: [],
    shortsEnd: [],
    splits: [
      DIVE_CROUCH,
      DIVE_LAUNCH,
      DIVE_LAUNCH,
      DIVE_STRETCH,
      DIVE_STRETCH,
      DIVE_LANDED,
    ],
  },
  {
    file: 'player-hold-authored',
    frames: HOLD_FRAMES,
    cellW: 640,
    columns: 4,
    ground: 681,
    waist: STAND_WAIST,
    shortsEnd: STAND_SHORTS,
  },
  {
    file: 'player-hurt-authored',
    frames: HURT_FRAMES,
    cellW: 1152,
    columns: 2,
    ground: 681,
    waist: [427, 422, 500, 586],
    shortsEnd: [544, 539, 608, 655],
  },
  {
    file: 'player-carry-authored',
    frames: CARRY_FRAMES,
    cellW: 640,
    columns: 3,
    ground: 681,
    waist: [375, 365, 375, 368, 360, 368],
    shortsEnd: [499, 490, 499, 491, 493, 493],
  },
  celebration(
    'player-celebrate-authored',
    CELEBRATION_FRAMES[0] ?? [],
    [448, 440, 385, 350, 446, 418],
    [525, 520, 478, 428, 522, 503]
  ),
  celebration(
    'player-celebrate2-authored',
    CELEBRATION_FRAMES[1] ?? [],
    [400, 508, 525, 505, 518, 515],
    [470, 600, 603, 600, 605, 605]
  ),
  celebration(
    'player-celebrate3-authored',
    CELEBRATION_FRAMES[2] ?? [],
    [414, 410, 400, 405, 399, 405],
    [497, 491, 486, 491, 486, 491]
  ),
];

// RGBA pixels, row by row (the same layout as canvas ImageData).
export type Pixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export function newPixels(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

// Kit colour for a pink clothing pixel of `sheet` pose `pose` at cell
// (x, y), or null when the pixel is not kit (skin, hair, boots, trim).
// The pink's brightness picks between the kit's shade, base and highlight.
function kitColour(
  kit: KitColors,
  sheet: SourceSheet,
  pose: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
): [number, number, number] | null {
  // Pink: red, with more blue than green. The shaded side goes deep (blue
  // down to 0.4 of red); skin, hair, boots and outline never pass.
  if (r < 70 || r < g * 1.25 || b < g * 1.08 || b < r * 0.4) return null;
  const split = sheet.splits?.[pose];
  const isShirt = split
    ? !pastLine(split.waist, x, y)
    : y < (sheet.waist[pose] ?? 446);
  const isShorts =
    !isShirt &&
    (split
      ? !pastLine(split.shortsEnd, x, y)
      : y < (sheet.shortsEnd[pose] ?? 552));
  const base = isShirt ? kit.shirt : isShorts ? kit.shorts : kit.socks;
  const shade = isShirt
    ? kit.shirtShade
    : isShorts
      ? kit.shortsShade
      : kit.sockShade;
  const highlight = isShorts ? kit.shorts : kit.shirtHighlight;
  const light = Math.max(
    0,
    Math.min(1, (0.2126 * r + 0.7152 * g + 0.0722 * b - 85) / 145)
  );
  const low = light < 0.6 ? shade : base;
  const high = light < 0.6 ? base : highlight;
  const mix = light < 0.6 ? light / 0.6 : (light - 0.6) / 0.4;
  const channel = (shift: number) => {
    const a = (low >> shift) & 255;
    const z = (high >> shift) & 255;
    return Math.round(a + (z - a) * mix);
  };
  return [channel(16), channel(8), channel(0)];
}

// Source-over blend of one pixel onto `out` at byte index i.
function blend(
  out: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  a: number
) {
  const sa = a / 255;
  const da = (out[i + 3] ?? 0) / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  const mixIn = (src: number, dst: number) =>
    (src * sa + dst * da * (1 - sa)) / oa;
  out[i] = mixIn(r, out[i] ?? 0);
  out[i + 1] = mixIn(g, out[i + 1] ?? 0);
  out[i + 2] = mixIn(b, out[i + 2] ?? 0);
  out[i + 3] = oa * 255;
}

// One kit's atlas from the authored sheets (`sources[i]` decodes
// SOURCE_SHEETS[i]). Each frame: a soft shadow under the feet, then the
// pose scaled to the frame height with nearest-neighbour sampling, boots on
// the frame's ground line, pink clothing recoloured for `kitName`.
export function bakePlayerAtlas(
  kitName: Kit,
  sources: readonly Pixels[]
): Pixels {
  const atlas = newPixels(ATLAS_W, ATLAS_H);
  const out = atlas.data;
  const kit = KITS[kitName];
  const rects = new Map(atlasFrames().map((f) => [f.name, f]));
  // Shadow: a soft black oval at 30% under the boots.
  const shadowX = PLAYER_W / 2;
  const shadowY = SHADOW_ROW + DETAIL;
  SOURCE_SHEETS.forEach((sheet, s) => {
    const src = sources[s];
    if (!src) throw new Error(`Missing source sheet ${sheet.file}`);
    const width = (sheet.cellW / SOURCE_H) * PLAYER_H;
    const left = (PLAYER_W - width) / 2;
    const top =
      PLAYER_H * PLAYER_ORIGIN_Y - (sheet.ground / SOURCE_H) * PLAYER_H;
    sheet.frames.forEach((name, pose) => {
      const rect = rects.get(name);
      if (!rect) return;
      for (let y = SHADOW_ROW; y < PLAYER_H; y++)
        for (let x = 0; x < PLAYER_W; x++) {
          const nx = (x + 0.5 - shadowX) / (7 * DETAIL);
          const ny = (y + 0.5 - shadowY) / (1.6 * DETAIL);
          if (nx * nx + ny * ny <= 1)
            blend(out, ((rect.y + y) * ATLAS_W + rect.x + x) * 4, 0, 0, 0, 77);
        }
      const cellX = (pose % sheet.columns) * sheet.cellW;
      const cellY = Math.floor(pose / sheet.columns) * SOURCE_H;
      for (let y = 0; y < PLAYER_H; y++) {
        const sy = Math.floor(((y + 0.5 - top) / PLAYER_H) * SOURCE_H);
        if (sy < 0 || sy >= SOURCE_H) continue;
        for (let x = 0; x < PLAYER_W; x++) {
          const sx = Math.floor(((x + 0.5 - left) / width) * sheet.cellW);
          if (sx < 0 || sx >= sheet.cellW) continue;
          const si = ((cellY + sy) * src.width + cellX + sx) * 4;
          const a = src.data[si + 3] ?? 0;
          if (!a) continue;
          let r = src.data[si] ?? 0;
          let g = src.data[si + 1] ?? 0;
          let b = src.data[si + 2] ?? 0;
          if (kitName !== 'home') {
            const c = kitColour(kit, sheet, pose, sx, sy, r, g, b);
            if (c) [r, g, b] = c;
          }
          blend(out, ((rect.y + y) * ATLAS_W + rect.x + x) * 4, r, g, b, a);
        }
      }
    });
  });
  return atlas;
}

// 1 = skin, 2 = hair or beard, 0 = anything else. Skin and hair are the
// warm tones (red > green > blue); kit pink has more blue than green and the
// dark outline is too dark. Hair is the darker, less blue part of them.
function lookPart(r: number, g: number, b: number, a: number) {
  if (a < 128 || r < 80 || r < g * 1.2 || g < b * 1.05) return 0;
  return r >= 150 && b >= r * 0.22 ? 1 : 2;
}

// Grey skin and hair layers from the home atlas: each part pixel keeps its
// brightness relative to the reference, ready to be tinted. A pixel goes
// with the part most of its neighbours belong to, so copper highlights in
// the hair stay hair and stray dark specks on skin stay skin.
export function bakeLookLayers(home: Pixels): { skin: Pixels; hair: Pixels } {
  const { width: w, height: h, data } = home;
  const parts = new Uint8Array(w * h);
  for (let i = 0; i < parts.length; i++)
    parts[i] = lookPart(
      data[i * 4] ?? 0,
      data[i * 4 + 1] ?? 0,
      data[i * 4 + 2] ?? 0,
      data[i * 4 + 3] ?? 0
    );
  const skin = newPixels(w, h);
  const hair = newPixels(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let part = parts[i] ?? 0;
      if (!part) continue;
      let skinNear = 0;
      let hairNear = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || x + dx < 0 || x + dx >= w) continue;
          if (y + dy < 0 || y + dy >= h) continue;
          const near = parts[i + dy * w + dx];
          if (near === 1) skinNear++;
          else if (near === 2) hairNear++;
        }
      if (part === 1 && hairNear > skinNear) part = 2;
      else if (part === 2 && skinNear > hairNear && hairNear <= 1) part = 1;
      const r = data[i * 4] ?? 0;
      const g = data[i * 4 + 1] ?? 0;
      const b = data[i * 4 + 2] ?? 0;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const ref = part === 1 ? SKIN_REF_LUMA : HAIR_REF_LUMA;
      const grey = Math.round(Math.min(1, luma / ref) * 255);
      const out = (part === 1 ? skin : hair).data;
      out[i * 4] = grey;
      out[i * 4 + 1] = grey;
      out[i * 4 + 2] = grey;
      out[i * 4 + 3] = data[i * 4 + 3] ?? 0;
    }
  return { skin, hair };
}
