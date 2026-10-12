import Phaser from 'phaser';
import { PITCH } from '../../shared/tuning';
import {
  BACKDROP_KEY,
  BACKDROP_WALL_V,
  BASKETBALL,
  CAP_KEY,
  END_WALL_KEY,
  FENCE_KEY,
  GROUND_EXTENT,
  GROUND_KEY,
  PARKING,
  createCourtTextures,
} from '../art/pitchArt';
import {
  CAR_COLORS,
  HOOP_KEY,
  carKey,
  createSceneryTextures,
} from '../art/sceneryArt';
import { seededRandom } from '../ui/backdrop';
import { Billboard } from './Billboard';
import { Crowd } from './Crowd';
import { Goal, NEAR_WALL_DEPTH } from './Goal';
import { PitchLines } from './PitchLines';
import { ProjectedPlane, type PlaneCorners } from './ProjectedPlane';
import type { Projector } from './Projector';

// Draw order, back to front: ground; far wall (facade, cap, brick face);
// props outside the court (cars, hoops; sorted among themselves by y); end
// walls, which hide those props' lower halves; then players, ball and goals
// sorted by ground y (the near end-wall segments sit in that range, see
// NEAR_WALL_DEPTH); the near fence; the crowd on the pavement in front of it.
const DEPTH_GROUND = -3_000_000;
const DEPTH_FAR_WALL = -2_600_000;
const DEPTH_PROPS = -2_500_000; // + y
const DEPTH_END_WALLS = -2_000_000;
const DEPTH_FENCE = 1_000_000;
const DEPTH_CROWD = 1_000_001; // + y

// Spectator rows on the pavement behind the near fence, set back far enough
// that their heads stay below a player standing on the near touchline.
const CROWD_ROWS = [PITCH.height + 64, PITCH.height + 112];

type UvRect = { u0: number; v0: number; u1: number; v1: number };

// Everything static around play: ground, walls, fence, goals, scenery props
// and the crowd. Built once per match; update() reprojects it every frame.
export class Court {
  private readonly planes: ProjectedPlane[] = [];
  private readonly goals: Goal[];
  private readonly props: Billboard[] = [];
  private readonly crowd: Crowd;
  private readonly lines: PitchLines;

  constructor(private readonly scene: Phaser.Scene) {
    createCourtTextures(scene);
    createSceneryTextures(scene);
    this.buildSurfaces();
    this.lines = new PitchLines(scene, DEPTH_GROUND + 1);
    this.goals = [new Goal(scene, -1), new Goal(scene, 1)];
    this.crowd = new Crowd(
      scene,
      DEPTH_CROWD,
      -120,
      PITCH.width + 120,
      CROWD_ROWS
    );
    this.buildProps();
  }

  update(projector: Projector, timeSec: number) {
    for (const plane of this.planes) plane.update(projector);
    this.lines.update(projector);
    for (const prop of this.props) prop.update(projector);
    this.crowd.update(projector, timeSec);
    for (const goal of this.goals) goal.update(projector);
  }

  private quad(
    key: string,
    corners: PlaneCorners,
    cols: number,
    rows: number,
    uv: UvRect,
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

  private buildSurfaces() {
    const { x0, x1, y1 } = GROUND_EXTENT;
    const W = PITCH.width;
    const H = PITCH.height;
    const v = (x: number, y: number, z: number) => ({ x, y, z });
    const full: UvRect = { u0: 0, v0: 0, u1: 1, v1: 1 };

    // Ground: a dense grid so the texture doesn't visibly warp in perspective.
    this.quad(
      GROUND_KEY,
      { tl: v(x0, 0, 0), tr: v(x1, 0, 0), bl: v(x0, y1, 0), br: v(x1, y1, 0) },
      40,
      18,
      full,
      DEPTH_GROUND
    );

    // Solid walls have thickness T outward from the court. Only the faces the
    // camera can see are built (it always looks from inside the court's x
    // range and from beyond the near touchline): the inner face, the coping
    // on top, and an end face pointing at the camera. A box's front faces
    // never overlap each other, so they can share a depth.
    const T = PITCH.wallThickness;

    // Far wall: brick face on the far touchline, coping on top, and the
    // apartment facade rising from the back of the wall.
    const wh = PITCH.wallHeight;
    const bh = PITCH.backdropHeight;
    this.quad(
      BACKDROP_KEY,
      {
        tl: v(x0, -T, bh),
        tr: v(x1, -T, bh),
        bl: v(x0, -T, wh),
        br: v(x1, -T, wh),
      },
      40,
      3,
      { u0: 0, v0: 0, u1: 1, v1: BACKDROP_WALL_V },
      DEPTH_FAR_WALL
    );
    this.quad(
      CAP_KEY,
      {
        tl: v(x0, -T, wh),
        tr: v(x1, -T, wh),
        bl: v(x0, 0, wh),
        br: v(x1, 0, wh),
      },
      40,
      1,
      full,
      DEPTH_FAR_WALL
    );
    this.quad(
      BACKDROP_KEY,
      { tl: v(x0, 0, wh), tr: v(x1, 0, wh), bl: v(x0, 0, 0), br: v(x1, 0, 0) },
      40,
      2,
      { u0: 0, v0: BACKDROP_WALL_V, u1: 1, v1: 1 },
      DEPTH_FAR_WALL
    );

    // End walls on each goal line, either side of the goal mouth (the goal
    // stands in the gap). Each segment is a thick block from ya to yb whose
    // end face at yb points toward the camera.
    const eh = PITCH.endWallHeight;
    const gTop = (H - PITCH.goalMouth) / 2;
    const gBot = (H + PITCH.goalMouth) / 2;
    const endWall = (
      lineX: number,
      side: -1 | 1,
      ya: number,
      yb: number,
      depth: number
    ) => {
      const outX = lineX + side * T;
      const cols = Math.max(2, Math.round((yb - ya) / 80));
      this.quad(
        END_WALL_KEY,
        {
          tl: v(lineX, ya, eh),
          tr: v(lineX, yb, eh),
          bl: v(lineX, ya, 0),
          br: v(lineX, yb, 0),
        },
        cols,
        2,
        { u0: ya / H, v0: 0, u1: yb / H, v1: 1 },
        depth
      );
      this.quad(
        CAP_KEY,
        {
          tl: v(outX, ya, eh),
          tr: v(outX, yb, eh),
          bl: v(lineX, ya, eh),
          br: v(lineX, yb, eh),
        },
        cols,
        1,
        { u0: 0, v0: 0, u1: (yb - ya) / (x1 - x0), v1: 1 },
        depth
      );
      this.quad(
        END_WALL_KEY,
        {
          tl: v(outX, yb, eh),
          tr: v(lineX, yb, eh),
          bl: v(outX, yb, 0),
          br: v(lineX, yb, 0),
        },
        1,
        2,
        { u0: 0, v0: 0, u1: T / H, v1: 1 },
        depth
      );
    };
    for (const side of [-1, 1] as const) {
      const lineX = side < 0 ? 0 : W;
      endWall(lineX, side, 0, gTop, DEPTH_END_WALLS);
      // The near segment is closer to the camera than a player inside the
      // net, so it sorts in with the goal layers.
      endWall(lineX, side, gBot, H, NEAR_WALL_DEPTH);
    }

    // Chain-link fence on the near touchline: in front of play, see-through.
    const fh = PITCH.fenceHeight;
    this.quad(
      FENCE_KEY,
      { tl: v(x0, H, fh), tr: v(x1, H, fh), bl: v(x0, H, 0), br: v(x1, H, 0) },
      40,
      2,
      full,
      DEPTH_FENCE,
      0.6
    );
  }

  // Hoops behind the left goal, parked cars behind the right one.
  private buildProps() {
    const hoopX = (BASKETBALL.x0 + BASKETBALL.x1) / 2;
    this.props.push(
      new Billboard(
        this.scene,
        HOOP_KEY,
        hoopX,
        BASKETBALL.y0 - 20,
        DEPTH_PROPS
      )
    );
    this.props.push(
      new Billboard(
        this.scene,
        HOOP_KEY,
        hoopX,
        BASKETBALL.y1 + 20,
        DEPTH_PROPS
      )
    );

    const rand = seededRandom(23);
    for (const [rx0, rx1] of PARKING.rows) {
      for (let k = 0; k < PARKING.bays; k++) {
        if (rand() > 0.65) continue;
        const color = Math.floor(rand() * CAR_COLORS.length);
        const y = PARKING.y0 + (k + 0.5) * PARKING.bay;
        this.props.push(
          new Billboard(
            this.scene,
            carKey(color),
            (rx0 + rx1) / 2,
            y,
            DEPTH_PROPS,
            rand() < 0.5
          )
        );
      }
    }
  }
}
