import { BALL, FREE_KICK as FK } from '../../shared/tuning';
import { Projector, type Projected } from '../render/Projector';
import { BAR_Z, GOAL_X, GOAL_Y, POST_HALF, type Spot } from './rules';

const PITCH_RAD = (FK.cameraPitchDeg * Math.PI) / 180;
const SIN = Math.sin(PITCH_RAD);
const COS = Math.cos(PITCH_RAD);
const NEAR = 20; // world px; nearer points are clamped (ground geometry is cut off well before)
const GOAL_FIT = 0.86; // the goal mouth never takes more than this share of the width

// The free-kick camera: behind the ball on the line from the goal through
// it, raised, looking straight down the pitch (+x) and tipped down a
// little, so the goal faces it square on. Focal length and lens shift are
// solved per kick so the ball sits low in the middle and the crossbar near
// the top whatever the distance and angle. A Projector, so the match's
// ProjectedPlanes draw through it.
export class KickCamera extends Projector {
  private eyeX = 0;
  private eyeY = 0;
  private eyeZ = FK.cameraHeight;
  private focal = 1000;
  private centerX = 0;
  private centerY = 0;
  private base = { focal: 1000, centerX: 0, centerY: 0 };

  get x() {
    return this.eyeX;
  }

  // Frames a kick from `spot` for a width x height view.
  frame(spot: Spot, width: number, height: number) {
    const dx = GOAL_X - spot.x;
    const dy = GOAL_Y - spot.y;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    // Back along the line, and a step to the right of it (away from the kicker).
    this.eyeX = spot.x - ux * FK.cameraBack - uy * FK.cameraSide;
    this.eyeY = spot.y - uy * FK.cameraBack + ux * FK.cameraSide;
    const ball = this.ray(spot.x, spot.y, BALL.radius);
    const bar = this.ray(GOAL_X, GOAL_Y, BAR_Z);
    const goalDepth = this.depthAt(GOAL_X, BAR_Z / 2);
    const focal = Math.min(
      ((FK.ballScreenY - FK.barScreenY) * height) / (bar.up - ball.up),
      (GOAL_FIT * width * goalDepth) / (2 * POST_HALF)
    );
    this.base = {
      focal,
      centerX: width / 2 - (focal * (ball.right + bar.right)) / 2,
      centerY: FK.ballScreenY * height + focal * ball.up,
    };
    this.zoom(1, 0, 0);
  }

  // Zooms the framed view by k about the screen point (ax, ay).
  zoom(k: number, ax: number, ay: number) {
    this.focal = this.base.focal * k;
    this.centerX = ax + (this.base.centerX - ax) * k;
    this.centerY = ay + (this.base.centerY - ay) * k;
  }

  // Distance along the view direction (for clipping ground geometry).
  depthAt(x: number, z: number) {
    return (x - this.eyeX) * COS - (z - this.eyeZ) * SIN;
  }

  override project(x: number, y: number, z: number, out: Projected) {
    const ex = x - this.eyeX;
    const ez = z - this.eyeZ;
    const depth = Math.max(NEAR, ex * COS - ez * SIN);
    const scale = this.focal / depth;
    out.x = this.centerX - (y - this.eyeY) * scale; // screen right = world -y
    out.y = this.centerY - (ex * SIN + ez * COS) * scale;
    out.scale = scale;
    out.depth = depth;
    return out;
  }

  // Screen direction of a point per unit focal length.
  private ray(x: number, y: number, z: number) {
    const depth = this.depthAt(x, z);
    return {
      right: -(y - this.eyeY) / depth,
      up: ((x - this.eyeX) * SIN + (z - this.eyeZ) * COS) / depth,
    };
  }
}
