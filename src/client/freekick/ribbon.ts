import type Phaser from 'phaser';

// A point of a ribbon on screen: half width and opacity there.
export type RibbonPoint = { x: number; y: number; w: number; a: number };
// Drawn widest first: share of the width, colour, share of the opacity.
export type RibbonLayer = readonly [
  width: number,
  color: number,
  alpha: number,
];

// A smooth strip through the points with a round head at the last one.
// Neighbouring pieces share their edge, so thick strips have no gaps at the
// joints and see-through ones no darker overlaps. `pick` gives the graphics
// for the piece ending at point i (the flight trail is split by depth).
export function drawRibbon(
  pts: readonly RibbonPoint[],
  layers: readonly RibbonLayer[],
  pick: (i: number) => Phaser.GameObjects.Graphics | undefined
) {
  const n = pts.length;
  if (n < 2) return;
  // One normal per point, across the direction between its neighbours.
  const nx: number[] = [];
  const ny: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[Math.max(0, i - 1)];
    const q = pts[Math.min(n - 1, i + 1)];
    const dx = (q?.x ?? 0) - (p?.x ?? 0);
    const dy = (q?.y ?? 0) - (p?.y ?? 0);
    const len = Math.hypot(dx, dy) || 1;
    nx.push(-dy / len);
    ny.push(dx / len);
  }
  for (const [width, color, alpha] of layers) {
    for (let i = 1; i < n; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const g = pick(i);
      if (!p || !q || !g) continue;
      const pw = p.w * width;
      const qw = q.w * width;
      const px = (nx[i - 1] ?? 0) * pw;
      const py = (ny[i - 1] ?? 0) * pw;
      const qx = (nx[i] ?? 0) * qw;
      const qy = (ny[i] ?? 0) * qw;
      g.fillStyle(color, (alpha * (p.a + q.a)) / 2);
      g.fillTriangle(
        p.x + px,
        p.y + py,
        p.x - px,
        p.y - py,
        q.x + qx,
        q.y + qy
      );
      g.fillTriangle(
        p.x - px,
        p.y - py,
        q.x - qx,
        q.y - qy,
        q.x + qx,
        q.y + qy
      );
    }
    const head = pts[n - 1];
    const g = pick(n - 1);
    if (head && g)
      g.fillStyle(color, alpha * head.a).fillCircle(
        head.x,
        head.y,
        head.w * width
      );
  }
}

// Rounds the corners of a finger-drawn line (Chaikin's corner cutting).
export function smoothLine(
  pts: readonly { x: number; y: number }[]
): { x: number; y: number }[] {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last || pts.length < 3) return [...pts];
  const out: { x: number; y: number }[] = [first];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    if (!p || !q) continue;
    out.push(
      { x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 },
      { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 }
    );
  }
  out.push(last);
  return out;
}
