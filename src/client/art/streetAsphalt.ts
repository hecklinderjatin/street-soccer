// Painted once into the court texture; coordinates are art pixels.
// Warm, rough neighbourhood tarmac, with remnants of an older painted court.
export function paintStreetAsphalt(
  ctx: CanvasRenderingContext2D,
  ox: number,
  width: number,
  height: number,
  rand: () => number
) {
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  const image = ctx.createImageData(w, h);
  const coarse = noiseField(w, h, 80, rand);
  const fine = noiseField(w, h, 18, rand);
  const patches = [
    { x: w * 0.12, y: h * 0.12, w: w * 0.15, h: h * 0.16, shade: -10 },
    { x: w * 0.67, y: h * 0.78, w: w * 0.19, h: h * 0.13, shade: -13 },
    { x: w * 0.88, y: h * 0.14, w: w * 0.08, h: h * 0.2, shade: 7 },
    { x: w * 0.4, y: h * 0.06, w: w * 0.2, h: h * 0.07, shade: -8 },
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const broad = coarse(x, y);
      const grain = fine(x, y);
      const goalWear = Math.max(
        0,
        1 - Math.hypot(x / (w * 0.13), (y - h / 2) / (h * 0.23)),
        1 - Math.hypot((w - x) / (w * 0.13), (y - h / 2) / (h * 0.23))
      );
      const centreWear = Math.max(
        0,
        1 - Math.hypot((x - w / 2) / (w * 0.16), (y - h / 2) / (h * 0.24))
      );
      const wear = goalWear * goalWear * 12 + centreWear * centreWear * 5;
      const edge = Math.max(0, 1 - Math.min(x, w - x, y, h - y) / 16);
      let repair = 0;
      for (const p of patches) {
        const jag = Math.round(grain * 3);
        const dx = x - p.x - jag;
        const dy = y - p.y - jag;
        if (dx >= 0 && dy >= 0 && dx < p.w && dy < p.h) {
          repair = p.shade;
          if (Math.min(dx, dy, p.w - dx, p.h - dy) < 1.5) repair -= 12;
        }
      }
      // Exposed stone flecks and dark pits; polished goal areas have less grit.
      const grit =
        rand() < 0.13 * (1 - goalWear * 0.5) ? (rand() < 0.65 ? -8 : 11) : 0;
      const wornPaint = oldCourtPaint(x, y, w, h) && rand() > 0.42;
      // Small boot scrapes break up the smoother wear around each goal.
      const scuff = goalWear > 0.15 && grain > 0.22 && y % 9 < 1 ? -5 : 0;
      const tone = Math.round(
        Math.round(broad * 4) * 2 +
          grain * 3 +
          wear -
          edge * 12 +
          repair +
          grit +
          scuff
      );
      const i = (y * w + x) * 4;
      image.data[i] = 95 + tone + Math.round(edge * 5) + (wornPaint ? 11 : 0);
      image.data[i + 1] = 88 + tone + (wornPaint ? 7 : 0);
      image.data[i + 2] =
        82 + tone - Math.round(edge * 3) + (wornPaint ? 1 : 0);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, ox, 0);

  // Short sealed cracks stay toward the boundaries, away from centre play.
  ctx.fillStyle = '#302e2c';
  ctx.globalAlpha = 0.55;
  for (let n = 0; n < 12; n++) {
    let x = w * (0.08 + rand() * 0.84);
    let y = (n % 2 ? 0.86 : 0.1) * h;
    const direction = rand() < 0.5 ? -1 : 1;
    for (let s = 0; s < 12 + n * 2; s++) {
      ctx.fillRect(ox + Math.floor(x), Math.floor(y), 1, 1);
      if (s === 8 || s === 16)
        ctx.fillRect(ox + Math.floor(x), Math.floor(y) + 1, 1, 3);
      x += direction;
      y += rand() < 0.35 ? (rand() < 0.5 ? -1 : 1) : 0;
    }
  }
  ctx.globalAlpha = 1;
}

// Ghost basketball keys/arcs from the court's earlier life, broken and faded
// enough that the bright current football markings remain easy to follow.
function oldCourtPaint(x: number, y: number, w: number, h: number) {
  const cy = h / 2;
  const keyHalf = h * 0.11;
  const keyDepth = w * 0.12;
  for (const side of [-1, 1]) {
    const fromEnd = side < 0 ? x : w - x;
    if (
      fromEnd > w * 0.025 &&
      fromEnd < keyDepth &&
      Math.abs(Math.abs(y - cy) - keyHalf) < 0.9
    )
      return true;
    if (Math.abs(fromEnd - keyDepth) < 0.9 && Math.abs(y - cy) < keyHalf)
      return true;
    const arc = Math.hypot(fromEnd - w * 0.03, y - cy);
    if (fromEnd > w * 0.035 && Math.abs(arc - h * 0.29) < 0.8) return true;
  }
  return false;
}

function noiseField(w: number, h: number, cell: number, rand: () => number) {
  const cols = Math.ceil(w / cell) + 2;
  const grid = Array.from(
    { length: cols * (Math.ceil(h / cell) + 2) },
    () => rand() * 2 - 1
  );
  return (x: number, y: number) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const tx = x / cell - cx;
    const ty = y / cell - cy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = grid[cy * cols + cx] ?? 0;
    const b = grid[cy * cols + cx + 1] ?? 0;
    const c = grid[(cy + 1) * cols + cx] ?? 0;
    const d = grid[(cy + 1) * cols + cx + 1] ?? 0;
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}
