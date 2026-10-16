import Phaser from 'phaser';

// Helpers for painting textures at art-pixel resolution. Textures are tiny
// (one texel = one art pixel) and shown with setScale(PX).

export type FrameRect = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function hex(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

// Creates a canvas texture once and paints it. Returns false if it already existed.
export function makeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  frames: readonly FrameRect[] = []
) {
  if (scene.textures.exists(key)) return false;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return false;
  paint(texture.getContext());
  for (const f of frames) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  texture.refresh();
  return true;
}

export function fill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1
) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex(color);
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  ctx.globalAlpha = 1;
}

// Paints rows of characters; each character maps to a colour, '.' is empty.
export function paintRows(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  palette: Readonly<Record<string, number>>,
  ox = 0,
  oy = 0
) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (color !== undefined) fill(ctx, ox + x, oy + y, 1, 1, color);
    });
  });
}

// Filled ring (annulus) between rInner and rOuter around (cx, cy).
export function paintRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  color: number,
  alpha = 1
) {
  for (let y = Math.floor(cy - rOuter); y <= Math.ceil(cy + rOuter); y++) {
    for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rOuter && d >= rInner) fill(ctx, x, y, 1, 1, color, alpha);
    }
  }
}

// Filled ellipse ring, used for flat markers on the ground.
export function paintEllipseRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  thickness: number,
  color: number,
  alpha = 1
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const outer = nx * nx + ny * ny;
      const ix = (x + 0.5 - cx) / Math.max(1, rx - thickness);
      const iy = (y + 0.5 - cy) / Math.max(1, ry - thickness);
      const inner = ix * ix + iy * iy;
      if (outer <= 1 && inner >= 1) fill(ctx, x, y, 1, 1, color, alpha);
    }
  }
}
