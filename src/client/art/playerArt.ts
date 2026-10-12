import Phaser from 'phaser';
import type { Team } from '../../shared/types';
import { PAL } from '../ui/palette';
import {
  fill,
  makeTexture,
  paintEllipseRing,
  paintRows,
  paintRing,
} from './pixelArt';

// Player sprites in a chunky "8-bit football" style: big bearded head,
// side-on (facing right; flipped to face left), dark outline and a soft
// shadow under the feet. Original art, posed rather than hand-typed: each
// frame is a small skeleton (hip, neck, knees, ankles, toes, shoulders,
// elbows, hands) drawn as outlined pixel capsules, back limbs first.
// Frames: 3 idle, an 8-frame run cycle and a 4-frame shot (wind-up,
// contact, follow-through, recovery).
export const PLAYER_W = 24; // art px per frame
export const PLAYER_H = 32;
// World px per sprite pixel. Finer than the rest of the art (PX) so the
// player can carry more detail at about 88 world px tall (a little under
// the 104 px crossbar).
export const PLAYER_PX = 2.75;
export const PLAYER_HEIGHT = PLAYER_H * PLAYER_PX;
// Sprite origin (fraction of the frame height) where the boots meet the
// ground; the rows below hold the shadow.
export const PLAYER_ORIGIN_Y = 30 / 32;

const GROUND = 29; // lowest row a boot reaches; the shadow sits below it

// Palette keys painted into the frame grid:
// k outline, h hair / beard, s skin, t shirt, T shirt shade, w shorts,
// W shorts shade, c socks, C sock shade, f boots, a armband.
type Pt = readonly [number, number];
type Leg = { knee: Pt; ankle: Pt; toe: Pt };
type Arm = { elbow: Pt; hand: Pt };
type Pose = {
  hip: Pt;
  neck: Pt;
  backLeg: Leg;
  frontLeg: Leg;
  backArm: Arm;
  frontArm: Arm;
};

// Head, 10x9, facing right: short hair over the top and back, a big face
// with the eye toward the front, nose, short beard.
// No outline of its own; the silhouette outline goes round it.
const HEAD = [
  '..hhhhhh..',
  '.hhhhhhhhh',
  '.hhhssssss',
  '.hhssskss.',
  '.hsssssss.',
  '.hssssssss',
  '..sshhhhs.',
  '..hhhhhhh.',
  '...hhhhh..',
];

class Grid {
  readonly cells: string[] = new Array<string>(PLAYER_W * PLAYER_H).fill('.');

  set(x: number, y: number, ch: string) {
    if (x < 0 || y < 0 || x >= PLAYER_W || y >= PLAYER_H) return;
    this.cells[y * PLAYER_W + x] = ch;
  }

  get(x: number, y: number) {
    return this.cells[y * PLAYER_W + x] ?? '.';
  }

  // Every pixel whose centre is within r of the segment a-b.
  capsule(a: Pt, b: Pt, r: number, ch: string) {
    const [ax, ay] = a;
    const [bx, by] = b;
    const minX = Math.floor(Math.min(ax, bx) - r - 1);
    const maxX = Math.ceil(Math.max(ax, bx) + r + 1);
    const minY = Math.floor(Math.min(ay, by) - r - 1);
    const maxY = Math.ceil(Math.max(ay, by) + r + 1);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t =
          len2 === 0
            ? 0
            : Math.max(
                0,
                Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)
              );
        const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
        if (d <= r) this.set(x, y, ch);
      }
    }
  }

  // A limb drawn in front of what is already there: first a one-pixel rim
  // in a darker shade of whatever it covers (so it separates from the body
  // without a heavy black line), then the fill.
  front(a: Pt, b: Pt, r: number, ch: string) {
    this.forEachIn(a, b, r + 1, (x, y) => {
      const under = this.get(x, y);
      if (under !== '.') this.set(x, y, DARKER[under] ?? 'k');
    });
    this.capsule(a, b, r, ch);
  }

  private forEachIn(
    a: Pt,
    b: Pt,
    r: number,
    visit: (x: number, y: number) => void
  ) {
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (
      let y = Math.floor(Math.min(ay, by) - r - 1);
      y <= Math.ceil(Math.max(ay, by) + r + 1);
      y++
    ) {
      for (
        let x = Math.floor(Math.min(ax, bx) - r - 1);
        x <= Math.ceil(Math.max(ax, bx) + r + 1);
        x++
      ) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t =
          len2 === 0
            ? 0
            : Math.max(
                0,
                Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)
              );
        if (Math.hypot(px - (ax + dx * t), py - (ay + dy * t)) <= r)
          visit(x, y);
      }
    }
  }

  // One black outline round the whole silhouette (every empty pixel that
  // touches a filled one, edges only).
  outline() {
    const filled = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < PLAYER_W &&
      y < PLAYER_H &&
      this.get(x, y) !== '.';
    const add: [number, number][] = [];
    for (let y = 0; y < PLAYER_H; y++)
      for (let x = 0; x < PLAYER_W; x++)
        if (
          !filled(x, y) &&
          (filled(x - 1, y) ||
            filled(x + 1, y) ||
            filled(x, y - 1) ||
            filled(x, y + 1))
        )
          add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, 'k');
  }

  stamp(rows: readonly string[], ox: number, oy: number) {
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== '.') this.set(ox + x, oy + y, ch);
      })
    );
  }

  rows() {
    const out: string[] = [];
    for (let y = 0; y < PLAYER_H; y++)
      out.push(this.cells.slice(y * PLAYER_W, (y + 1) * PLAYER_W).join(''));
    return out;
  }
}

// The rim colour a front limb leaves on what it overlaps.
const DARKER: Record<string, string> = {
  t: 'T',
  w: 'W',
  s: 'h',
  c: 'C',
};

const lerp = (a: Pt, b: Pt, t: number): Pt => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const add = (a: Pt, dx: number, dy: number): Pt => [a[0] + dx, a[1] + dy];

// Shorts at the top of the thigh, skin to the knee, socks down the shin,
// a boot along the foot. The far leg uses the shade colours; the near one
// gets a rim where it crosses the body.
function drawLeg(g: Grid, hip: Pt, leg: Leg, back: boolean) {
  const shorts = back ? 'W' : 'w';
  const socks = back ? 'C' : 'c';
  const draw = (a: Pt, b: Pt, r: number, ch: string) =>
    back ? g.capsule(a, b, r, ch) : g.front(a, b, r, ch);
  const thighMid = lerp(hip, leg.knee, 0.55);
  const sockTop = lerp(leg.knee, leg.ankle, 0.3);
  draw(hip, thighMid, 1.8, shorts);
  draw(thighMid, leg.knee, 1.4, 's');
  g.capsule(leg.knee, sockTop, 1.3, 's');
  g.capsule(sockTop, leg.ankle, 1.3, socks);
  g.capsule(leg.ankle, leg.toe, 1.3, 'f');
}

// Short sleeve, then skin to the hand; the near arm wears the armband.
function drawArm(g: Grid, shoulder: Pt, arm: Arm, back: boolean) {
  const draw = (a: Pt, b: Pt, r: number, ch: string) =>
    back ? g.capsule(a, b, r, ch) : g.front(a, b, r, ch);
  const sleeveEnd = lerp(shoulder, arm.elbow, 0.45);
  draw(shoulder, sleeveEnd, 1.4, back ? 'T' : 't');
  draw(sleeveEnd, arm.elbow, 1.1, 's');
  draw(arm.elbow, arm.hand, 1.1, 's');
  if (!back) {
    const band = lerp(shoulder, arm.elbow, 0.4);
    g.set(Math.floor(band[0]), Math.floor(band[1]), 'a');
  }
}

// Back to front: far arm and leg, shorts, shirt (shaded at the back), near
// leg, neck, head, near arm; then one outline round the silhouette.
function drawPose(p: Pose) {
  const g = new Grid();
  const shoulderBack = add(p.neck, -1.5, 1.5);
  const shoulderFront = add(p.neck, 1.5, 1.5);
  drawArm(g, shoulderBack, p.backArm, true);
  drawLeg(g, p.hip, p.backLeg, true);
  g.capsule(add(p.hip, 0, -1), add(p.hip, 0, 1.5), 3.6, 'w');
  const chest = add(p.neck, 0, 2);
  g.capsule(chest, add(p.hip, 0, -1), 3.8, 't');
  // Shade the back of the shirt (the light comes from the front).
  for (let y = 0; y < PLAYER_H; y++) {
    const t = (y - chest[1]) / (p.hip[1] - 1 - chest[1]);
    if (t < -0.4 || t > 1.3) continue;
    const axis = chest[0] + (p.hip[0] - chest[0]) * Math.max(0, Math.min(1, t));
    for (let x = 0; x < PLAYER_W; x++)
      if (g.get(x, y) === 't' && x + 0.5 < axis - 2.4) g.set(x, y, 'T');
  }
  drawLeg(g, p.hip, p.frontLeg, false);
  g.capsule(p.neck, add(p.neck, 0, 1.5), 1.3, 's');
  g.stamp(HEAD, Math.round(p.neck[0]) - 5, Math.round(p.neck[1]) - 9);
  drawArm(g, shoulderFront, p.frontArm, false);
  g.outline();
  return g.rows();
}

// Moves a pose up or down so its lowest boot just reaches the ground.
function grounded(p: Pose): Pose {
  const low = Math.max(
    p.backLeg.ankle[1],
    p.backLeg.toe[1],
    p.frontLeg.ankle[1],
    p.frontLeg.toe[1]
  );
  const dy = GROUND - 1.2 - low;
  const sh = (q: Pt) => add(q, 0, dy);
  const leg = (l: Leg): Leg => ({
    knee: sh(l.knee),
    ankle: sh(l.ankle),
    toe: sh(l.toe),
  });
  const arm = (a: Arm): Arm => ({ elbow: sh(a.elbow), hand: sh(a.hand) });
  return {
    hip: sh(p.hip),
    neck: sh(p.neck),
    backLeg: leg(p.backLeg),
    frontLeg: leg(p.frontLeg),
    backArm: arm(p.backArm),
    frontArm: arm(p.frontArm),
  };
}

const DEG = Math.PI / 180;
// A direction measured from straight down, positive toward the front.
const dir = (angle: number): Pt => [Math.sin(angle), Math.cos(angle)];
const along = (from: Pt, angle: number, len: number): Pt => {
  const [dx, dy] = dir(angle);
  return [from[0] + dx * len, from[1] + dy * len];
};

const THIGH = 5;
const SHIN = 5.5;
const FOOT = 2.5;
const UPPER_ARM = 4;
const FOREARM = 3.5;

// One leg of the run at gait phase `phase` (radians): the thigh swings
// +-40 degrees; the knee folds while the leg swings forward (recovery) and
// is nearly straight while it pushes back (stance). The foot stays square
// to the shin.
function runLeg(hip: Pt, phase: number): Leg {
  const thigh = 40 * DEG * Math.sin(phase);
  const bend = (10 + 85 * Math.max(0, Math.cos(phase))) * DEG;
  const shin = thigh - bend;
  const knee = along(hip, thigh, THIGH);
  const ankle = along(knee, shin, SHIN);
  const toe = along(ankle, shin + 90 * DEG, FOOT);
  return { knee, ankle, toe };
}

// Arms swing opposite the leg on their side, elbows bent about 90 degrees.
function runArm(shoulder: Pt, phase: number): Arm {
  const upper = -45 * DEG * Math.sin(phase);
  const elbow = along(shoulder, upper, UPPER_ARM);
  const hand = along(elbow, upper + 95 * DEG, FOREARM);
  return { elbow, hand };
}

function runPose(i: number): Pose {
  const phase = (i / 8) * Math.PI * 2;
  const hip: Pt = [10.5, 17];
  const neck: Pt = [13, 10]; // leaning into the run
  return grounded({
    hip,
    neck,
    frontLeg: runLeg(hip, phase),
    backLeg: runLeg(hip, phase + Math.PI),
    frontArm: runArm(add(neck, 1, 1.5), phase + Math.PI),
    backArm: runArm(add(neck, -1, 1.5), phase),
  });
}

const POSES: Record<string, Pose> = {
  // Idle: feet apart, weight shifting, arms loose.
  idle1: grounded({
    hip: [12, 17],
    neck: [12, 10],
    backLeg: { knee: [10.5, 22], ankle: [10, 27], toe: [12.5, 27.5] },
    frontLeg: { knee: [14, 22], ankle: [14.5, 27], toe: [17, 27.5] },
    backArm: { elbow: [7.5, 15], hand: [7.5, 18.5] },
    frontArm: { elbow: [16.5, 15], hand: [16.5, 18.5] },
  }),
  idle2: grounded({
    hip: [12, 18],
    neck: [12, 11],
    backLeg: { knee: [10, 22.5], ankle: [10, 27], toe: [12.5, 27.5] },
    frontLeg: { knee: [14.5, 22.5], ankle: [14.5, 27], toe: [17, 27.5] },
    backArm: { elbow: [7, 15.5], hand: [7.3, 19] },
    frontArm: { elbow: [17, 15.5], hand: [16.8, 19] },
  }),
  idle3: grounded({
    hip: [12, 17],
    neck: [12.5, 10],
    backLeg: { knee: [10.5, 22], ankle: [10, 27], toe: [12.5, 27.5] },
    frontLeg: { knee: [14, 22], ankle: [14.5, 27], toe: [17, 27.5] },
    backArm: { elbow: [7.8, 15], hand: [8.3, 18.3] },
    frontArm: { elbow: [16.3, 15], hand: [16, 18.3] },
  }),
  ...Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [`run${i + 1}`, runPose(i)])
  ),
  // Shot: plant foot beside the ball, kicking (near) leg drawn back,
  // arms wide for balance ...
  shoot_windup: grounded({
    hip: [11, 18],
    neck: [10, 11],
    backLeg: { knee: [13.5, 22.5], ankle: [15, 27], toe: [17.5, 27.5] },
    frontLeg: { knee: [8.5, 22.5], ankle: [4.5, 21.5], toe: [3.5, 24] },
    backArm: { elbow: [14, 12.5], hand: [17.5, 11.5] },
    frontArm: { elbow: [6.5, 13.5], hand: [3, 12.5] },
  }),
  // ... the kicking foot swings through the ball ...
  shoot_contact: grounded({
    hip: [12, 18],
    neck: [13, 11],
    backLeg: { knee: [13, 22.5], ankle: [13, 27], toe: [15.5, 27.5] },
    frontLeg: { knee: [15.5, 22.5], ankle: [18.5, 26.5], toe: [21, 27] },
    backArm: { elbow: [16, 13], hand: [19, 14.5] },
    frontArm: { elbow: [9, 13], hand: [5.5, 14] },
  }),
  // ... follows through high, leaning back ...
  shoot_follow: grounded({
    hip: [11, 18],
    neck: [9.5, 11],
    backLeg: { knee: [11, 22.5], ankle: [11, 27], toe: [13.5, 27.5] },
    frontLeg: { knee: [15.5, 18.5], ankle: [19.5, 16], toe: [21.5, 14.5] },
    backArm: { elbow: [13.5, 12.5], hand: [15.5, 10] },
    frontArm: { elbow: [6.5, 14.5], hand: [4, 17] },
  }),
  // ... and lands back on it.
  shoot_recover: grounded({
    hip: [12, 18],
    neck: [12.5, 11],
    backLeg: { knee: [10, 22.5], ankle: [9.5, 27], toe: [12, 27.5] },
    frontLeg: { knee: [15, 22.5], ankle: [15.5, 27], toe: [18, 27.5] },
    backArm: { elbow: [15, 14.5], hand: [17, 16] },
    frontArm: { elbow: [10, 15], hand: [11, 18.5] },
  }),
};
const FRAMES = Object.keys(POSES);
const RUN_FRAMES = FRAMES.filter((f) => f.startsWith('run'));

// The standing frame (also what a stopped animation falls back to).
export const IDLE_FRAME = 'idle1';

// Outfield kits per team, plus distinct goalkeeper kits. Shades are the
// colours of the far-side limbs and the back of the shirt.
export type Kit = Team | 'homeKeeper' | 'awayKeeper';
type KitColors = {
  shirt: number;
  shirtShade: number;
  shorts: number;
  shortsShade: number;
  socks: number;
  sockShade: number;
  accent: number;
};
const KITS: Record<Kit, KitColors> = {
  home: {
    shirt: PAL.red,
    shirtShade: PAL.plum,
    shorts: PAL.white,
    shortsShade: PAL.lightGray,
    socks: PAL.red,
    sockShade: PAL.plum,
    accent: PAL.black,
  },
  away: {
    shirt: PAL.blue,
    shirtShade: PAL.navy,
    shorts: PAL.navy,
    shortsShade: PAL.black,
    socks: PAL.blue,
    sockShade: PAL.navy,
    accent: PAL.white,
  },
  homeKeeper: {
    shirt: PAL.green,
    shirtShade: PAL.darkGreen,
    shorts: PAL.black,
    shortsShade: PAL.darkGray,
    socks: PAL.green,
    sockShade: PAL.darkGreen,
    accent: PAL.yellow,
  },
  awayKeeper: {
    shirt: PAL.yellow,
    shirtShade: PAL.orange,
    shorts: PAL.black,
    shortsShade: PAL.darkGray,
    socks: PAL.yellow,
    sockShade: PAL.orange,
    accent: PAL.black,
  },
};
const KIT_NAMES: readonly Kit[] = ['home', 'away', 'homeKeeper', 'awayKeeper'];

export const playerTexture = (kit: Kit) => `player-${kit}`;
export const runAnim = (kit: Kit) => `player-${kit}-run`;
export const shootAnim = (kit: Kit) => `player-${kit}-shoot`;
export const idleAnim = (kit: Kit) => `player-${kit}-idle`;
// Run frames per second at walking pace (Player scales it with speed).
export const RUN_FPS = 16;

export const MARKER_TARGET = 'marker-target';
export const MARKER_ARROW = 'marker-arrow';

// Soft oval shadow on the ground under the feet, in every frame.
function paintShadow(ctx: CanvasRenderingContext2D, ox: number) {
  const cx = ox + PLAYER_W / 2;
  const cy = GROUND + 1;
  for (let y = GROUND; y < PLAYER_H; y++)
    for (let x = ox; x < ox + PLAYER_W; x++) {
      const nx = (x + 0.5 - cx) / 7;
      const ny = (y + 0.5 - cy) / 1.6;
      if (nx * nx + ny * ny <= 1) fill(ctx, x, y, 1, 1, PAL.black, 0.3);
    }
}

export function createPlayerTextures(scene: Phaser.Scene) {
  const frameRows = FRAMES.map((f) => {
    const pose = POSES[f];
    return pose ? drawPose(pose) : [];
  });
  for (const kitName of KIT_NAMES) {
    const kit = KITS[kitName];
    const palette = {
      k: PAL.black,
      h: PAL.brown,
      s: PAL.peach,
      t: kit.shirt,
      T: kit.shirtShade,
      w: kit.shorts,
      W: kit.shortsShade,
      c: kit.socks,
      C: kit.sockShade,
      f: PAL.white,
      a: kit.accent,
    };
    const key = playerTexture(kitName);
    const created = makeTexture(
      scene,
      key,
      PLAYER_W * FRAMES.length,
      PLAYER_H,
      (ctx) => {
        frameRows.forEach((rows, i) => {
          paintShadow(ctx, i * PLAYER_W);
          paintRows(ctx, rows, palette, i * PLAYER_W, 0);
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
    if (!created) continue;
    const frames = (names: string[]) => names.map((frame) => ({ key, frame }));
    // Standing: a slow weight shift.
    scene.anims.create({
      key: idleAnim(kitName),
      frames: frames(['idle1', 'idle2', 'idle3', 'idle2']),
      frameRate: 4,
      repeat: -1,
    });
    // Running: the full 8-frame stride.
    scene.anims.create({
      key: runAnim(kitName),
      frames: frames(RUN_FRAMES),
      frameRate: RUN_FPS,
      repeat: -1,
    });
    // Shooting (and keeper kicks): played once when the ball is struck.
    scene.anims.create({
      key: shootAnim(kitName),
      frames: frames([
        'shoot_windup',
        'shoot_contact',
        'shoot_follow',
        'shoot_recover',
      ]),
      frameRate: 14,
      repeat: 0,
    });
  }

  // Controlled-player marker: an arrow overhead (the ring with a pointer on
  // the ground is drawn by the Match scene).
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
