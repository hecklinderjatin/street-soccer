import { CAMERA, PITCH } from '../../shared/tuning';
import type { Projector } from '../render/Projector';

export type CameraFocus = {
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  playerX: number;
  playerY: number;
  // The goal scorer while celebrating: the camera centres and zooms on it.
  celebrant: { x: number; y: number } | null;
};

// The broadcast camera's focus point on the ground, following the plan's
// rules (a blend of ball and controlled player, plus a look-ahead along the
// ball's travel, clamped to the court) with continuous, smooth motion:
// - the focus follows its target with a critically damped spring
//   ("smooth damp"): it has its own velocity, so it eases in and out of
//   moves and never starts or stops abruptly (the old hard dead zone made
//   it stand still, then lurch to catch up);
// - the look-ahead is low-pass filtered, so dribble taps, turns and
//   deflections don't jolt the target around.
export class CameraRig {
  private fx = 0;
  private fy = 0;
  private velX = 0;
  private velY = 0;
  private aheadX = 0;
  private aheadY = 0;
  private zoom: number = CAMERA.zoom;
  private targetZoom: number = CAMERA.zoom;

  constructor(private readonly projector: Projector) {}

  snapTo(x: number, y: number) {
    this.fx = clampX(x);
    this.fy = clampY(y);
    this.velX = this.velY = this.aheadX = this.aheadY = 0;
    this.projector.setFocus(this.fx, this.fy, this.zoom);
  }

  // True while the ball is in the air on a long pass or shot.
  setBallInAir(inAir: boolean) {
    this.targetZoom = inAir ? CAMERA.airZoom : CAMERA.zoom;
  }

  get currentZoom() {
    return this.zoom;
  }

  get focus() {
    return { x: this.fx, y: this.fy };
  }

  // Runs every render frame with the real elapsed time (frame-rate independent).
  update(dtSec: number, f: CameraFocus) {
    if (dtSec <= 0) return;

    // Look-ahead along the ball's travel, smoothed.
    const ballSpeed = Math.hypot(f.ballVx, f.ballVy);
    let wantX = 0;
    let wantY = 0;
    if (ballSpeed > 1) {
      const ahead =
        CAMERA.lookAhead * Math.min(1, ballSpeed / CAMERA.lookAheadFullSpeed);
      wantX = (f.ballVx / ballSpeed) * ahead;
      wantY = (f.ballVy / ballSpeed) * ahead;
    }
    const k = 1 - Math.exp(-dtSec / CAMERA.lookAheadSmoothSec);
    this.aheadX += (wantX - this.aheadX) * k;
    this.aheadY += (wantY - this.aheadY) * k;

    const c = f.celebrant;
    // Celebrating: on the scorer, allowed right up to the goal lines (the
    // close zoom keeps the view on the court).
    const tx = c
      ? Math.max(0, Math.min(PITCH.width, c.x))
      : clampX(
          CAMERA.ballWeight * f.ballX +
            (1 - CAMERA.ballWeight) * f.playerX +
            this.aheadX
        );
    const ty = clampY(
      c
        ? c.y - CAMERA.celebrateLift
        : CAMERA.ballWeight * f.ballY +
            (1 - CAMERA.ballWeight) * f.playerY +
            this.aheadY
    );
    [this.fx, this.velX] = smoothDamp(
      this.fx,
      tx,
      this.velX,
      CAMERA.followSec,
      dtSec
    );
    [this.fy, this.velY] = smoothDamp(
      this.fy,
      ty,
      this.velY,
      CAMERA.followSec,
      dtSec
    );

    // Exponential ease that is ~95% done after zoomReturnSec.
    const zk = 1 - Math.exp((-3 * dtSec) / CAMERA.zoomReturnSec);
    const zoomTo = c ? CAMERA.celebrateZoom : this.targetZoom;
    this.zoom += (zoomTo - this.zoom) * zk;

    this.projector.setFocus(this.fx, this.fy, this.zoom);
  }
}

// Critically damped spring toward `target` that reaches it in roughly
// `smoothSec` without overshoot; returns the new value and velocity.
// (Game Programming Gems 4, "Critically Damped Ease-In/Ease-Out Smoothing".)
function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothSec: number,
  dt: number
): [number, number] {
  const omega = 2 / Math.max(0.0001, smoothSec);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

function clampX(x: number) {
  return Math.max(CAMERA.focusMinX, Math.min(CAMERA.focusMaxX, x));
}

function clampY(y: number) {
  return Math.max(CAMERA.focusMinY, Math.min(CAMERA.focusMaxY, y));
}
