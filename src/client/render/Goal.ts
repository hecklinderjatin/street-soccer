import Phaser from 'phaser';
import { PITCH } from '../../shared/tuning';
import { PAL, PX } from '../ui/palette';
import { newProjected, type Projector } from './Projector';
import { bilinear, type PlaneCorners, type Vec3 } from './ProjectedPlane';

const a = newProjected();
const b = newProjected();

// Depth of the near end-wall segment beside a goal: between the near side
// net (which sits behind that wall) and the goal frame (which stands flush
// with the wall's inner face, in front of it).
export const NEAR_WALL_DEPTH = (PITCH.height + PITCH.goalMouth) / 2 + 2;

// A goal in 3D: posts, crossbar and a sloping net, drawn as projected lines
// in three depth layers so players and walls sort correctly around it:
// - back: far post, back net, far side net (at the far post's y, behind a
//   player inside the goal);
// - near side net (just past the near post's y, in front of that player but
//   behind the near end wall);
// - frame: near post, crossbar and roof net (in front of the near end wall).
export class Goal {
  private readonly back: Phaser.GameObjects.Graphics;
  private readonly sideNet: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly lineX: number;
  private readonly backX: number;
  private readonly top = (PITCH.height - PITCH.goalMouth) / 2;
  private readonly bottom = (PITCH.height + PITCH.goalMouth) / 2;

  // side -1 = left goal (net behind x = 0), 1 = right goal (net behind x = width).
  constructor(scene: Phaser.Scene, side: -1 | 1) {
    this.lineX = side < 0 ? 0 : PITCH.width;
    this.backX = this.lineX + side * PITCH.goalDepth;
    this.back = scene.add.graphics().setDepth(this.top - 1);
    this.sideNet = scene.add.graphics().setDepth(NEAR_WALL_DEPTH - 1);
    this.frame = scene.add.graphics().setDepth(NEAR_WALL_DEPTH + 1);
  }

  update(projector: Projector) {
    const H = PITCH.goalHeight;
    const HB = H * 0.7; // the net slopes down to the back
    const { lineX: lx, backX: bx, top, bottom } = this;
    const p = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

    this.back.clear();
    this.sideNet.clear();
    this.frame.clear();

    this.net(
      projector,
      this.back,
      {
        tl: p(bx, top, HB),
        tr: p(bx, bottom, HB),
        bl: p(bx, top, 0),
        br: p(bx, bottom, 0),
      },
      10,
      4
    );
    this.net(
      projector,
      this.back,
      {
        tl: p(lx, top, H),
        tr: p(bx, top, HB),
        bl: p(lx, top, 0),
        br: p(bx, top, 0),
      },
      3,
      4
    );
    this.bar(projector, this.back, p(lx, top, 0), p(lx, top, H));

    this.net(
      projector,
      this.sideNet,
      {
        tl: p(lx, bottom, H),
        tr: p(bx, bottom, HB),
        bl: p(lx, bottom, 0),
        br: p(bx, bottom, 0),
      },
      3,
      4
    );

    this.net(
      projector,
      this.frame,
      {
        tl: p(lx, top, H),
        tr: p(lx, bottom, H),
        bl: p(bx, top, HB),
        br: p(bx, bottom, HB),
      },
      10,
      3
    );
    this.bar(projector, this.frame, p(lx, bottom, 0), p(lx, bottom, H));
    this.bar(projector, this.frame, p(lx, top, H), p(lx, bottom, H));
  }

  // Net mesh: nu lines across, nv lines down a planar quad.
  private net(
    projector: Projector,
    g: Phaser.GameObjects.Graphics,
    q: PlaneCorners,
    nu: number,
    nv: number
  ) {
    g.lineStyle(2, PAL.lightGray, 0.55);
    for (let i = 0; i <= nu; i++)
      this.line(projector, g, bilinear(q, i / nu, 0), bilinear(q, i / nu, 1));
    for (let j = 0; j <= nv; j++)
      this.line(projector, g, bilinear(q, 0, j / nv), bilinear(q, 1, j / nv));
  }

  // White frame tube with a dark outline, thickness scaled by distance.
  private bar(
    projector: Projector,
    g: Phaser.GameObjects.Graphics,
    from: Vec3,
    to: Vec3
  ) {
    projector.project(from.x, from.y, from.z, a);
    projector.project(to.x, to.y, to.z, b);
    const width = Math.max(3, Math.round((1.5 * PX * (a.scale + b.scale)) / 2));
    g.lineStyle(width + 4, PAL.black, 1).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(width, PAL.white, 1).lineBetween(a.x, a.y, b.x, b.y);
  }

  private line(
    projector: Projector,
    g: Phaser.GameObjects.Graphics,
    from: Vec3,
    to: Vec3
  ) {
    projector.project(from.x, from.y, from.z, a);
    projector.project(to.x, to.y, to.z, b);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
}
