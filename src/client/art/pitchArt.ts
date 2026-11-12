import Phaser from 'phaser';
import { PITCH } from '../../shared/tuning';
import { PAL, PX } from '../ui/palette';
import { paintPixelText } from '../ui/pixelFont';
import { FREE_KICK_GROUND_KEY } from './assetList';
import {
  BASKETBALL,
  FREE_KICK_GROUND_SIZE,
  GROUND_H,
  GROUND_W,
  H,
  ax,
  ay,
  paintFreeKickGround,
  paintGround,
} from './groundPaint';
import { fill, hex, makeTexture, seededRandom } from './pixelArt';

// Textures for the 3D street court, painted at art-pixel resolution
// (1 texel = PX world px). The Match scene maps them onto ProjectedPlanes.
// The ground itself is painted in groundPaint.ts.
export {
  BASKETBALL,
  FREE_KICK_BASKETBALL,
  FREE_KICK_GROUND_EXTENT,
  GROUND_EXTENT,
} from './groundPaint';
export { FREE_KICK_GROUND_KEY };
export const GROUND_KEY = 'court-ground';
export const BACKDROP_KEY = 'court-backdrop';
export const END_WALL_KEY = 'court-endwall';
export const FENCE_KEY = 'court-fence';
export const CAP_KEY = 'court-cap';

const WALL_H = PITCH.wallHeight / PX;
const BACKDROP_H = PITCH.backdropHeight / PX;
const END_WALL_H = PITCH.endWallHeight / PX;
const FENCE_H = PITCH.fenceHeight / PX;
const CAP_H = PITCH.wallThickness / PX;

// The backdrop texture is facade on top, brick wall below; this is where they meet (0..1).
export const BACKDROP_WALL_V = (BACKDROP_H - WALL_H) / BACKDROP_H;

export const PARKING = {
  rows: [
    [PITCH.width + 120, PITCH.width + 320],
    [PITCH.width + 480, PITCH.width + 680],
  ] as const, // x extents of the two rows of bays
  y0: 80, // first bay line
  bay: 100, // bay width along y
  bays: 11, // bays per row
};

export function createCourtTextures(scene: Phaser.Scene) {
  makeTexture(scene, GROUND_KEY, GROUND_W, GROUND_H, (ctx) =>
    paintGround(ctx, BASKETBALL, GROUND_W, (rand) => paintParking(ctx, rand))
  );
  makeTexture(scene, BACKDROP_KEY, GROUND_W, BACKDROP_H, paintBackdrop);
  makeTexture(scene, END_WALL_KEY, H, END_WALL_H, paintEndWall);
  makeTexture(scene, FENCE_KEY, GROUND_W, FENCE_H, paintFence);
  makeTexture(scene, CAP_KEY, GROUND_W, CAP_H, paintCap);
}

export function createFreeKickCourtTextures(scene: Phaser.Scene) {
  makeTexture(
    scene,
    FREE_KICK_GROUND_KEY,
    FREE_KICK_GROUND_SIZE.width,
    FREE_KICK_GROUND_SIZE.height,
    paintFreeKickGround
  );
  makeTexture(scene, END_WALL_KEY, H, END_WALL_H, paintEndWall);
  makeTexture(scene, FENCE_KEY, GROUND_W, FENCE_H, paintFence);
  makeTexture(scene, CAP_KEY, GROUND_W, CAP_H, paintCap);
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
  // (No graffiti text on the wall: removed on user request.)
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
