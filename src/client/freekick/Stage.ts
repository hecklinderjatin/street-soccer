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
  END_WALL_KEY,
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
const NET_BACK_X = GOAL_X + PITCH.goalDepth;
const R = BALL.radius;

export const TRAIL_COLOR = 0xc8ff2a; // the glowing yellow-green streak ...
const TRAIL_CORE = 0xf4ffb8; // ... and its bright core

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
        .setDepth(-x);
  }

  hide() {
    for (const layer of this.layers) layer.setVisible(false);
  }
}

// What the scene tells the stage each frame besides the kick itself.
export type StagePose = {
  ball: Pt; // ball centre
  ballAge: number; // seconds since the strike (Infinity before it)
  kicker: { x: number; y: number; frame: string };
  timeSec: number;
  goalFlash: boolean;
};

// The world of a free kick, drawn through the KickCamera: the court
// (rebuilt per kick so nothing behind the camera is drawn), chalk and
// spray marks, the goal with a rippling net, the kicker, the wall, the
// keeper, the ball and its trail.
export class Stage {
  private planes: ProjectedPlane[] = [];
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

  constructor(
    private readonly scene: Phaser.Scene,
    kits: { kicker: Kit; wall: Kit }
  ) {
    this.lines = scene.add.graphics().setDepth(DEPTH_LINES);
    this.net = scene.add.graphics().setDepth(-NET_BACK_X);
    this.frame = scene.add.graphics().setDepth(-GOAL_X);
    this.trailBands = Array.from({ length: 4 }, () => scene.add.graphics());
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
    this.buildCourt(cam.x + 150); // nothing nearer than this is on screen
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
    this.trailFade = Math.max(0.35, this.trailFade - dt * 0.6);
  }

  render(
    cam: KickCamera,
    setup: KickSetup,
    play: KickPlay | null,
    pose: StagePose
  ) {
    for (const plane of this.planes) plane.update(cam);
    this.drawLines(cam, setup);
    this.drawGoal(cam, play, pose);
    this.drawPeople(cam, setup, play, pose);
    this.drawBall(cam, pose);
    this.drawTrails(cam, setup, play);
  }

  private quad(
    key: string,
    corners: PlaneCorners,
    cols: number,
    rows: number,
    uv: { u0: number; v0: number; u1: number; v1: number },
    depth: number,
    alpha = 1
  ) {
    const plane = new ProjectedPlane(this.scene, key, corners, {
      cols,
      rows,
      uv,
    });
    plane.mesh.setDepth(depth).setAlpha(alpha);
    this.planes.push(plane);
  }

  // The court from x = near to the far end, as Court builds it for the
  // match, plus the facade closing the view beyond the car park.
  private buildCourt(near: number) {
    const { x0, x1, y1 } = GROUND_EXTENT;
    const W = PITCH.width;
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

    // Facade across the far end, behind the car park.
    this.quad(
      BACKDROP_KEY,
      {
        tl: v(x1, y1, bh),
        tr: v(x1, -T, bh),
        bl: v(x1, y1, 0),
        br: v(x1, -T, 0),
      },
      12,
      3,
      { u0: 0, v0: 0, u1: (y1 + T) / (x1 - x0), v1: 1 },
      DEPTH_FAR - 1
    );

    // End walls either side of the goal: front face and coping.
    const eh = PITCH.endWallHeight;
    const gTop = GOAL_Y - POST_HALF;
    const gBot = GOAL_Y + POST_HALF;
    for (const [ya, yb] of [
      [0, gTop],
      [gBot, H],
    ] as const) {
      const cols = Math.max(2, Math.round((yb - ya) / 80));
      this.quad(
        END_WALL_KEY,
        {
          tl: v(W, yb, eh),
          tr: v(W, ya, eh),
          bl: v(W, yb, 0),
          br: v(W, ya, 0),
        },
        cols,
        2,
        { u0: ya / H, v0: 0, u1: yb / H, v1: 1 },
        -W - 5
      );
      this.quad(
        CAP_KEY,
        {
          tl: v(W + T, yb, eh),
          tr: v(W + T, ya, eh),
          bl: v(W, yb, eh),
          br: v(W, ya, eh),
        },
        cols,
        1,
        { u0: 0, v0: 0, u1: (yb - ya) / (x1 - x0), v1: 1 },
        -W - 5
      );
    }
  }

  // Chalk markings near the goal, and the referee's spray: a line where
  // the wall stands and an arc around the ball.
  private drawLines(cam: KickCamera, setup: KickSetup) {
    const g = this.lines.clear();
    const near = cam.x + 120;
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
    net.lineStyle(2, PAL.lightGray, 0.55);
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
        const x = GOAL_X + f * PITCH.goalDepth;
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
    // Roof net (over a ball in the goal, so with the frame).
    front.lineStyle(2, PAL.lightGray, 0.45);
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
      const x = GOAL_X + f * PITCH.goalDepth;
      const z = BAR_Z + (backZ - BAR_Z) * f;
      line(front, { x, y: top, z }, { x, y: bot, z }, 1, false);
    }
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
    this.kicker.draw(cam, pose.kicker.x, pose.kicker.y, pose.kicker.frame);

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
    this.rolled += Math.hypot(b.x - this.last.x, b.y - this.last.y);
    this.last = { ...b };
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

  // Draw the flight trail in depth bands at the wall,
  // the keeper and the goal line so each part sorts with what it passes.
  private drawTrails(cam: KickCamera, setup: KickSetup, play: KickPlay | null) {
    const cuts = [
      setup.wall.x,
      play?.keeper.x ?? GOAL_X - FK.keeperLineOff,
      GOAL_X,
      NET_BACK_X,
    ];
    this.trailBands.forEach((g, i) =>
      g.clear().setDepth(-(cuts[i] ?? GOAL_X) + 0.5)
    );
    const band = (x: number) => {
      const i = cuts.findIndex((c) => x < c);
      return this.trailBands[i < 0 ? 3 : i];
    };
    const ribbon = (
      pts: Pt[],
      color: number,
      core: number,
      alpha: number,
      width: number
    ) => {
      const n = pts.length;
      for (let i = 1; i < n; i++) {
        const p = pts[i - 1];
        const q = pts[i];
        if (!p || !q) continue;
        const g = band((p.x + q.x) / 2);
        if (!g) continue;
        cam.project(p.x, p.y, p.z, at);
        cam.project(q.x, q.y, q.z, at2);
        const f = i / n; // newer = wider and brighter
        const wa = Math.max(1.5, width * R * at.scale * (0.25 + 0.75 * f));
        const wb = Math.max(1.5, width * R * at2.scale * (0.25 + 0.75 * f));
        const dx = at2.x - at.x;
        const dy = at2.y - at.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const a = alpha * (0.2 + 0.8 * f);
        for (const [scale, layerAlpha, layerColor] of [
          [1, a * 0.5, color],
          [0.45, a, core],
        ] as const) {
          g.fillStyle(layerColor, layerAlpha);
          g.fillTriangle(
            at.x + nx * wa * scale,
            at.y + ny * wa * scale,
            at.x - nx * wa * scale,
            at.y - ny * wa * scale,
            at2.x + nx * wb * scale,
            at2.y + ny * wb * scale
          );
          g.fillTriangle(
            at.x - nx * wa * scale,
            at.y - ny * wa * scale,
            at2.x - nx * wb * scale,
            at2.y - ny * wb * scale,
            at2.x + nx * wb * scale,
            at2.y + ny * wb * scale
          );
        }
      }
    };
    ribbon(this.trail, TRAIL_COLOR, TRAIL_CORE, this.trailFade, 1.1);
  }
}
