import Phaser from 'phaser';
import { BALL, FREE_KICK as FK } from '../../shared/tuning';
import { Projector, type Projected } from '../render/Projector';
import { BAR_Z, GOAL_X, GOAL_Y, POST_HALF, type Spot } from './rules';

const PITCH_RAD = (FK.cameraPitchDeg * Math.PI) / 180;
const SIN = Math.sin(PITCH_RAD);
const COS = Math.cos(PITCH_RAD);
const KICKER_HALF = 24; // half the kicker sprite's width, world px
const NEAR = 20; // world px; nearer points are clamped (ground geometry is cut off well before)

// The free-kick camera: low and close behind the ball, swung a little
// round it to the side away from the kicker, turned toward the goal and
// tipped down, as the free-kick view of mobile football games. Focal length
// and lens shift are solved per kick so the ball sits at its mark, the
// crossbar no higher than its mark and the whole goal inside the view. A
// Projector, so the match's ProjectedPlanes draw through it.
export class KickCamera extends Projector {
  private eyeX = 0;
  private eyeY = 0;
  private eyeZ = FK.cameraHeight;
  private yawCos = 1; // the view direction on the ground
  private yawSin = 0;
  private focal = 1000;
  private centerX = 0;
  private centerY = 0;
  private base = { focal: 1000, centerX: 0, centerY: 0 };
  private view = { width: 0, height: 0 };

  // Frames a kick from `spot` for a width x height view. `side`: 1 with
  // the kicker on the ball's right and the controls on the left, -1 mirrored.
  frame(spot: Spot, width: number, height: number, side: 1 | -1 = 1) {
    this.view = { width, height };
    const dx = GOAL_X - spot.x;
    const dy = GOAL_Y - spot.y;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    // Round the ball to the side of the shot line away from the kicker.
    const orbit = (side * FK.cameraOrbitDeg * Math.PI) / 180;
    const back = FK.cameraBack * Math.cos(orbit);
    const aside = FK.cameraBack * Math.sin(orbit);
    this.eyeX = spot.x - ux * back - uy * aside;
    this.eyeY = spot.y - uy * back + ux * aside;
    const lookX = spot.x + dx * FK.cameraLookAt - this.eyeX;
    const lookY = spot.y + dy * FK.cameraLookAt - this.eyeY;
    const look = Math.hypot(lookX, lookY);
    this.yawCos = lookX / look;
    this.yawSin = lookY / look;

    const ball = this.ray(spot.x, spot.y, BALL.radius);
    const posts = [-POST_HALF, POST_HALF].flatMap((off) => [
      this.ray(GOAL_X, GOAL_Y + off, 0),
      this.ray(GOAL_X, GOAL_Y + off, BAR_Z),
    ]);
    const lo = Math.min(...posts.map((p) => p.right));
    const hi = Math.max(...posts.map((p) => p.right));
    const bar = Math.max(...posts.map((p) => p.up));
    // Worked out with the controls on the left (mirrored otherwise): how
    // far the goal reaches from the ball toward the controls and away from
    // them, per unit focal length.
    const toControls = side > 0 ? ball.right - lo : hi - ball.right;
    const away = side > 0 ? hi - ball.right : ball.right - lo;
    const tall = ((FK.ballScreenY - FK.barScreenY) * height) / (bar - ball.up);
    // The ball only as far across as the goal needs to clear the controls.
    const across = Phaser.Math.Clamp(
      FK.cameraControlsPx + tall * toControls,
      FK.ballScreenX[0] * width,
      FK.ballScreenX[1] * width
    );
    const fits = [tall];
    if (toControls > 0) fits.push((across - FK.cameraControlsPx) / toControls);
    if (away > 0) fits.push((width - FK.cameraEdgePx - across) / away);
    let focal = Math.min(...fits) * FK.cameraZoom;
    const ballX = side > 0 ? across : width - across;
    // The kicker is always in the frame: wherever he waits or runs to, on
    // either side of the ball (SIDE moves him, not the camera), with his
    // sprite's width, inside the view's edges.
    for (const kicker of [-1, 1]) {
      for (const [kb, ks] of [
        [FK.kickerStartBack, FK.kickerStartSide],
        [FK.kickerContactBack, FK.kickerContactSide],
      ] as const) {
        const k = this.ray(
          spot.x - ux * kb - uy * kicker * ks,
          spot.y - uy * kb + ux * kicker * ks,
          0
        );
        const reach = k.right - ball.right;
        for (const edge of [-1, 1]) {
          const delta = reach + (edge * KICKER_HALF) / k.depth;
          const room =
            delta > 0
              ? width - FK.cameraKickerEdgePx - ballX
              : ballX - FK.cameraKickerEdgePx;
          if (delta !== 0) focal = Math.min(focal, room / Math.abs(delta));
        }
      }
    }
    this.base = {
      focal,
      centerX: ballX - focal * ball.right,
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

  // The lowest world x on the ground the framed view shows (its bottom
  // corners): nothing nearer needs drawing.
  nearX() {
    const { width, height } = this.view;
    return Math.min(this.groundX(0, height), this.groundX(width, height));
  }

  // World x of the ground point under a screen point of the framed view.
  private groundX(sx: number, sy: number) {
    const { focal, centerX, centerY } = this.base;
    const up = (centerY - sy) / focal;
    const fwd = (this.eyeZ * (COS + up * SIN)) / (SIN - up * COS);
    const lat = ((sx - centerX) / focal) * (fwd * COS + this.eyeZ * SIN);
    return this.eyeX + fwd * this.yawCos + lat * this.yawSin;
  }

  override project(x: number, y: number, z: number, out: Projected) {
    const ex = x - this.eyeX;
    const ey = y - this.eyeY;
    const ez = z - this.eyeZ;
    const fwd = ex * this.yawCos + ey * this.yawSin;
    const depth = Math.max(NEAR, fwd * COS - ez * SIN);
    const scale = this.focal / depth;
    // Screen right is world -y when looking straight down the pitch.
    out.x = this.centerX + (ex * this.yawSin - ey * this.yawCos) * scale;
    out.y = this.centerY - (fwd * SIN + ez * COS) * scale;
    out.scale = scale;
    out.depth = depth;
    return out;
  }

  // Screen direction of a point per unit focal length, and its depth.
  private ray(x: number, y: number, z: number) {
    const ex = x - this.eyeX;
    const ey = y - this.eyeY;
    const ez = z - this.eyeZ;
    const fwd = ex * this.yawCos + ey * this.yawSin;
    const depth = fwd * COS - ez * SIN;
    return {
      right: (ex * this.yawSin - ey * this.yawCos) / depth,
      up: (fwd * SIN + ez * COS) / depth,
      depth,
    };
  }
}
