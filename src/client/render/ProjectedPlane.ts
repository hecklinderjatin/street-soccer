import Phaser from 'phaser';
import { newProjected, type Projector } from './Projector';

export type Vec3 = { x: number; y: number; z: number };

// Texture corners in world space: t = top of the texture, b = bottom, l/r = left/right.
export type PlaneCorners = { tl: Vec3; tr: Vec3; bl: Vec3; br: Vec3 };

export type PlaneOptions = {
  cols: number; // grid resolution; more cells = less texture warping
  rows: number;
  uv?: { u0: number; v0: number; u1: number; v1: number }; // sub-rectangle of the texture
};

const tmp = newProjected();

// A flat textured surface in the 3D world (ground, wall, fence) drawn in
// perspective. It is a Phaser Mesh whose vertex screen positions (vx, vy) we
// set every frame from the Projector; the Mesh's own 3D pipeline is unused
// (it is removed from the update list so preUpdate never overwrites them).
// The grid keeps the per-triangle affine texture warping invisible.
export class ProjectedPlane {
  readonly mesh: Phaser.GameObjects.Mesh;
  private readonly world: Float32Array; // x, y, z per mesh vertex

  constructor(
    scene: Phaser.Scene,
    texture: string,
    corners: PlaneCorners,
    options: PlaneOptions
  ) {
    const { cols, rows } = options;
    const uv = options.uv ?? { u0: 0, v0: 0, u1: 1, v1: 1 };

    const points: Vec3[] = [];
    const verts: number[] = [];
    const uvs: number[] = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const v = r / rows;
        points.push(bilinear(corners, u, v));
        verts.push(u, v); // placeholder model coords; screen positions are set in update()
        uvs.push(uv.u0 + (uv.u1 - uv.u0) * u, uv.v0 + (uv.v1 - uv.v0) * v);
      }
    }
    const indices: number[] = [];
    const stride = cols + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * stride + c;
        indices.push(i, i + stride, i + 1, i + 1, i + stride, i + stride + 1);
      }
    }

    this.mesh = scene.add.mesh(0, 0, texture);
    this.mesh.hideCCW = false;
    this.mesh.addVertices(verts, uvs, indices);
    scene.sys.updateList.remove(this.mesh);

    // Mesh vertices are created one per index, so map each back to its grid point.
    this.world = new Float32Array(indices.length * 3);
    indices.forEach((pointIndex, i) => {
      const p = points[pointIndex];
      if (!p) return;
      this.world[i * 3] = p.x;
      this.world[i * 3 + 1] = p.y;
      this.world[i * 3 + 2] = p.z;
    });
  }

  update(projector: Projector) {
    const w = this.world;
    this.mesh.vertices.forEach((vertex, i) => {
      projector.project(
        w[i * 3] ?? 0,
        w[i * 3 + 1] ?? 0,
        w[i * 3 + 2] ?? 0,
        tmp
      );
      vertex.vx = tmp.x;
      vertex.vy = tmp.y;
    });
  }
}

export function bilinear(c: PlaneCorners, u: number, v: number): Vec3 {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const top = {
    x: lerp(c.tl.x, c.tr.x, u),
    y: lerp(c.tl.y, c.tr.y, u),
    z: lerp(c.tl.z, c.tr.z, u),
  };
  const bot = {
    x: lerp(c.bl.x, c.br.x, u),
    y: lerp(c.bl.y, c.br.y, u),
    z: lerp(c.bl.z, c.br.z, u),
  };
  return {
    x: lerp(top.x, bot.x, v),
    y: lerp(top.y, bot.y, v),
    z: lerp(top.z, bot.z, v),
  };
}
