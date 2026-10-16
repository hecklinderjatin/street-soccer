// Small math helpers shared by the simulation systems.

export const DEG = Math.PI / 180;

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Signed smallest difference a - b, in (-PI, PI].
export function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Distance from point P to segment AB.
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Turns angle `from` toward `to` by at most `maxStep` radians.
export function rotateTowards(from: number, to: number, maxStep: number) {
  const diff = angleDiff(to, from);
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}
