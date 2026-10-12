import { CAMERA, VIEW } from '../../shared/tuning';

export type Projected = {
  x: number; // screen x
  y: number; // screen y
  scale: number; // screen px per world px at this point
  depth: number; // distance along the view direction
};

const TILT = (CAMERA.tiltDeg * Math.PI) / 180;
const SIN = Math.sin(TILT);
const COS = Math.cos(TILT);
// Focal length in screen px for the vertical field of view.
const FOCAL = VIEW.height / 2 / Math.tan((CAMERA.fovDeg * Math.PI) / 360);

// Perspective "broadcast" camera. The world is a ground plane (x, y) with
// height z; the camera sits on the near side (large y), raised, looking
// toward the far side (small y) and tilted down. It never rotates sideways,
// so lines along x stay horizontal and lines along y converge.
export class Projector {
  private camX = 0;
  private camY = 0;
  private camZ = 0;

  // Centres the view on a ground point. zoom < 1 pulls the camera back.
  setFocus(fx: number, fy: number, zoom: number) {
    const dist = FOCAL / (CAMERA.focusScale * zoom);
    this.camX = fx;
    this.camY = fy + dist * COS;
    this.camZ = dist * SIN;
  }

  // Writes the projection of (x, y, z) into `out` and returns it.
  project(x: number, y: number, z: number, out: Projected): Projected {
    const forward = this.camY - y;
    const dz = z - this.camZ;
    const up = forward * SIN + dz * COS;
    const depth = Math.max(CAMERA.nearClip, forward * COS - dz * SIN);
    const scale = FOCAL / depth;
    out.x = VIEW.width / 2 + (x - this.camX) * scale;
    out.y = VIEW.height / 2 - up * scale;
    out.scale = scale;
    out.depth = depth;
    return out;
  }

  // How much a flat ground marker at (x, y) is squashed vertically on screen
  // (1 = not at all), for drawing circles on the ground.
  groundSquash(x: number, y: number) {
    const a = this.project(x, y - 10, 0, scratchA);
    const b = this.project(x, y + 10, 0, scratchB);
    return (b.y - a.y) / 20 / ((a.scale + b.scale) / 2);
  }
}

export const newProjected = (): Projected => ({
  x: 0,
  y: 0,
  scale: 1,
  depth: 1,
});
const scratchA = newProjected();
const scratchB = newProjected();
