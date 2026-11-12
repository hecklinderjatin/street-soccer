import { PITCH } from '../../shared/tuning';
import { PAL, PX } from '../ui/palette';
import { fill, paintRing, seededRandom, type PaintCtx } from './paint';
import { paintStreetAsphalt } from './streetAsphalt';

// The court's ground textures (match and Free Kick), painted at art-pixel
// resolution (1 texel = PX world px). No Phaser or DOM here: the Free Kick
// ground is also baked to an image in Node (scripts/bake-court.ts).
// pitchArt.ts turns these into textures.

export const W = PITCH.width / PX;
export const H = PITCH.height / PX;
export const PAD_X = PITCH.groundPadX / PX;
const PAD_NEAR = PITCH.groundPadNear / PX;
export const GROUND_W = W + 2 * PAD_X;
export const GROUND_H = H + PAD_NEAR;

// World extents covered by the ground and backdrop textures.
export const GROUND_EXTENT = {
  x0: -PITCH.groundPadX,
  x1: PITCH.width + PITCH.groundPadX,
  y0: 0,
  y1: PITCH.height + PITCH.groundPadNear,
};

export const FREE_KICK_GROUND_EXTENT = {
  ...GROUND_EXTENT,
  x1: GROUND_EXTENT.x1 + 360,
};

// Scenery beyond the goal lines (world coords): an outdoor basketball court
// behind the left goal, a car park behind the right one. The hoops and cars
// themselves are billboards placed by MatchScene.
export const BASKETBALL = { x0: -660, x1: -160, y0: 180, y1: 1120 };
export const FREE_KICK_BASKETBALL = {
  x0: PITCH.width + 170,
  x1: PITCH.width + 900,
  y0: (PITCH.height - 1100) / 2,
  y1: (PITCH.height + 1100) / 2,
};

// World -> ground texture (art px).
export const ax = (x: number) => (x + PITCH.groundPadX) / PX;
export const ay = (y: number) => y / PX;

// The Free Kick ground texture's size (art px) and painter. The feed
// game loads it baked (`npm run art:court`, freekick-ground.png) and
// only paints it if that download failed: painting takes ~0.1 s of CPU on
// a desktop, several times that on a phone.
export const FREE_KICK_GROUND_SIZE = {
  width: ax(FREE_KICK_GROUND_EXTENT.x1),
  height: GROUND_H,
};
export function paintFreeKickGround(ctx: PaintCtx) {
  const width = FREE_KICK_GROUND_SIZE.width;
  paintGround(ctx, FREE_KICK_BASKETBALL, width, (rand) => {
    // A grass verge beyond the basketball court.
    const verge = ax(FREE_KICK_BASKETBALL.x1 + 68);
    fill(ctx, verge, 0, width - verge, GROUND_H, 0x829b64);
    fill(ctx, verge - 2, 0, 2, GROUND_H, 0xbeb5a0);
    for (let i = 0; i < 700; i++) {
      const x = verge + rand() * (width - verge);
      const y = rand() * GROUND_H;
      fill(ctx, x, y, 2, 1, 0x5d7749, 0.36);
    }
  });
}

// `beyond` paints what lies past the basketball court, continuing the
// ground's random sequence.
export function paintGround(
  ctx: PaintCtx,
  basketball: typeof BASKETBALL,
  groundWidth: number,
  beyond: (rand: () => number) => void
) {
  const rand = seededRandom(11);
  const ox = PAD_X;

  // Street around the court: pavement slabs beyond the goal lines and near side.
  fill(ctx, 0, 0, groundWidth, GROUND_H, PAL.darkGray);
  for (let x = 0; x < groundWidth; x += 12)
    fill(ctx, x, 0, 1, GROUND_H, PAL.black, 0.35);
  for (let y = 0; y < GROUND_H; y += 12)
    fill(ctx, 0, y, groundWidth, 1, PAL.black, 0.35);
  // Road beyond the pavement on the near side.
  fill(ctx, 0, H + 40, groundWidth, GROUND_H - H - 40, PAL.navy);
  fill(ctx, 0, H + 40, groundWidth, 2, PAL.lightGray);
  for (let x = 0; x < groundWidth; x += 24)
    fill(ctx, x, H + 60, 12, 1, PAL.white, 0.7);

  paintStreetAsphalt(ctx, ox, W, H, rand);

  // Goal recesses: asphalt floor inside each net, in shadow.
  const m = PITCH.goalMouth / PX;
  const d = PITCH.goalDepth / PX;
  const gTop = Math.floor((H - m) / 2);
  for (const x of [ox - d, ox + W]) {
    fill(ctx, x, gTop, d, m, 0x5f5852);
    fill(ctx, x, gTop, d, m, PAL.black, 0.45);
  }

  // Pitch markings are drawn as projected lines each frame (render/PitchLines.ts):
  // painted into this texture they were too thin far away and flickered.
  paintBasketball(ctx, basketball);
  beyond(rand);
}

// Outdoor basketball court: green surface, brown keys, white lines,
// laid out along y (hoops at the far and near baselines).
function paintBasketball(ctx: PaintCtx, court: typeof BASKETBALL) {
  const x0 = ax(court.x0);
  const x1 = ax(court.x1);
  const y0 = ay(court.y0);
  const y1 = ay(court.y1);
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const line = (x: number, y: number, lw: number, lh: number) =>
    fill(ctx, x, y, lw, lh, PAL.white, 0.9);

  fill(ctx, x0 - 3, y0 - 3, w + 6, h + 6, PAL.black, 0.5);
  const freeKick = court === FREE_KICK_BASKETBALL;
  fill(ctx, x0, y0, w, h, freeKick ? 0x487c71 : PAL.darkGreen);
  if (freeKick) {
    for (let x = x0 + 6; x < x1; x += 12)
      fill(ctx, x, y0, Math.min(6, x1 - x), h, 0x5d9181, 0.3);
  }
  const keyW = freeKick ? 60 : 49;
  const keyH = freeKick ? 67 : 59;
  fill(ctx, cx - keyW / 2, y0, keyW, keyH, freeKick ? 0xac6950 : PAL.brown);
  fill(ctx, cx - keyW / 2, y1 - keyH, keyW, keyH, freeKick ? 0xac6950 : PAL.brown);

  // Boundary, half-court line, key outlines.
  line(x0, y0, w, 1);
  line(x0, y1 - 1, w, 1);
  line(x0, y0, 1, h);
  line(x1 - 1, y0, 1, h);
  line(x0, cy, w, 1);
  line(cx - keyW / 2, y0, 1, keyH);
  line(cx + keyW / 2, y0, 1, keyH);
  line(cx - keyW / 2, y0 + keyH, keyW + 1, 1);
  line(cx - keyW / 2, y1 - keyH, 1, keyH);
  line(cx + keyW / 2, y1 - keyH, 1, keyH);
  line(cx - keyW / 2, y1 - keyH, keyW + 1, 1);

  // Circles and three-point arcs (clipped to the court).
  paintRing(ctx, cx + 0.5, cy + 0.5, 18, 17, PAL.white, 0.9);
  paintRing(ctx, cx + 0.5, y0 + keyH + 0.5, 18, 17, PAL.white, 0.9);
  paintRing(ctx, cx + 0.5, y1 - keyH + 0.5, 18, 17, PAL.white, 0.9);
  for (const [hoopY, dir] of [
    [y0 + 16, 1],
    [y1 - 16, -1],
  ] as const) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0 + 2; x < x1 - 2; x++) {
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - hoopY);
        if (Math.abs(dist - 75) < 0.6 && (y - hoopY) * dir >= 0)
          fill(ctx, x, y, 1, 1, PAL.white, 0.9);
      }
    }
  }
}
