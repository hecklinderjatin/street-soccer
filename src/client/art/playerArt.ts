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

// Detailed pixel footballers: swept hair, shaded jaw, tailored kits,
// three-quarter face (facing right; flipped to face left), dark outline and a soft
// shadow under the feet. Original art, posed rather than hand-typed: each
// frame is a small skeleton (hip, neck, knees, ankles, toes, shoulders,
// elbows, hands) drawn as outlined pixel capsules, back limbs first.
// Frames: 3 idle, an 8-frame run cycle and a 4-frame shot (wind-up,
// contact, follow-through, recovery).
const DETAIL = 4; // Pose coordinates stay small; detailed textures are 96x128.
export const PLAYER_W = 56 * DETAIL; // Include extended slides and keeper gloves.
export const PLAYER_H = 32 * DETAIL;
// World px per sprite pixel. Finer than the rest of the art (PX) so the
// player can carry more detail at about 88 world px tall (a little under
// the 104 px crossbar).
export const PLAYER_PX = 3.0 / DETAIL;
export const PLAYER_HEIGHT = PLAYER_H * PLAYER_PX;
// Sprite origin (fraction of the frame height) where the boots meet the
// ground; the rows below hold the shadow.
export const PLAYER_ORIGIN_Y = 30 / 32;

const GROUND = 29; // pose coordinates; the shadow sits below the boots

// Palette keys painted into the frame grid:
// k outline, h/H/j hair, s/b/d/u skin, e eye, m mouth, t/T/l shirt tones,
// w/W shorts, c/C socks, f boots, a kit trim.
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

class Grid {
  readonly cells: string[] = new Array<string>(PLAYER_W * PLAYER_H).fill('.');

  set(x: number, y: number, ch: string) {
    if (x < 0 || y < 0 || x >= PLAYER_W || y >= PLAYER_H) return;
    this.cells[y * PLAYER_W + x] = ch;
  }

  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= PLAYER_W || y >= PLAYER_H) return '.';
    return this.cells[y * PLAYER_W + x] ?? '.';
  }

  // Tailored clothing uses angular silhouettes rather than rounded capsules.
  polygon(points: readonly Pt[], ch: string, onlyOn?: readonly string[]) {
    const minX = Math.max(
      0,
      Math.floor(Math.min(...points.map((p) => p[0])) * DETAIL)
    );
    const maxX = Math.min(
      PLAYER_W,
      Math.ceil(Math.max(...points.map((p) => p[0])) * DETAIL)
    );
    const minY = Math.max(
      0,
      Math.floor(Math.min(...points.map((p) => p[1])) * DETAIL)
    );
    const maxY = Math.min(
      PLAYER_H,
      Math.ceil(Math.max(...points.map((p) => p[1])) * DETAIL)
    );
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const px = (x + 0.5) / DETAIL;
        const py = (y + 0.5) / DETAIL;
        let inside = false;
        for (let i = 0; i < points.length; i++) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          if (!a || !b) continue;
          if (
            a[1] > py !== b[1] > py &&
            px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]
          )
            inside = !inside;
        }
        if (inside && (!onlyOn || onlyOn.includes(this.get(x, y))))
          this.set(x, y, ch);
      }
    }
  }

  // Every pixel whose centre is within r of the segment a-b.
  capsule(a: Pt, b: Pt, r: number, ch: string) {
    const [ax, ay] = [a[0] * DETAIL, a[1] * DETAIL];
    const [bx, by] = [b[0] * DETAIL, b[1] * DETAIL];
    r *= DETAIL;
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
    this.forEachIn(a, b, r + 1 / DETAIL, (x, y) => {
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
    const [ax, ay] = [a[0] * DETAIL, a[1] * DETAIL];
    const [bx, by] = [b[0] * DETAIL, b[1] * DETAIL];
    r *= DETAIL;
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

  // One dark outline round the whole silhouette (every empty pixel that
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
        if (ch !== '.')
          this.set(
            Math.round(ox * DETAIL) + x,
            Math.round(oy * DETAIL) + y,
            ch
          );
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
  s: 'b',
  b: 'b',
  d: 'd',
  u: 's',
  l: 't',
  c: 'C',
};

const lerp = (a: Pt, b: Pt, t: number): Pt => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const add = (a: Pt, dx: number, dy: number): Pt => [a[0] + dx, a[1] + dy];

// Smaller adult head, drawn in clustered pixels rather than enlarging the old
// face stamp. Coordinates are local to the head; all features travel with neck.
function drawHead(g: Grid, neck: Pt) {
  const at = (x: number, y: number): Pt => add(neck, x - 3.2, y - 7.7);
  const poly = (points: readonly Pt[], ch: string) =>
    g.polygon(
      points.map(([x, y]) => at(x, y)),
      ch
    );
  const line = (a: Pt, b: Pt, r: number, ch: string) =>
    g.capsule(at(...a), at(...b), r, ch);
  // Temple, forehead, cheek and jaw.
  poly(
    [
      [0.8, 2.1],
      [5.5, 1.8],
      [6.1, 2.6],
      [6.2, 4.2],
      [6.55, 4.65],
      [6.1, 5.05],
      [6.1, 6.5],
      [5.4, 7.45],
      [3.5, 7.65],
      [1.4, 6.35],
      [0.8, 4.5],
    ],
    'b'
  );
  poly(
    [
      [2, 2.3],
      [5.5, 2.1],
      [5.9, 3],
      [5.9, 5.55],
      [5.2, 6.2],
      [3.6, 6.4],
      [2, 5.2],
    ],
    's'
  );
  poly(
    [
      [2.6, 2.6],
      [4.7, 2.45],
      [5.4, 3.15],
      [5.1, 3.7],
      [3, 3.5],
    ],
    'u'
  );
  poly(
    [
      [2, 4.65],
      [3.3, 4.55],
      [3.1, 5.4],
      [2.45, 5.6],
    ],
    'u'
  );
  // Visible ear with its inset and lower lobe.
  poly(
    [
      [0.4, 4],
      [1.35, 4],
      [1.75, 4.8],
      [1.4, 5.7],
      [0.5, 5.4],
    ],
    's'
  );
  poly(
    [
      [0.75, 4.35],
      [1.2, 4.3],
      [1.35, 5.15],
      [0.9, 5.1],
    ],
    'd'
  );
  line([0.8, 4.2], [1.15, 4.2], 0.12, 'u');
  // Swept hair: a dark undercut, brown masses and copper highlight clusters.
  poly(
    [
      [0.2, 4.1],
      [0, 2.4],
      [0.6, 1.7],
      [1.5, 1],
      [2.1, 0.65],
      [3.7, 0.4],
      [4.3, 0],
      [5.7, 0.15],
      [6.5, 0.55],
      [6.2, 1.3],
      [5.6, 1.8],
      [3, 2],
      [2.2, 2.65],
      [1.6, 3.3],
      [1.4, 4.2],
    ],
    'H'
  );
  poly(
    [
      [0.5, 2.2],
      [1.5, 1.4],
      [3, 0.8],
      [5.3, 0.55],
      [6.15, 0.8],
      [5.7, 1.25],
      [3.3, 1.35],
      [2.2, 1.9],
      [1.2, 2.9],
      [0.4, 3.2],
    ],
    'h'
  );
  poly(
    [
      [1.2, 1.8],
      [2.4, 1.15],
      [3.9, 0.8],
      [5.4, 0.8],
      [4.9, 1.1],
      [3.2, 1.15],
      [2.4, 1.55],
    ],
    'j'
  );
  poly(
    [
      [0.6, 3.1],
      [1.2, 2.55],
      [1.8, 2.65],
      [1.4, 3.6],
      [0.7, 3.9],
    ],
    'h'
  );
  // Brows and white eyes with dark pupils (three-quarter view).
  line([2.7, 3.9], [3.65, 3.85], 0.18, 'd');
  line([5.1, 3.85], [5.8, 3.85], 0.18, 'd');
  poly(
    [
      [2.8, 4.05],
      [3.65, 4.05],
      [3.65, 4.6],
      [2.8, 4.6],
    ],
    'f'
  );
  poly(
    [
      [3.1, 4.05],
      [3.65, 4.05],
      [3.65, 4.6],
      [3.1, 4.6],
    ],
    'e'
  );
  poly(
    [
      [5.2, 4],
      [5.9, 4],
      [5.9, 4.5],
      [5.2, 4.5],
    ],
    'f'
  );
  poly(
    [
      [5.5, 4],
      [5.9, 4],
      [5.9, 4.5],
      [5.5, 4.5],
    ],
    'e'
  );
  // Nose bridge, bright tip, nostril and cheek shadow.
  poly(
    [
      [4.65, 4.15],
      [4.9, 4.25],
      [4.9, 5],
      [5.3, 5.2],
      [4.85, 5.45],
      [4.5, 5.15],
    ],
    'b'
  );
  poly(
    [
      [4.9, 4.6],
      [5.25, 4.6],
      [5.55, 5.05],
      [5.2, 5.15],
      [4.9, 4.95],
    ],
    'u'
  );
  line([4.8, 5.3], [5.25, 5.3], 0.12, 'd');
  // Short beard around the cheek, jaw and chin; mouth stays readable inside it.
  poly(
    [
      [1.6, 5.2],
      [2.2, 5.7],
      [3.2, 6.3],
      [4.2, 5.95],
      [5.8, 5.65],
      [6, 6.5],
      [5.25, 7.4],
      [3.65, 7.55],
      [2.4, 6.8],
      [1.65, 6],
    ],
    'd'
  );
  poly(
    [
      [2.4, 6.15],
      [3.3, 6.65],
      [4, 6.35],
      [5.55, 6.2],
      [5.5, 7],
      [4.9, 7.25],
      [3.8, 7.2],
      [2.8, 6.7],
    ],
    'h'
  );
  poly(
    [
      [4.1, 6.2],
      [5.55, 6.05],
      [5.55, 6.65],
      [4.3, 6.85],
      [3.95, 6.6],
    ],
    's'
  );
  line([4.55, 6.45], [5.1, 6.45], 0.12, 'm');
  line([4.3, 7.1], [5.1, 7], 0.12, 'j');
}

// Shorts at the top of the thigh, skin to the knee, socks down the shin,
// a boot along the foot. The far leg uses the shade colours; the near one
// gets a rim where it crosses the body.
function drawLeg(g: Grid, hip: Pt, leg: Leg, back: boolean) {
  const shorts = back ? 'W' : 'w';
  const socks = back ? 'C' : 'c';
  const draw = (a: Pt, b: Pt, r: number, ch: string) =>
    back ? g.capsule(a, b, r, ch) : g.front(a, b, r, ch);
  const thighMid = lerp(hip, leg.knee, 0.68);
  const sockTop = lerp(leg.knee, leg.ankle, 0.3);
  draw(hip, thighMid, 1.8, shorts);
  g.capsule(add(hip, 0.4, 0), add(thighMid, 0.4, -0.1), 0.65, back ? 'w' : 'l');
  g.capsule(add(thighMid, -0.6, 0), add(thighMid, 0.6, 0), 0.2, 'W');
  draw(thighMid, leg.knee, 1.15, 'b');
  g.capsule(
    add(thighMid, 0.35, 0),
    add(leg.knee, 0.35, 0),
    0.7,
    back ? 'b' : 's'
  );
  g.capsule(leg.knee, sockTop, 1.05, 'b');
  g.capsule(
    add(leg.knee, 0.3, 0),
    add(sockTop, 0.3, 0),
    0.65,
    back ? 'b' : 's'
  );
  g.capsule(sockTop, leg.ankle, 1.2, 'C');
  g.capsule(add(sockTop, 0.3, 0), add(leg.ankle, 0.3, 0), 0.8, socks);
  const band = lerp(sockTop, leg.ankle, 0.08);
  g.capsule(band, lerp(sockTop, leg.ankle, 0.15), 1.2, back ? 'C' : 'l');
  g.capsule(
    lerp(sockTop, leg.ankle, 0.23),
    lerp(sockTop, leg.ankle, 0.28),
    1.2,
    'T'
  );
  g.capsule(leg.ankle, leg.toe, 1.3, 'k');
  g.capsule(add(leg.ankle, 0, -0.35), add(leg.toe, 0, -0.35), 1, 'q');
  g.capsule(add(leg.ankle, 0, -0.5), add(leg.toe, 0, -0.5), 0.65, 'f');
  const lace = lerp(leg.ankle, leg.toe, 0.45);
  g.capsule(lace, add(lace, 0.45, 0), 0.3, 'q');
}

// Short sleeve, then skin to the hand; the near arm wears the armband.
function drawArm(g: Grid, shoulder: Pt, arm: Arm, back: boolean) {
  const draw = (a: Pt, b: Pt, r: number, ch: string) =>
    back ? g.capsule(a, b, r, ch) : g.front(a, b, r, ch);
  const sleeveEnd = lerp(shoulder, arm.elbow, 0.45);
  draw(shoulder, sleeveEnd, 1.5, back ? 'T' : 't');
  draw(sleeveEnd, arm.elbow, 1.1, 'b');
  draw(arm.elbow, arm.hand, 1, 'b');
  g.capsule(
    add(sleeveEnd, 0.3, -0.15),
    add(arm.elbow, 0.3, -0.15),
    0.75,
    back ? 'b' : 's'
  );
  g.capsule(
    add(arm.elbow, 0.3, -0.15),
    add(arm.hand, 0.3, -0.15),
    0.7,
    back ? 'b' : 's'
  );
  g.capsule(arm.hand, add(arm.hand, 0.4, 0.5), 1, back ? 'b' : 's');
  // Sleeve highlight and a small wrist/knuckle shadow.
  g.capsule(
    add(shoulder, 0.2, -0.35),
    add(sleeveEnd, 0.2, -0.35),
    0.4,
    back ? 't' : 'l'
  );
  g.capsule(add(arm.hand, -0.3, 0.5), add(arm.hand, 0.4, 0.5), 0.3, 'd');
  g.capsule(add(arm.hand, 0.2, -0.2), add(arm.hand, 0.2, 0.65), 0.12, 'b');
  g.capsule(
    lerp(shoulder, arm.elbow, 0.5),
    lerp(shoulder, arm.elbow, 0.55),
    1.1,
    'a'
  );
  if (!back) {
    const band = lerp(shoulder, arm.elbow, 0.4);
    g.capsule(band, lerp(shoulder, arm.elbow, 0.5), 1.1, 'a');
    const badge = lerp(shoulder, arm.elbow, 0.45);
    g.capsule(add(badge, 0.6, -0.1), add(badge, 0.6, 0.35), 0.22, 'f');
  }
}

// Back to front: far arm and leg, shorts, shirt (shaded at the back), near
// leg, neck, head, near arm; then one outline round the silhouette.
function drawPose(p: Pose) {
  // Visual proportions only: lengthen the jersey and reduce the head, while
  // feet, movement and the animation skeleton's leg/arm endpoints stay put.
  p = { ...p, neck: add(p.neck, 0, -1.2) };
  const g = new Grid();
  const shoulderBack = add(p.neck, -2.8, 2);
  const shoulderFront = add(p.neck, 2.8, 2);
  drawArm(g, shoulderBack, p.backArm, true);
  drawLeg(g, p.hip, p.backLeg, true);
  g.polygon(
    [
      add(p.hip, -3.4, -1),
      add(p.hip, 3.4, -1),
      add(p.hip, 3.7, 2.2),
      add(p.hip, 0.5, 2.2),
      add(p.hip, 0, 1),
      add(p.hip, -0.6, 2.2),
      add(p.hip, -3.5, 2.2),
    ],
    'W'
  );
  g.polygon(
    [
      add(p.hip, -2.8, -0.7),
      add(p.hip, 3, -0.7),
      add(p.hip, 3.2, 1.9),
      add(p.hip, 0.7, 1.9),
      add(p.hip, 0, 0.4),
      add(p.hip, -1, 1.8),
      add(p.hip, -2.9, 1.9),
    ],
    'w'
  );
  const chest = add(p.neck, 0, 2);
  g.polygon(
    [
      add(p.neck, -1.7, 0.6),
      add(p.neck, 1.7, 0.6),
      add(chest, 4, -0.3),
      add(chest, 3.6, 1.6),
      add(p.hip, 3, -0.5),
      add(p.hip, -3.1, -0.5),
      add(chest, -3.7, 1.6),
      add(chest, -4, -0.3),
    ],
    't'
  );
  // Shade the back of the shirt (the light comes from the front).
  for (let y = 0; y < PLAYER_H; y++) {
    const t = (y / DETAIL - chest[1]) / (p.hip[1] - 1 - chest[1]);
    if (t < -0.4 || t > 1.3) continue;
    const axis = chest[0] + (p.hip[0] - chest[0]) * Math.max(0, Math.min(1, t));
    for (let x = 0; x < PLAYER_W; x++)
      if (g.get(x, y) === 't') {
        const across = (x + 0.5) / DETAIL - axis;
        if (across < -2.3) g.set(x, y, 'T');
        else if (across > -1.3 && across < 1.7 && t < 0.85) g.set(x, y, 'l');
      }
  }
  // Reference kit: dark piping, chest mark, sponsor bar and straight hem.
  g.capsule(add(p.neck, -1.5, 0.7), add(p.neck, 0, 1.7), 0.3, 'a');
  g.capsule(add(p.neck, 0, 1.7), add(p.neck, 1.5, 0.7), 0.3, 'a');
  const cloth = ['t', 'T', 'l'];
  const fold = (points: readonly Pt[], ch: string) =>
    g.polygon(
      points.map(([x, y]) => add(chest, x, y)),
      ch,
      cloth
    );
  fold(
    [
      [-2.9, 0.3],
      [-1.8, 0.8],
      [-2.5, 1.5],
      [-1.5, 2.4],
      [-2.3, 2.1],
      [-3, 1.1],
    ],
    't'
  );
  fold(
    [
      [-1.7, 1.6],
      [-1.1, 1.2],
      [-0.5, 0.5],
      [-0.8, 1.7],
      [-1.4, 2.2],
    ],
    't'
  );
  fold(
    [
      [2.2, 1],
      [2.9, 1.5],
      [2.5, 2.5],
      [1.9, 2.8],
      [2.4, 1.8],
    ],
    't'
  );
  fold(
    [
      [-2.4, 3],
      [-2.1, 4.1],
      [-0.5, 5],
      [-1.5, 4.8],
      [-2.7, 4],
    ],
    'T'
  );
  fold(
    [
      [2.6, 3.4],
      [2.2, 4.5],
      [1, 5.1],
      [0.2, 5.1],
      [1.6, 4.3],
      [2.3, 3],
    ],
    'T'
  );
  fold(
    [
      [-1.6, 4.6],
      [-0.5, 5.3],
      [1, 5.4],
      [1.9, 5.1],
      [1.1, 5.8],
      [-0.7, 5.6],
    ],
    't'
  );
  g.capsule(add(chest, -0.5, 2.6), add(chest, 1.9, 2.6), 0.3, 'a');
  g.stamp(['aa', 'a.'], chest[0] + 1.8, chest[1] + 0.8);
  g.capsule(add(p.hip, -1.7, -2), add(p.hip, -0.2, -2.5), 0.25, 'T');
  g.capsule(add(p.hip, -1.6, -0.5), add(p.hip, 1.8, -0.5), 0.3, 'T');
  drawLeg(g, p.hip, p.frontLeg, false);
  g.capsule(p.neck, add(p.neck, 0, 1), 1, 'b');
  drawHead(g, p.neck);
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
const UP_FRAMES = Array.from({ length: 4 }, (_, i) => `run_up${i + 1}`);
const DOWN_FRAMES = Array.from({ length: 4 }, (_, i) => `run_down${i + 1}`);
const UP_DIAGONAL_FRAMES = Array.from(
  { length: 4 },
  (_, i) => `run_up_diagonal${i + 1}`
);
const DOWN_DIAGONAL_FRAMES = Array.from(
  { length: 4 },
  (_, i) => `run_down_diagonal${i + 1}`
);
const TACKLE_FRAMES = Array.from({ length: 8 }, (_, i) => `tackle${i + 1}`);
const DIVE_FRAMES = Array.from({ length: 6 }, (_, i) => `dive${i + 1}`);
const HOLD_FRAMES = Array.from({ length: 4 }, (_, i) => `hold${i + 1}`);
const HURT_FRAMES = Array.from({ length: 4 }, (_, i) => `hurt${i + 1}`);
const CARRY_FRAMES = Array.from({ length: 6 }, (_, i) => `carry${i + 1}`);
// Goal celebrations (see CELEBRATIONS): six poses each.
const CELEBRATION_FRAMES = ['a', 'b', 'c'].map((set) =>
  Array.from({ length: 6 }, (_, i) => `celebrate_${set}${i + 1}`)
);
const ATLAS_COLUMNS = 16;
const FRAMES = [
  ...Object.keys(POSES),
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
const RUN_FRAMES = Array.from({ length: 8 }, (_, i) => `run${i + 1}`);
const SHOOT_FRAMES = [
  'shoot_windup',
  'shoot_contact',
  'shoot_follow',
  'shoot_recover',
];

// The standing frame (also what a stopped animation falls back to).
export const IDLE_FRAME = 'idle1';
export const AUTHORED_IDLE_TEXTURE = 'player-idle-authored-source';
export const AUTHORED_RUN_TEXTURE = 'player-run-authored-source';
export const AUTHORED_SHOOT_TEXTURE = 'player-shoot-authored-source';
export const AUTHORED_RUN_UP_TEXTURE = 'player-run-up-authored-source';
export const AUTHORED_RUN_DOWN_TEXTURE = 'player-run-down-authored-source';
export const AUTHORED_RUN_UP_DIAGONAL_TEXTURE =
  'player-run-up-diagonal-authored-source';
export const AUTHORED_RUN_DOWN_DIAGONAL_TEXTURE =
  'player-run-down-diagonal-authored-source';
export const AUTHORED_TACKLE_TEXTURE = 'player-tackle-authored-source';
export const AUTHORED_DIVE_TEXTURE = 'player-dive-authored-source';
export const AUTHORED_HOLD_TEXTURE = 'player-hold-authored-source';
export const AUTHORED_HURT_TEXTURE = 'player-hurt-authored-source';
export const AUTHORED_CARRY_TEXTURE = 'player-carry-authored-source';
// Goal celebrations: fists and jump, knee slide, dance. Each a 3 x 2
// sheet of 720 x 724 cells (wide for outstretched arms), ground 681.
export const CELEBRATIONS = [
  { file: 'player-celebrate-authored.webp', key: 'player-celebrate-a-source' },
  { file: 'player-celebrate2-authored.webp', key: 'player-celebrate-b-source' },
  { file: 'player-celebrate3-authored.webp', key: 'player-celebrate-c-source' },
] as const;
const CELEBRATE_SOURCE_W = 720;
// Shirt hem / shorts hem (cell y) per pose, for the kit recolour.
const CELEBRATION_WAIST = [
  [448, 440, 385, 350, 446, 418],
  [400, 508, 525, 505, 518, 515],
  [414, 410, 400, 405, 399, 405],
];
const CELEBRATION_SHORTS_END = [
  [525, 520, 478, 428, 522, 503],
  [470, 600, 603, 600, 605, 605],
  [497, 491, 486, 491, 486, 491],
];
const IDLE_SOURCE_W = 352;
const IDLE_SOURCE_H = 724;
const IDLE_SOURCE_GROUND = 695;

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
  accent: number;
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
    accent: PAL.ink,
  },
  away: {
    shirt: PAL.kitBlue,
    shirtShade: PAL.kitBlueShade,
    shirtHighlight: PAL.kitBlueLight,
    shorts: PAL.kitBlueShade,
    shortsShade: PAL.ink,
    socks: PAL.kitBlue,
    sockShade: PAL.kitBlueShade,
    accent: PAL.ink,
  },
  homeKeeper: {
    shirt: PAL.kitGreen,
    shirtShade: PAL.kitGreenShade,
    shirtHighlight: PAL.kitGreenLight,
    shorts: PAL.ink,
    shortsShade: PAL.black,
    socks: PAL.kitGreen,
    sockShade: PAL.kitGreenShade,
    accent: PAL.ink,
  },
  awayKeeper: {
    shirt: PAL.kitGold,
    shirtShade: PAL.kitGoldShade,
    shirtHighlight: PAL.kitGoldLight,
    shorts: PAL.ink,
    shortsShade: PAL.black,
    socks: PAL.kitGold,
    sockShade: PAL.kitGoldShade,
    accent: PAL.ink,
  },
};
const KIT_NAMES: readonly Kit[] = ['home', 'away', 'homeKeeper', 'awayKeeper'];

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
export const PLAYER_SKIN_TEXTURE = 'player-skin';
export const PLAYER_HAIR_TEXTURE = 'player-hair';
// Brightness (0-255 luma) that maps to the full tint: about the lightest
// common skin / hair tone in the authored art. Brighter pixels clamp.
const SKIN_REF_LUMA = 187;
const HAIR_REF_LUMA = 80;

export const playerTexture = (kit: Kit) => `player-${kit}`;
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

// Soft oval shadow on the ground under the feet, in every frame.
function paintShadow(ctx: CanvasRenderingContext2D, ox: number) {
  const cx = ox + PLAYER_W / 2;
  const cy = (GROUND + 1) * DETAIL;
  for (let y = GROUND * DETAIL; y < PLAYER_H; y++)
    for (let x = ox; x < ox + PLAYER_W; x++) {
      const nx = (x + 0.5 - cx) / (7 * DETAIL);
      const ny = (y + 0.5 - cy) / (1.6 * DETAIL);
      if (nx * nx + ny * ny <= 1) fill(ctx, x, y, 1, 1, PAL.black, 0.3);
    }
}

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
// Per dive frame: crouch, launch x2, full stretch x2, landed.
const DIVE_KIT_SPLITS: readonly KitSplit[] = [
  DIVE_CROUCH,
  DIVE_LAUNCH,
  DIVE_LAUNCH,
  DIVE_STRETCH,
  DIVE_STRETCH,
  DIVE_LANDED,
];
function pastLine(l: SplitLine, x: number, y: number) {
  const [x1, y1, x2, y2] = l;
  return (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1) > 0;
}

// Use the supplied pixels for idle. Recolor only the pink clothing; skin,
// hair, dark trim and white boots retain the original shading and colors.
function authoredIdleSheet(
  scene: Phaser.Scene,
  kitName: Kit,
  action:
    | 'idle'
    | 'run'
    | 'shoot'
    | 'up'
    | 'down'
    | 'up-diagonal'
    | 'down-diagonal'
    | 'tackle'
    | 'dive'
    | 'hold'
    | 'hurt'
    | 'carry'
    | 'celebrate0'
    | 'celebrate1'
    | 'celebrate2' = 'idle'
) {
  const running = action === 'run';
  const shooting = action === 'shoot';
  const tackling = action === 'tackle';
  const carrying = action === 'carry';
  const celebration =
    action === 'celebrate0'
      ? 0
      : action === 'celebrate1'
        ? 1
        : action === 'celebrate2'
          ? 2
          : -1;
  const celebrating = celebration >= 0;
  const diving = action === 'dive' || action === 'hurt';
  const textureKeys = {
    idle: AUTHORED_IDLE_TEXTURE,
    run: AUTHORED_RUN_TEXTURE,
    shoot: AUTHORED_SHOOT_TEXTURE,
    up: AUTHORED_RUN_UP_TEXTURE,
    down: AUTHORED_RUN_DOWN_TEXTURE,
    'up-diagonal': AUTHORED_RUN_UP_DIAGONAL_TEXTURE,
    'down-diagonal': AUTHORED_RUN_DOWN_DIAGONAL_TEXTURE,
    tackle: AUTHORED_TACKLE_TEXTURE,
    dive: AUTHORED_DIVE_TEXTURE,
    hold: AUTHORED_HOLD_TEXTURE,
    hurt: AUTHORED_HURT_TEXTURE,
    carry: AUTHORED_CARRY_TEXTURE,
    celebrate0: CELEBRATIONS[0].key,
    celebrate1: CELEBRATIONS[1].key,
    celebrate2: CELEBRATIONS[2].key,
  };
  const textureKey = textureKeys[action];
  const frameWidth = diving
    ? 1152
    : tackling
      ? 1024
      : celebrating
        ? CELEBRATE_SOURCE_W
        : action === 'idle'
          ? IDLE_SOURCE_W
          : 640;
  if (!scene.textures.exists(textureKey))
    throw new Error('Authored idle artwork was not loaded by BootScene');
  const source = scene.textures.get(textureKey).getSourceImage();
  if (!(
    source instanceof HTMLImageElement || source instanceof HTMLCanvasElement
  ))
    throw new Error('Authored idle artwork must be an image or canvas');
  // Home uses the source pixels directly; only alternate kits need a copy.
  if (kitName === 'home') return source;
  const canvas = document.createElement('canvas');
  const sourceColumns =
    carrying || celebrating || action === 'dive' ? 3 : diving ? 2 : 4;
  canvas.width = frameWidth * sourceColumns;
  canvas.height =
    IDLE_SOURCE_H *
    (tackling || running || diving || carrying || celebrating ? 2 : 1);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the authored idle artwork');
  ctx.drawImage(source, 0, 0);
  const kit = KITS[kitName];
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const vertical =
    action === 'up' ||
    action === 'down' ||
    action === 'up-diagonal' ||
    action === 'down-diagonal';
  const waist = celebrating
    ? (CELEBRATION_WAIST[celebration] ?? [])
    : carrying
      ? [375, 365, 375, 368, 360, 368]
      : diving
        ? [427, 422, 500, 586] // hurt; the dive uses DIVE_KIT_SPLITS
        : tackling
          ? [395, 450, 540, 555, 535, 455, 445, 400]
          : vertical
            ? [376, 379, 376, 379]
            : running
              ? [399, 388, 389, 388, 392, 379, 395, 377]
              : shooting
                ? [391, 405, 443, 396]
                : [446, 430, 449, 449];
  const shortsEnd = celebrating
    ? (CELEBRATION_SHORTS_END[celebration] ?? [])
    : carrying
      ? [499, 490, 499, 491, 493, 493]
      : diving
        ? [544, 539, 608, 655]
        : tackling
          ? [520, 565, 630, 640, 635, 605, 580, 540]
          : vertical
            ? [480, 489, 480, 489]
            : running
              ? [510, 494, 508, 494, 513, 492, 513, 495]
              : shooting
                ? [517, 529, 486, 517]
                : [552, 536, 555, 555];
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i] ?? 0;
    const g = pixels.data[i + 1] ?? 0;
    const b = pixels.data[i + 2] ?? 0;
    // The dive sheet's shaded pink is deeper (less blue); skin never passes
    // since its blue stays below its green.
    const minBlue = action === 'dive' || celebrating ? 0.4 : 0.55;
    if (
      !pixels.data[i + 3] ||
      r < 70 ||
      r < g * 1.25 ||
      b < g * 1.08 ||
      b < r * minBlue
    )
      continue;
    const sourceY = Math.floor(i / 4 / canvas.width);
    const y = sourceY % IDLE_SOURCE_H;
    const frame =
      Math.floor(((i / 4) % canvas.width) / frameWidth) +
      (tackling || running || diving || carrying || celebrating
        ? Math.floor(sourceY / IDLE_SOURCE_H) * sourceColumns
        : 0);
    const diveCell = action === 'dive' ? DIVE_KIT_SPLITS[frame] : undefined;
    const x = ((i / 4) % canvas.width) % frameWidth;
    const isShirt = diveCell
      ? !pastLine(diveCell.waist, x, y)
      : y < (waist[frame] ?? 446);
    const isShorts =
      !isShirt &&
      (diveCell
        ? !pastLine(diveCell.shortsEnd, x, y)
        : y < (shortsEnd[frame] ?? 552));
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
    for (let channel = 0; channel < 3; channel++) {
      const shift = 16 - channel * 8;
      const a = (low >> shift) & 255;
      const z = (high >> shift) & 255;
      pixels.data[i + channel] = Math.round(a + (z - a) * mix);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

// Frame rects of the player atlas (shared by every kit and the look layers).
function atlasFrames() {
  return FRAMES.map((name, i) => ({
    name,
    x: (i % ATLAS_COLUMNS) * PLAYER_W,
    y: Math.floor(i / ATLAS_COLUMNS) * PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
  }));
}

// 1 = skin, 2 = hair or beard, 0 = anything else. Skin and hair are the
// warm tones (red > green > blue); kit pink has more blue than green and the
// dark outline is too dark. Hair is the darker, less blue part of them.
function lookPart(r: number, g: number, b: number, a: number) {
  if (a < 128 || r < 80 || r < g * 1.2 || g < b * 1.05) return 0;
  return r >= 150 && b >= r * 0.22 ? 1 : 2;
}

// Grey skin and hair layers built from the home atlas: each part pixel
// keeps its brightness relative to the reference, ready to be tinted.
// A pixel goes with the part most of its neighbours belong to, so copper
// highlights in the hair stay hair and stray dark specks on skin stay skin.
function createLookLayers(scene: Phaser.Scene) {
  if (scene.textures.exists(PLAYER_SKIN_TEXTURE)) return;
  const source = scene.textures.get(playerTexture('home')).getSourceImage();
  if (!(source instanceof HTMLCanvasElement))
    throw new Error('The player atlas must be a canvas');
  const ctx = source.getContext('2d');
  if (!ctx) throw new Error('Could not read the player atlas');
  const w = source.width;
  const h = source.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const parts = new Uint8Array(w * h);
  for (let i = 0; i < parts.length; i++)
    parts[i] = lookPart(
      data[i * 4] ?? 0,
      data[i * 4 + 1] ?? 0,
      data[i * 4 + 2] ?? 0,
      data[i * 4 + 3] ?? 0
    );
  const skin = new ImageData(w, h);
  const hair = new ImageData(w, h);
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
  makeTexture(
    scene,
    PLAYER_SKIN_TEXTURE,
    w,
    h,
    (layer) => layer.putImageData(skin, 0, 0),
    atlasFrames()
  );
  makeTexture(
    scene,
    PLAYER_HAIR_TEXTURE,
    w,
    h,
    (layer) => layer.putImageData(hair, 0, 0),
    atlasFrames()
  );
}

export function createPlayerTextures(scene: Phaser.Scene) {
  const frameRows = FRAMES.map((f) => {
    const pose = POSES[f];
    return pose ? drawPose(pose) : [];
  });
  for (const kitName of KIT_NAMES) {
    if (scene.textures.exists(playerTexture(kitName))) continue;
    const idleSheet = authoredIdleSheet(scene, kitName);
    const tackleSheet = authoredIdleSheet(scene, kitName, 'tackle');
    const diveSheet = authoredIdleSheet(scene, kitName, 'dive');
    const holdSheet = authoredIdleSheet(scene, kitName, 'hold');
    const hurtSheet = authoredIdleSheet(scene, kitName, 'hurt');
    const carrySheet = authoredIdleSheet(scene, kitName, 'carry');
    const celebrateSheets = [
      authoredIdleSheet(scene, kitName, 'celebrate0'),
      authoredIdleSheet(scene, kitName, 'celebrate1'),
      authoredIdleSheet(scene, kitName, 'celebrate2'),
    ];
    const runSheet = authoredIdleSheet(scene, kitName, 'run');
    const shootSheet = authoredIdleSheet(scene, kitName, 'shoot');
    const upSheet = authoredIdleSheet(scene, kitName, 'up');
    const downSheet = authoredIdleSheet(scene, kitName, 'down');
    const upDiagonalSheet = authoredIdleSheet(scene, kitName, 'up-diagonal');
    const downDiagonalSheet = authoredIdleSheet(
      scene,
      kitName,
      'down-diagonal'
    );
    const kit = KITS[kitName];
    const palette = {
      k: PAL.ink,
      h: PAL.hairMid,
      H: PAL.hairDark,
      j: PAL.hairLight,
      s: PAL.skinLight,
      b: PAL.skinMid,
      d: PAL.skinDark,
      u: PAL.skinHighlight,
      e: PAL.hairDark,
      m: PAL.hairDark,
      q: PAL.lightGray,
      t: kit.shirt,
      l: kit.shirtHighlight,
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
      PLAYER_W * ATLAS_COLUMNS,
      PLAYER_H * Math.ceil(FRAMES.length / ATLAS_COLUMNS),
      (ctx) => {
        frameRows.forEach((rows, i) => {
          ctx.save();
          ctx.translate(
            (i % ATLAS_COLUMNS) * PLAYER_W,
            Math.floor(i / ATLAS_COLUMNS) * PLAYER_H
          );
          paintShadow(ctx, 0);
          const tackling = TACKLE_FRAMES.includes(FRAMES[i] ?? '');
          const hurting = HURT_FRAMES.includes(FRAMES[i] ?? '');
          const diving = DIVE_FRAMES.includes(FRAMES[i] ?? '') || hurting;
          const carrying = CARRY_FRAMES.includes(FRAMES[i] ?? '');
          const celebration = CELEBRATION_FRAMES.findIndex((set) =>
            set.includes(FRAMES[i] ?? '')
          );
          const celebrating = celebration >= 0;
          const holding = HOLD_FRAMES.includes(FRAMES[i] ?? '') || carrying;
          const running = RUN_FRAMES.includes(FRAMES[i] ?? '');
          const shooting = SHOOT_FRAMES.includes(FRAMES[i] ?? '');
          const up = UP_FRAMES.includes(FRAMES[i] ?? '');
          const down = DOWN_FRAMES.includes(FRAMES[i] ?? '');
          const upDiagonal = UP_DIAGONAL_FRAMES.includes(FRAMES[i] ?? '');
          const downDiagonal = DOWN_DIAGONAL_FRAMES.includes(FRAMES[i] ?? '');
          const vertical = up || down || upDiagonal || downDiagonal;
          if (
            FRAMES[i]?.startsWith('idle') ||
            running ||
            shooting ||
            vertical ||
            tackling ||
            diving ||
            holding ||
            celebrating
          ) {
            const sourceFrame = celebrating
              ? (CELEBRATION_FRAMES[celebration]?.indexOf(FRAMES[i] ?? '') ?? 0)
              : carrying
                ? CARRY_FRAMES.indexOf(FRAMES[i] ?? '')
                : hurting
                  ? HURT_FRAMES.indexOf(FRAMES[i] ?? '')
                  : holding
                    ? HOLD_FRAMES.indexOf(FRAMES[i] ?? '')
                    : diving
                      ? DIVE_FRAMES.indexOf(FRAMES[i] ?? '')
                      : tackling
                        ? TACKLE_FRAMES.indexOf(FRAMES[i] ?? '')
                        : downDiagonal
                          ? DOWN_DIAGONAL_FRAMES.indexOf(FRAMES[i] ?? '')
                          : upDiagonal
                            ? UP_DIAGONAL_FRAMES.indexOf(FRAMES[i] ?? '')
                            : up
                              ? UP_FRAMES.indexOf(FRAMES[i] ?? '')
                              : down
                                ? DOWN_FRAMES.indexOf(FRAMES[i] ?? '')
                                : shooting
                                  ? SHOOT_FRAMES.indexOf(FRAMES[i] ?? '')
                                  : Number(FRAMES[i]?.slice(running ? 3 : 4)) -
                                    1;
            const sourceWidth = diving
              ? 1152
              : tackling
                ? 1024
                : celebrating
                  ? CELEBRATE_SOURCE_W
                  : running || shooting || vertical || holding
                    ? 640
                    : IDLE_SOURCE_W;
            const height = PLAYER_H;
            const width = (sourceWidth / IDLE_SOURCE_H) * height;
            const sourceColumns =
              carrying || celebrating || (diving && !hurting)
                ? 3
                : diving
                  ? 2
                  : 4;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
              celebrating
                ? (celebrateSheets[celebration] ?? idleSheet)
                : carrying
                  ? carrySheet
                  : hurting
                    ? hurtSheet
                    : holding
                      ? holdSheet
                      : diving
                        ? diveSheet
                        : tackling
                          ? tackleSheet
                          : downDiagonal
                            ? downDiagonalSheet
                            : upDiagonal
                              ? upDiagonalSheet
                              : up
                                ? upSheet
                                : down
                                  ? downSheet
                                  : running
                                    ? runSheet
                                    : shooting
                                      ? shootSheet
                                      : idleSheet,
              (sourceFrame % sourceColumns) * sourceWidth,
              tackling || running || diving || carrying || celebrating
                ? Math.floor(sourceFrame / sourceColumns) * IDLE_SOURCE_H
                : 0,
              sourceWidth,
              IDLE_SOURCE_H,
              (PLAYER_W - width) / 2,
              PLAYER_H * PLAYER_ORIGIN_Y -
                ((running ||
                shooting ||
                vertical ||
                tackling ||
                diving ||
                holding ||
                celebrating
                  ? 681
                  : IDLE_SOURCE_GROUND) /
                  IDLE_SOURCE_H) *
                  height,
              width,
              height
            );
          } else {
            paintRows(ctx, rows, palette, 0, 0);
          }
          ctx.restore();
        });
      },
      atlasFrames()
    );
    if (!created) continue;
    const frames = (names: string[]) => names.map((frame) => ({ key, frame }));
    scene.anims.create({
      key: holdAnim(kitName, true),
      frames: frames(CARRY_FRAMES),
      frameRate: 12,
      repeat: -1,
    });
    scene.anims.create({
      key: holdAnim(kitName),
      frames: frames(HOLD_FRAMES),
      frameRate: 4,
      repeat: -1,
    });
    // Standing: a slow weight shift.
    scene.anims.create({
      key: idleAnim(kitName),
      frames: frames(['idle1', 'idle2', 'idle3', 'idle4']),
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
    const verticalViews: readonly RunView[] = [
      'up',
      'down',
      'up-diagonal',
      'down-diagonal',
    ];
    for (const view of verticalViews) {
      scene.anims.create({
        key: runAnim(kitName, view),
        frames: frames(
          view === 'up'
            ? UP_FRAMES
            : view === 'down'
              ? DOWN_FRAMES
              : view === 'up-diagonal'
                ? UP_DIAGONAL_FRAMES
                : DOWN_DIAGONAL_FRAMES
        ),
        frameRate: RUN_FPS / 2,
        repeat: -1,
      });
    }
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
    // Goal celebrations by the scorer: six poses each, on a loop.
    CELEBRATION_FRAMES.forEach((set, style) =>
      scene.anims.create({
        key: celebrateAnim(kitName, style),
        frames: frames(set),
        frameRate: 6,
        repeat: -1,
      })
    );
  }
  createLookLayers(scene);

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
