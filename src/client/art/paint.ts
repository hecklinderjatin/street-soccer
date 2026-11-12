// The painting helpers the baked court needs, with no Phaser and no DOM
// types, so scripts/bake-court.ts can run them in Node on a software
// canvas (scripts/softCanvas.ts). pixelArt.ts re-exports them.

export type ImageDataLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

// The part of a 2D canvas context the painters use.
export type PaintCtx = {
  fillStyle: unknown;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  createImageData(width: number, height: number): ImageDataLike;
  putImageData(image: ImageDataLike, dx: number, dy: number): void;
};

export function hex(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function fill(
  ctx: PaintCtx,
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

// Filled ring (annulus) between rInner and rOuter around (cx, cy).
export function paintRing(
  ctx: PaintCtx,
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

// Small deterministic RNG so baked art looks the same every time.
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
