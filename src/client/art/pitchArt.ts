import Phaser from 'phaser';
import { PITCH } from '../../shared/tuning';
import { seededRandom } from '../ui/backdrop';
import { PAL, PX } from '../ui/palette';
import { paintPixelText } from '../ui/pixelFont';
import { fill, hex, makeTexture, paintRing } from './pixelArt';
import { paintStreetAsphalt } from './streetAsphalt';

// Textures for the 3D street court, painted at art-pixel resolution
// (1 texel = PX world px). The Match scene maps them onto ProjectedPlanes.
export const GROUND_KEY = 'court-ground';
export const BACKDROP_KEY = 'court-backdrop';
export const END_WALL_KEY = 'court-endwall';
export const FENCE_KEY = 'court-fence';
export const CAP_KEY = 'court-cap';

const W = PITCH.width / PX;
const H = PITCH.height / PX;
const PAD_X = PITCH.groundPadX / PX;
const PAD_NEAR = PITCH.groundPadNear / PX;
const GROUND_W = W + 2 * PAD_X;
const GROUND_H = H + PAD_NEAR;
const WALL_H = PITCH.wallHeight / PX;
const BACKDROP_H = PITCH.backdropHeight / PX;
const END_WALL_H = PITCH.endWallHeight / PX;
const FENCE_H = PITCH.fenceHeight / PX;
const CAP_H = PITCH.wallThickness / PX;

// The backdrop texture is facade on top, brick wall below; this is where they meet (0..1).
export const BACKDROP_WALL_V = (BACKDROP_H - WALL_H) / BACKDROP_H;

// World extents covered by the ground and backdrop textures.
export const GROUND_EXTENT = {
  x0: -PITCH.groundPadX,
  x1: PITCH.width + PITCH.groundPadX,
  y0: 0,
  y1: PITCH.height + PITCH.groundPadNear,
};

// Scenery beyond the goal lines (world coords): an outdoor basketball court
// behind the left goal, a car park behind the right one. The hoops and cars
// themselves are billboards placed by MatchScene.
export const BASKETBALL = { x0: -660, x1: -160, y0: 180, y1: 1120 };
export const PARKING = {
  rows: [
    [PITCH.width + 120, PITCH.width + 320],
    [PITCH.width + 480, PITCH.width + 680],
  ] as const, // x extents of the two rows of bays
  y0: 80, // first bay line
  bay: 100, // bay width along y
  bays: 11, // bays per row
};

// World -> ground texture (art px).
const ax = (x: number) => (x + PITCH.groundPadX) / PX;
const ay = (y: number) => y / PX;

export function createCourtTextures(scene: Phaser.Scene) {
  makeTexture(scene, GROUND_KEY, GROUND_W, GROUND_H, paintGround);
  makeTexture(scene, BACKDROP_KEY, GROUND_W, BACKDROP_H, paintBackdrop);
  makeTexture(scene, END_WALL_KEY, H, END_WALL_H, paintEndWall);
  makeTexture(scene, FENCE_KEY, GROUND_W, FENCE_H, paintFence);
  makeTexture(scene, CAP_KEY, GROUND_W, CAP_H, paintCap);
}

function paintGround(ctx: CanvasRenderingContext2D) {
  const rand = seededRandom(11);
  const ox = PAD_X;

  // Street around the court: pavement slabs beyond the goal lines and near side.
  fill(ctx, 0, 0, GROUND_W, GROUND_H, PAL.darkGray);
  for (let x = 0; x < GROUND_W; x += 12)
    fill(ctx, x, 0, 1, GROUND_H, PAL.black, 0.35);
  for (let y = 0; y < GROUND_H; y += 12)
    fill(ctx, 0, y, GROUND_W, 1, PAL.black, 0.35);
  // Road beyond the pavement on the near side.
  fill(ctx, 0, H + 40, GROUND_W, GROUND_H - H - 40, PAL.navy);
  fill(ctx, 0, H + 40, GROUND_W, 2, PAL.lightGray);
  for (let x = 0; x < GROUND_W; x += 24)
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
  paintBasketball(ctx);
  paintParking(ctx, rand);
}

// Outdoor basketball court: green surface, brown keys, white lines,
// laid out along y (hoops at the far and near baselines).
function paintBasketball(ctx: CanvasRenderingContext2D) {
  const x0 = ax(BASKETBALL.x0);
  const x1 = ax(BASKETBALL.x1);
  const y0 = ay(BASKETBALL.y0);
  const y1 = ay(BASKETBALL.y1);
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const line = (x: number, y: number, lw: number, lh: number) =>
    fill(ctx, x, y, lw, lh, PAL.white, 0.9);

  fill(ctx, x0 - 3, y0 - 3, w + 6, h + 6, PAL.black, 0.5);
  fill(ctx, x0, y0, w, h, PAL.darkGreen);
  const keyW = 49;
  const keyH = 59;
  fill(ctx, cx - keyW / 2, y0, keyW, keyH, PAL.brown);
  fill(ctx, cx - keyW / 2, y1 - keyH, keyW, keyH, PAL.brown);

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

// Car park: dark asphalt, two rows of white-lined bays, a lane with
// yellow dashes and painted P markings.
function paintParking(ctx: CanvasRenderingContext2D, rand: () => number) {
  const [rowA, rowB] = PARKING.rows;
  const x0 = ax(rowA[0]) - 4;
  const x1 = ax(rowB[1]) + 4;
  const y0 = ay(PARKING.y0) - 6;
  const y1 = ay(PARKING.y0 + PARKING.bay * PARKING.bays) + 6;

  fill(ctx, x0, y0, x1 - x0, y1 - y0, PAL.navy);
  for (let i = 0; i < 900; i++)
    fill(
      ctx,
      x0 + rand() * (x1 - x0),
      y0 + rand() * (y1 - y0),
      1,
      1,
      PAL.black,
      0.5
    );
  fill(ctx, x0, y0, x1 - x0, 1, PAL.lightGray);
  fill(ctx, x0, y1 - 1, x1 - x0, 1, PAL.lightGray);

  for (const [rx0, rx1] of PARKING.rows) {
    const a0 = ax(rx0);
    const a1 = ax(rx1);
    for (let k = 0; k <= PARKING.bays; k++) {
      fill(
        ctx,
        a0,
        ay(PARKING.y0 + k * PARKING.bay),
        a1 - a0,
        1,
        PAL.white,
        0.85
      );
    }
    // Line at the back of each row (away from the lane).
    const back = rx0 === rowA[0] ? a0 : a1 - 1;
    fill(
      ctx,
      back,
      ay(PARKING.y0),
      1,
      ay(PARKING.bay * PARKING.bays),
      PAL.white,
      0.85
    );
  }

  const laneX = (ax(rowA[1]) + ax(rowB[0])) / 2;
  for (let y = y0 + 4; y < y1 - 4; y += 8)
    fill(ctx, laneX, y, 1, 4, PAL.yellow, 0.9);
  for (const py of [ay(PARKING.y0) + 20, ay(PARKING.y0) + 150]) {
    paintPixelText(ctx, 'P', laneX - 18, py, 3, hex(PAL.white));
  }
}

// Far side: brick wall with graffiti at the bottom (WALL_H rows), apartment
// facades above it with windows, some lit with neighbours leaning out.
// Rows above a building's roof stay transparent so the sky shows through.
function paintBackdrop(ctx: CanvasRenderingContext2D) {
  const rand = seededRandom(5);
  const wallTop = BACKDROP_H - WALL_H;

  // Buildings of varying width and height.
  const colors = [PAL.navy, PAL.plum, PAL.darkGray, PAL.brown];
  for (let x = 0; x < GROUND_W;) {
    const bw = 50 + Math.floor(rand() * 70);
    const roof = Math.floor(rand() * 22);
    const color = colors[Math.floor(rand() * colors.length)] ?? PAL.navy;
    fill(ctx, x, roof, bw, wallTop - roof, color);
    fill(ctx, x, roof, bw, 2, PAL.black);
    fill(ctx, x, roof, 1, wallTop - roof, PAL.black, 0.6);
    for (let wy = roof + 6; wy + 9 < wallTop; wy += 13) {
      for (let wx = x + 5; wx + 6 < x + bw - 3; wx += 11) {
        const lit = rand() < 0.45;
        fill(ctx, wx - 1, wy - 1, 8, 10, PAL.black);
        fill(
          ctx,
          wx,
          wy,
          6,
          8,
          lit ? (rand() < 0.7 ? PAL.yellow : PAL.orange) : PAL.navy
        );
        if (lit && rand() < 0.4) {
          // Someone leaning out to watch: head and shoulders.
          fill(ctx, wx + 2, wy + 2, 2, 2, PAL.black);
          fill(ctx, wx + 1, wy + 4, 4, 4, PAL.black);
        }
      }
    }
    x += bw;
  }

  // Brick wall.
  fill(ctx, 0, wallTop, GROUND_W, WALL_H, PAL.plum);
  for (let row = 0; row * 4 < WALL_H; row++) {
    const shift = row % 2 === 0 ? 0 : -4;
    for (let x = shift; x < GROUND_W; x += 8) {
      fill(
        ctx,
        x + 1,
        wallTop + row * 4 + 1,
        7,
        3,
        rand() < 0.12 ? PAL.darkGray : PAL.brown
      );
    }
  }
  fill(ctx, 0, wallTop, GROUND_W, 2, PAL.lightGray);

  // Graffiti tags along the court (original art only, no real brands).
  const tags: [string, number, number][] = [
    ['ZONE', 70, PAL.blue],
    ['STREET', 200, PAL.yellow],
    ['5V5', 330, PAL.pink],
    ['KICK IT', 420, PAL.green],
    ['GOAL!', 560, PAL.blue],
    ['NO RULES', 660, PAL.orange],
    ['PLAY', 840, PAL.pink],
  ];
  for (const [text, x, color] of tags) {
    paintPixelText(
      ctx,
      text,
      x,
      wallTop + 12 + Math.floor(rand() * 10),
      2,
      hex(color),
      hex(PAL.black)
    );
  }
}

function paintEndWall(ctx: CanvasRenderingContext2D) {
  fill(ctx, 0, 0, H, END_WALL_H, PAL.plum);
  for (let row = 0; row * 4 < END_WALL_H; row++) {
    const shift = row % 2 === 0 ? 0 : -4;
    for (let x = shift; x < H; x += 8)
      fill(ctx, x + 1, row * 4 + 1, 7, 3, PAL.brown);
  }
  fill(ctx, 0, 0, H, 2, PAL.lightGray);
}

// Chain-link fence: transparent mesh with posts and a top rail.
function paintFence(ctx: CanvasRenderingContext2D) {
  for (let y = 2; y < FENCE_H; y++) {
    for (let x = 0; x < GROUND_W; x++) {
      if ((x + y) % 5 === 0 || (x - y + 500) % 5 === 0)
        fill(ctx, x, y, 1, 1, PAL.lightGray, 0.8);
    }
  }
  for (let x = 0; x < GROUND_W; x += 40)
    fill(ctx, x, 0, 2, FENCE_H, PAL.darkGray);
  fill(ctx, 0, 0, GROUND_W, 2, PAL.lightGray);
}

// Coping stones on top of the walls (seen from above): light concrete slabs
// with joints, a worn front edge and a few stains. v=0 is the outer edge.
function paintCap(ctx: CanvasRenderingContext2D) {
  const rand = seededRandom(31);
  fill(ctx, 0, 0, GROUND_W, CAP_H, PAL.lightGray);
  for (let x = 0; x < GROUND_W; x += 10)
    fill(ctx, x, 0, 1, CAP_H, PAL.darkGray);
  for (let i = 0; i < 260; i++)
    fill(ctx, rand() * GROUND_W, rand() * CAP_H, 1, 1, PAL.lavender, 0.7);
  fill(ctx, 0, 0, GROUND_W, 1, PAL.darkGray);
  fill(ctx, 0, CAP_H - 1, GROUND_W, 1, PAL.white);
}
