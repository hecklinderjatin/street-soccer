import Phaser from 'phaser';
import { BALL, FREE_KICK as FK, PITCH } from '../../shared/tuning';
import {
  BALL_FRAMES,
  BALL_KEY,
  BALL_SHADOW_KEY,
  BALL_SHOT_FRAMES,
  BALL_TEXTURE_W,
} from '../art/ballArt';
import {
  BACKDROP_KEY,
  BACKDROP_WALL_V,
  CAP_KEY,
  FENCE_KEY,
  GROUND_EXTENT,
  GROUND_KEY,
} from '../art/pitchArt';
import {
  LOOKS,
  PLAYER_HAIR_TEXTURE,
  PLAYER_ORIGIN_Y,
  PLAYER_PX,
  PLAYER_SKIN_TEXTURE,
  playerTexture,
  type Kit,
  type Look,
} from '../art/playerArt';
import { ProjectedPlane, type PlaneCorners } from '../render/ProjectedPlane';
import { newProjected } from '../render/Projector';
import { PAL, PX } from '../ui/palette';
import type { KickCamera } from './KickCamera';
import { drawRibbon, type RibbonLayer, type RibbonPoint } from './ribbon';
import {
  BAR_Z,
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  type KickPlay,
  type KickSetup,
} from './rules';

// Draw order: the ground, then the far wall and fence beyond the court,
// then everything else by distance down the pitch (depth = -x), so the
// kicker covers the ball, the ball covers the wall it flies past, the
// keeper stands in front of the frame and the net is behind it all.
const DEPTH_GROUND = -10_000_000;
const DEPTH_LINES = DEPTH_GROUND + 1;
const DEPTH_FAR = -1_000_000;
const DEPTH_SKY = DEPTH_GROUND - 1;
const SKY_TOP = 0x0d1533; // night sky overhead ...
const SKY_LOW = 0x4b3463; // ... to the city glow at the horizon
const SKYLINE_SCALE = 2.6; // the far skyline: the facade this much bigger ...
const SKYLINE_BEYOND = 900; // ... this far past the end of the street ...
const SKYLINE_SIDE = 1500; // ... reaching this far out either side ...
const SKYLINE_SHADE = 0x59648f; // ... tinted into the night
const NET_BACK_X = GOAL_X + FK.goalDepth;
const R = BALL.radius;
const NET_SHADE = 0x1d2b53; // the net's inside is shaded dark
const MAX_ROLL_PX_PER_SEC = 14 * 30; // the ball's spin frames change at most 30 times a second (as the match)

export const TRAIL_COLOR = 0xc8ff2a; // the glowing yellow-green streak ...
const TRAIL_CORE = 0xf4ffb8; // ... and its bright core
// A soft glow, the streak and its core.
const TRAIL_LAYERS: readonly RibbonLayer[] = [
  [2, TRAIL_COLOR, 0.12],
  [1.25, TRAIL_COLOR, 0.42],
  [0.5, TRAIL_CORE, 0.95],
];

const at = newProjected();
const at2 = newProjected();

type Pt = { x: number; y: number; z: number };

// A player sprite: kit body with tinted skin and hair layers on top.
class Figure {
  private readonly layers: Phaser.GameObjects.Sprite[];

  constructor(scene: Phaser.Scene, kit: Kit, look: Look) {
    this.layers = [
      scene.add.sprite(0, 0, playerTexture(kit), 'idle1'),
      scene.add.sprite(0, 0, PLAYER_SKIN_TEXTURE, 'idle1').setTint(look.skin),
      scene.add.sprite(0, 0, PLAYER_HAIR_TEXTURE, 'idle1').setTint(look.hair),
    ];
    for (const layer of this.layers) layer.setOrigin(0.5, PLAYER_ORIGIN_Y);
  }

  draw(cam: KickCamera, x: number, y: number, frame: string, flip = false) {
    cam.project(x, y, 0, at);
    for (const layer of this.layers)
      layer
        .setVisible(true)
        .setFrame(frame)
        .setPosition(at.x, at.y)
        .setScale(PLAYER_PX * at.scale)
        .setFlipX(flip)
        // By distance down the pitch; side by side (the wall), the nearer
        // man covers the further.
        .setDepth(-x - at.depth * 1e-3);
  }

  hide() {
    for (const layer of this.layers) layer.setVisible(false);
  }
}

// What the scene tells the stage each frame besides the kick itself.
export type StagePose = {
  ball: Pt; // ball centre
  ballAge: number; // seconds since the strike (Infinity before it)
  kicker: { x: number; y: number; frame: string; flip: boolean };
  timeSec: number;
  goalFlash: boolean;
};

// The world of a free kick, drawn through the KickCamera: the court
// (rebuilt per kick so nothing behind the camera is drawn), chalk and
// spray marks, the goal with a rippling net, the kicker, the wall, the
// keeper, the ball and its trail.
export class Stage {
  private planes: ProjectedPlane[] = [];
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly lines: Phaser.GameObjects.Graphics;
  private readonly net: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly trailBands: Phaser.GameObjects.Graphics[];
  private readonly kicker: Figure;
  private readonly wall: Figure[];
  private readonly lyer: Figure; // lying behind the wall, against low shots
  private readonly keeper: Figure;
  private readonly ball: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private trail: Pt[] = [];
  private trailFade = 1;
  private rolled = 0;
  private last: Pt = { x: 0, y: 0, z: 0 };
  private lastTime = 0;
  private near = 0; // nothing at a lower x is on screen

  constructor(
    private readonly scene: Phaser.Scene,
    kits: { kicker: Kit; wall: Kit }
  ) {
    this.sky = scene.add.graphics().setDepth(DEPTH_SKY);
    this.lines = scene.add.graphics().setDepth(DEPTH_LINES);
    this.net = scene.add.graphics().setDepth(-NET_BACK_X);
    this.frame = scene.add.graphics().setDepth(-GOAL_X);
    this.trailBands = Array.from({ length: 4 }, () =>
      scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD)
    );
    const look = (i: number) =>
      LOOKS[i % LOOKS.length] ?? { skin: 0xffffff, hair: 0xffffff };
    this.kicker = new Figure(scene, kits.kicker, look(0));
    this.wall = Array.from(
      { length: Math.max(...FK.wallMen) },
      (_, i) => new Figure(scene, kits.wall, look(i + 1))
    );
    this.lyer = new Figure(scene, kits.wall, look(5));
    this.keeper = new Figure(scene, 'awayKeeper', look(4));
    this.shadow = scene.add.image(0, 0, BALL_SHADOW_KEY);
    this.ball = scene.add.image(0, 0, BALL_KEY, 'a');
  }

  // Rebuild the court for the camera and clear the previous flight trail.
  setKick(cam: KickCamera) {
    this.trail = [];
    this.trailFade = 1;
    for (const plane of this.planes) plane.mesh.destroy();
    this.planes = [];
    this.near = cam.nearX() - 60;
    this.buildCourt(this.near);
  }

  // Ball positions of the flight so far (call once per sim step).
  recordTrail(play: KickPlay) {
    const b = play.ball;
    const last = this.trail[this.trail.length - 1];
    if (last && Math.hypot(b.x - last.x, b.y - last.y, b.z - last.z) < 6)
      return;
    this.trail.push({ x: b.x, y: b.y, z: b.z });
  }

  fadeTrail(dt: number) {
    this.trailFade = Math.max(0, this.trailFade - dt / FK.trailFadeSec);
  }

  render(
    cam: KickCamera,
    setup: KickSetup,
    play: KickPlay | null,
    pose: StagePose
  ) {
    const { width, height } = this.scene.scale;
    this.sky
      .clear()
      .fillGradientStyle(SKY_TOP, SKY_TOP, SKY_LOW, SKY_LOW)
      .fillRect(0, 0, width, height * 0.6);
    for (const plane of this.planes) plane.update(cam);
    this.drawLines(cam, setup);
    this.drawGoal(cam, play, pose);
    this.drawPeople(cam, setup, play, pose);
    this.drawBall(cam, pose);
    this.drawTrails(cam, setup, play, pose);
  }

  private quad(
    key: string,
    corners: PlaneCorners,
    cols: number,
    rows: number,
    uv: { u0: number; v0: number; u1: number; v1: number },
    depth: number,
    alpha = 1,
    tint = 0xffffff
  ) {
    const plane = new ProjectedPlane(this.scene, key, corners, {
      cols,
      rows,
      uv,
    });
    plane.mesh.setDepth(depth).setAlpha(alpha).setTint(tint);
    this.planes.push(plane);
  }

  // The court from x = near to the far end, as Court builds it for the
  // match, plus the facade closing the view beyond the car park.
  private buildCourt(near: number) {
    const { x0, x1, y1 } = GROUND_EXTENT;
    const H = PITCH.height;
    const T = PITCH.wallThickness;
    const wh = PITCH.wallHeight;
    const bh = PITCH.backdropHeight;
    const v = (x: number, y: number, z: number) => ({ x, y, z });
    const u = (x: number) => (x - x0) / (x1 - x0);

    // Ground in strips, finer near the camera where perspective is steepest.
    const cuts = [near, near + 300, near + 900, x1];
    for (let i = 0; i < 3; i++) {
      const a = cuts[i] ?? near;
      const b = cuts[i + 1] ?? x1;
      this.quad(
        GROUND_KEY,
        { tl: v(a, 0, 0), tr: v(b, 0, 0), bl: v(a, y1, 0), br: v(b, y1, 0) },
        12,
        24,
        { u0: u(a), v0: 0, u1: u(b), v1: 1 },
        DEPTH_GROUND
      );
    }

    // Far wall (brick face, coping, facade) and the near fence, both along x.
    const along = { u0: u(near), u1: 1 };
    this.quad(
      BACKDROP_KEY,
      {
        tl: v(near, -T, bh),
        tr: v(x1, -T, bh),
        bl: v(near, -T, wh),
        br: v(x1, -T, wh),
      },
      24,
      2,
      { ...along, v0: 0, v1: BACKDROP_WALL_V },
      DEPTH_FAR
    );
    this.quad(
      CAP_KEY,
      {
        tl: v(near, -T, wh),
        tr: v(x1, -T, wh),
        bl: v(near, 0, wh),
        br: v(x1, 0, wh),
      },
      24,
      1,
      { ...along, v0: 0, v1: 1 },
      DEPTH_FAR
    );
    this.quad(
      BACKDROP_KEY,
      {
        tl: v(near, 0, wh),
        tr: v(x1, 0, wh),
        bl: v(near, 0, 0),
        br: v(x1, 0, 0),
      },
      24,
      2,
      { ...along, v0: BACKDROP_WALL_V, v1: 1 },
      DEPTH_FAR
    );
    this.quad(
      FENCE_KEY,
      {
        tl: v(near, H, PITCH.fenceHeight),
        tr: v(x1, H, PITCH.fenceHeight),
        bl: v(near, H, 0),
        br: v(x1, H, 0),
      },
      24,
      2,
      { ...along, v0: 0, v1: 1 },
      DEPTH_FAR,
      0.6
    );

    // Buildings across the far end, behind the car park: the facade only,
    // standing on the ground (no brick wall behind the goal).
    this.quad(
      BACKDROP_KEY,
      {
        tl: v(x1, y1, bh - wh),
        tr: v(x1, -T, bh - wh),
        bl: v(x1, y1, 0),
        br: v(x1, -T, 0),
      },
      12,
      3,
      { u0: 0, v0: 0, u1: (y1 + T) / (x1 - x0), v1: BACKDROP_WALL_V },
      DEPTH_FAR - 1
    );

    // A taller, darker skyline further off, so the sky is never bare.
    const span = y1 + T + 2 * SKYLINE_SIDE;
    this.quad(
      BACKDROP_KEY,
      {
        tl: v(x1 + SKYLINE_BEYOND, y1 + SKYLINE_SIDE, bh * SKYLINE_SCALE),
        tr: v(x1 + SKYLINE_BEYOND, -T - SKYLINE_SIDE, bh * SKYLINE_SCALE),
        bl: v(x1 + SKYLINE_BEYOND, y1 + SKYLINE_SIDE, 0),
        br: v(x1 + SKYLINE_BEYOND, -T - SKYLINE_SIDE, 0),
      },
      12,
      2,
      {
        u0: 0,
        v0: 0,
        u1: span / ((x1 - x0) * SKYLINE_SCALE),
        v1: BACKDROP_WALL_V,
      },
      DEPTH_FAR - 2,
      1,
      SKYLINE_SHADE
    );
  }

  // Chalk markings near the goal, and the referee's spray: a line where
  // the wall stands and an arc around the ball.
  private drawLines(cam: KickCamera, setup: KickSetup) {
    const g = this.lines.clear();
    const near = this.near;
    const W = PITCH.width;
    const H = PITCH.height;
    const segment = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      color: number,
      alpha: number
    ) => {
      // Cut off the part behind the near edge.
      if (ax < near && bx < near) return;
      if (ax < near || bx < near) {
        const f = (near - ax) / (bx - ax);
        if (ax < near) {
          ay += (by - ay) * f;
          ax = near;
        } else {
          by = ay + (by - ay) * f;
          bx = near;
        }
      }
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 60));
      for (let s = 0; s < steps; s++) {
        cam.project(
          ax + ((bx - ax) * s) / steps,
          ay + ((by - ay) * s) / steps,
          0,
          at
        );
        cam.project(
          ax + ((bx - ax) * (s + 1)) / steps,
          ay + ((by - ay) * (s + 1)) / steps,
          0,
          at2
        );
        const width = Math.min(
          8,
          Math.max(2, (PX * (at.scale + at2.scale)) / 2)
        );
        g.lineStyle(width, color, alpha).lineBetween(at.x, at.y, at2.x, at2.y);
      }
    };
    const chalk = (pts: readonly (readonly [number, number])[]) => {
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        const q = pts[i];
        if (p && q) segment(p[0], p[1], q[0], q[1], PAL.white, 0.9);
      }
    };
    const rect = (xa: number, ya: number, xb: number, yb: number) =>
      chalk([
        [xa, ya],
        [xb, ya],
        [xb, yb],
        [xa, yb],
        [xa, ya],
      ]);
    rect(
      W - PITCH.boxDepth,
      (H - PITCH.boxHeight) / 2,
      W,
      (H + PITCH.boxHeight) / 2
    );
    rect(
      W - PITCH.goalAreaDepth,
      (H - PITCH.goalAreaHeight) / 2,
      W,
      (H + PITCH.goalAreaHeight) / 2
    );
    chalk([
      [near, 0],
      [W, 0],
      [W, H],
      [near, H],
    ]);
    const spotX = W - (PITCH.boxDepth - 80);
    chalk([
      [spotX - 5, GOAL_Y],
      [spotX + 5, GOAL_Y],
    ]);

    // Spray: dashes across the wall's feet and around the ball.
    const { wall, spot } = setup;
    const lo = Math.min(...wall.men) - 26;
    const hi = Math.max(...wall.men) + 26;
    for (let y = lo; y < hi; y += 16)
      segment(wall.x - 14, y, wall.x - 14, y + 9, PAL.white, 0.7);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.55 + (i / 8) * 0.9);
      const b = a + 0.12;
      segment(
        spot.x + Math.cos(a) * 26,
        spot.y + Math.sin(a) * 26,
        spot.x + Math.cos(b) * 26,
        spot.y + Math.sin(b) * 26,
        PAL.white,
        0.7
      );
    }
  }

  // Posts, crossbar and net. The back net bulges where the ball hits it.
  private drawGoal(cam: KickCamera, play: KickPlay | null, pose: StagePose) {
    const net = this.net.clear();
    const front = this.frame.clear();
    const top = GOAL_Y - POST_HALF;
    const bot = GOAL_Y + POST_HALF;
    const backZ = BAR_Z * 0.7;
    const hit = play?.netHit;
    const age = hit && play ? play.t - hit.t : 0;
    const amp = hit ? 60 * Math.exp(-3.5 * age) * Math.cos(10 * age) : 0;
    const bulge = (y: number, z: number) =>
      hit
        ? amp * Math.exp(-((y - hit.y) ** 2 + (z - hit.z) ** 2) / (2 * 55 ** 2))
        : 0;
    const line = (
      g: Phaser.GameObjects.Graphics,
      a: Pt,
      b: Pt,
      steps: number,
      bend: boolean
    ) => {
      for (let s = 0; s < steps; s++) {
        const p = s / steps;
        const q = (s + 1) / steps;
        const ay = a.y + (b.y - a.y) * p;
        const az = a.z + (b.z - a.z) * p;
        const by = a.y + (b.y - a.y) * q;
        const bz = a.z + (b.z - a.z) * q;
        cam.project(
          a.x + (b.x - a.x) * p + (bend ? bulge(ay, az) : 0),
          ay,
          az,
          at
        );
        cam.project(
          a.x + (b.x - a.x) * q + (bend ? bulge(by, bz) : 0),
          by,
          bz,
          at2
        );
        g.lineBetween(at.x, at.y, at2.x, at2.y);
      }
    };
    net.lineStyle(2, PAL.lightGray, 0.8);
    // Back net.
    for (let i = 0; i <= 12; i++) {
      const y = top + (i / 12) * (bot - top);
      line(
        net,
        { x: NET_BACK_X, y, z: 0 },
        { x: NET_BACK_X, y, z: backZ },
        6,
        true
      );
    }
    for (let j = 0; j <= 5; j++) {
      const z = (j / 5) * backZ;
      line(
        net,
        { x: NET_BACK_X, y: top, z },
        { x: NET_BACK_X, y: bot, z },
        12,
        true
      );
    }
    // Side nets.
    for (const y of [top, bot]) {
      for (let i = 0; i <= 3; i++) {
        const f = i / 3;
        const x = GOAL_X + f * FK.goalDepth;
        line(
          net,
          { x, y, z: 0 },
          { x, y, z: BAR_Z + (backZ - BAR_Z) * f },
          1,
          false
        );
      }
      for (let j = 1; j <= 4; j++) {
        const f = j / 5;
        line(
          net,
          { x: GOAL_X, y, z: BAR_Z * f },
          { x: NET_BACK_X, y, z: backZ * f },
          1,
          false
        );
      }
    }
    // Net panels, faintly filled so the box of the goal reads as solid: the
    // back, both sides and the roof, with shading that darkens with depth.
    const panel = (
      g: Phaser.GameObjects.Graphics,
      p: Pt[],
      color: number,
      alpha: number
    ) => {
      const q = p.map((pt) => {
        cam.project(pt.x, pt.y, pt.z, at);
        return { x: at.x, y: at.y };
      });
      const [a0, a1, a2, a3] = q;
      if (!a0 || !a1 || !a2 || !a3) return;
      g.fillStyle(color, alpha);
      g.fillTriangle(a0.x, a0.y, a1.x, a1.y, a2.x, a2.y);
      g.fillTriangle(a0.x, a0.y, a2.x, a2.y, a3.x, a3.y);
    };
    const P = (x: number, y: number, z: number): Pt => ({ x, y, z });
    panel(
      net,
      [
        P(NET_BACK_X, top, 0),
        P(NET_BACK_X, bot, 0),
        P(NET_BACK_X, bot, backZ),
        P(NET_BACK_X, top, backZ),
      ],
      NET_SHADE,
      0.5
    );
    for (const y of [top, bot])
      panel(
        net,
        [
          P(GOAL_X, y, 0),
          P(NET_BACK_X, y, 0),
          P(NET_BACK_X, y, backZ),
          P(GOAL_X, y, BAR_Z),
        ],
        NET_SHADE,
        0.4
      );
    panel(
      front,
      [
        P(GOAL_X, top, BAR_Z),
        P(GOAL_X, bot, BAR_Z),
        P(NET_BACK_X, bot, backZ),
        P(NET_BACK_X, top, backZ),
      ],
      NET_SHADE,
      0.3
    );
    // Roof net (over a ball in the goal, so with the frame).
    front.lineStyle(2, PAL.lightGray, 0.7);
    for (let i = 0; i <= 12; i++) {
      const y = top + (i / 12) * (bot - top);
      line(
        front,
        { x: GOAL_X, y, z: BAR_Z },
        { x: NET_BACK_X, y, z: backZ },
        1,
        false
      );
    }
    for (let j = 1; j <= 2; j++) {
      const f = j / 3;
      const x = GOAL_X + f * FK.goalDepth;
      const z = BAR_Z + (backZ - BAR_Z) * f;
      line(front, { x, y: top, z }, { x, y: bot, z }, 1, false);
    }
    // The goal's rear and base: thinner tubes (they are further off) from
    // the back posts, along the ground and down the sloping roof.
    const tube = (
      g: Phaser.GameObjects.Graphics,
      a: Pt,
      b: Pt,
      radius: number,
      color: number
    ) => {
      cam.project(a.x, a.y, a.z, at);
      cam.project(b.x, b.y, b.z, at2);
      const width = Math.max(2, (radius * (at.scale + at2.scale)) / 2);
      g.lineStyle(width + 3, PAL.black, 0.8).lineBetween(
        at.x,
        at.y,
        at2.x,
        at2.y
      );
      g.lineStyle(width, color, 1).lineBetween(at.x, at.y, at2.x, at2.y);
    };
    const rear = BALL.postRadius * 0.7;
    for (const y of [top, bot]) {
      tube(
        net,
        P(NET_BACK_X, y, 0),
        P(NET_BACK_X, y, backZ),
        rear,
        PAL.lightGray
      );
      tube(net, P(GOAL_X, y, 0), P(NET_BACK_X, y, 0), rear, PAL.white);
      tube(
        net,
        P(GOAL_X, y, BAR_Z),
        P(NET_BACK_X, y, backZ),
        rear,
        PAL.lightGray
      );
    }
    tube(
      net,
      P(NET_BACK_X, top, backZ),
      P(NET_BACK_X, bot, backZ),
      rear,
      PAL.lightGray
    );
    tube(
      net,
      P(NET_BACK_X, top, 0),
      P(NET_BACK_X, bot, 0),
      rear,
      PAL.lightGray
    );
    // Frame: white tubes with a dark outline.
    const color = pose.goalFlash ? PAL.yellow : PAL.white;
    for (const [a, b] of [
      [
        { x: GOAL_X, y: top, z: 0 },
        { x: GOAL_X, y: top, z: BAR_Z },
      ],
      [
        { x: GOAL_X, y: bot, z: 0 },
        { x: GOAL_X, y: bot, z: BAR_Z },
      ],
      [
        { x: GOAL_X, y: top, z: BAR_Z },
        { x: GOAL_X, y: bot, z: BAR_Z },
      ],
    ] as const) {
      cam.project(a.x, a.y, a.z, at);
      cam.project(b.x, b.y, b.z, at2);
      const width = Math.max(3, (BALL.postRadius * (at.scale + at2.scale)) / 2);
      front
        .lineStyle(width + 4, PAL.black, 1)
        .lineBetween(at.x, at.y, at2.x, at2.y);
      front.lineStyle(width, color, 1).lineBetween(at.x, at.y, at2.x, at2.y);
    }
  }

  private drawPeople(
    cam: KickCamera,
    setup: KickSetup,
    play: KickPlay | null,
    pose: StagePose
  ) {
    const t = play?.t ?? 0;
    // Mirrored when he stands to the ball's right.
    this.kicker.draw(
      cam,
      pose.kicker.x,
      pose.kicker.y,
      pose.kicker.frame,
      pose.kicker.flip
    );

    // The wall braces, then jumps as the ball is struck.
    const wall = play?.wall ?? setup.wall;
    const u = (t - wall.jumpAt) / FK.wallJumpSec;
    const wallFrame =
      u < 0 || u >= 1
        ? 'celebrate_a2'
        : u < 0.2 || u > 0.8
          ? 'celebrate_a3'
          : 'celebrate_a4';
    this.wall.forEach((man, i) => {
      const y = wall.men[i];
      if (y === undefined) man.hide();
      else man.draw(cam, wall.x, y, wallFrame);
    });
    // A man lying across the back of the wall (the lying hurt pose).
    if (wall.lyer && wall.men.length > 0) {
      const mid = wall.men.reduce((sum, m) => sum + m, 0) / wall.men.length;
      this.lyer.draw(cam, wall.x + FK.wallLyerBehind, mid, 'hurt4');
    } else this.lyer.hide();

    // Keeper: stance, jump, dive (frames lead to +y; flipped for -y), or a
    // standing block when it saved the ball without moving.
    const k = play?.keeper;
    if (!k) {
      const idle = 1 + (Math.floor(pose.timeSec * 4) % 3);
      this.keeper.draw(
        cam,
        GOAL_X - FK.keeperLineOff,
        setup.keeperY,
        `keeper_idle${idle}`
      );
      return;
    }
    const since = t - k.modeAt;
    let frame = `keeper_idle${1 + (Math.floor(pose.timeSec * 4) % 3)}`;
    if (k.mode === 'dive' || k.mode === 'down') {
      const n =
        k.mode === 'down'
          ? 5
          : Math.min(4, Math.floor((since / FK.keeperDiveSec) * 5));
      frame = `dive${n + 1}`;
    } else if (k.mode === 'jump') {
      const p = since / FK.keeperJumpSec;
      frame = p < 0.25 ? 'jump2' : p < 0.8 ? 'jump3' : 'jump4';
    } else if (play?.outcome === 'saved') frame = 'block1';
    const diving = k.mode === 'dive' || k.mode === 'down';
    this.keeper.draw(cam, k.x, k.y, frame, diving && k.dir < 0);
  }

  private drawBall(cam: KickCamera, pose: StagePose) {
    const b = pose.ball;
    cam.project(b.x, b.y, 0, at);
    const high = Math.min(1, (b.z - R) / 200);
    this.shadow
      .setPosition(at.x, at.y)
      .setScale(((2 * R) / 6) * at.scale * (1 - 0.4 * high))
      .setAlpha(0.45 * (1 - 0.6 * high))
      .setDepth(-b.x + 0.4);
    cam.project(b.x, b.y, b.z, at2);
    // Spinning frames by distance travelled; the squash-and-stretch shot
    // frames right after the strike.
    this.rolled += Math.min(
      Math.hypot(b.x - this.last.x, b.y - this.last.y),
      MAX_ROLL_PX_PER_SEC * Math.max(0, pose.timeSec - this.lastTime)
    );
    this.last = { ...b };
    this.lastTime = pose.timeSec;
    const shot = Math.floor(pose.ballAge * 18);
    const frame =
      shot < BALL_SHOT_FRAMES.length
        ? (BALL_SHOT_FRAMES[shot] ?? 'shot1')
        : (BALL_FRAMES[Math.floor(this.rolled / 14) % BALL_FRAMES.length] ??
          'a');
    this.ball
      .setFrame(frame)
      .setPosition(at2.x, at2.y)
      .setScale(((2 * R) / BALL_TEXTURE_W) * at2.scale)
      .setDepth(-b.x + 0.5);
  }

  // The flight trail: a glowing streak, thin and faint where the kick was
  // struck, widest and brightest at the ball. Drawn in depth bands at the
  // wall, the keeper and the goal line so each part sorts with what it passes.
  private drawTrails(
    cam: KickCamera,
    setup: KickSetup,
    play: KickPlay | null,
    pose: StagePose
  ) {
    const cuts = [
      setup.wall.x,
      play?.keeper.x ?? GOAL_X - FK.keeperLineOff,
      GOAL_X,
      NET_BACK_X,
    ];
    this.trailBands.forEach((g, i) =>
      g.clear().setDepth(-(cuts[i] ?? GOAL_X) + 0.45)
    );
    if (this.trailFade <= 0 || this.trail.length < 2) return;
    // Up to the ball as drawn (between sim steps) while it is in flight.
    const path =
      play && play.outcome === null ? [...this.trail, pose.ball] : this.trail;
    const last = path.length - 1;
    const pts: RibbonPoint[] = path.map((p, i) => {
      cam.project(p.x, p.y, p.z, at);
      const f = i / last; // newer = wider and brighter
      return {
        x: at.x,
        y: at.y,
        w: Math.max(1.2, R * at.scale * (0.15 + 0.75 * f)),
        a: this.trailFade * (0.1 + 0.9 * f ** 1.6),
      };
    });
    drawRibbon(pts, TRAIL_LAYERS, (i) => {
      const x = ((path[i - 1]?.x ?? 0) + (path[i]?.x ?? 0)) / 2;
      const band = cuts.findIndex((c) => x < c);
      return this.trailBands[band < 0 ? 3 : band];
    });
  }
}
