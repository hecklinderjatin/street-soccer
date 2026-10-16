import Phaser from 'phaser';
import { PITCH } from '../../shared/tuning';
import { PAL, PX } from '../ui/palette';
import { newProjected, type Projector } from './Projector';

type Pt = { x: number; y: number };

const a = newProjected();
const b = newProjected();

const CHALK_WIDTH = PX; // world px; drawn at this x the local perspective scale ...
const MIN_PX = 2; // ... but never thinner than this on screen, so it can't vanish
const MAX_PX = 6;
const SEGMENT = 80; // long lines are split so their width follows the perspective

// Pitch markings drawn as projected lines every frame. Painted into the
// ground texture they were one art pixel wide; far from the camera that
// shrank below 2 screen pixels and, with crisp nearest-neighbour sampling,
// the lines flickered in and out as the camera moved. As geometry they are
// always visible, a little thicker toward the camera.
export class PitchLines {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly lines: Pt[][];

  constructor(scene: Phaser.Scene, depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
    this.lines = buildMarkings();
  }

  update(projector: Projector) {
    const g = this.g;
    g.clear();
    for (const line of this.lines) {
      for (let i = 1; i < line.length; i++) {
        const p = line[i - 1];
        const q = line[i];
        if (!p || !q) continue;
        const steps = Math.max(
          1,
          Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / SEGMENT)
        );
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          projector.project(
            p.x + (q.x - p.x) * t0,
            p.y + (q.y - p.y) * t0,
            0,
            a
          );
          projector.project(
            p.x + (q.x - p.x) * t1,
            p.y + (q.y - p.y) * t1,
            0,
            b
          );
          const width = Math.min(
            MAX_PX,
            Math.max(MIN_PX, (CHALK_WIDTH * (a.scale + b.scale)) / 2)
          );
          g.lineStyle(width, PAL.white, 0.9).lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }
  }
}

// All markings as world-space polylines on the ground.
function buildMarkings(): Pt[][] {
  const W = PITCH.width;
  const H = PITCH.height;
  const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
    { x: x0, y: y0 },
  ];
  const circle = (cx: number, cy: number, r: number, n: number): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r };
    });

  const bd = PITCH.boxDepth;
  const by0 = (H - PITCH.boxHeight) / 2;
  const by1 = (H + PITCH.boxHeight) / 2;
  const gd = PITCH.goalAreaDepth;
  const gy0 = (H - PITCH.goalAreaHeight) / 2;
  const gy1 = (H + PITCH.goalAreaHeight) / 2;
  const spot = bd - 80; // penalty spot distance from the goal line

  return [
    rect(0, 0, W, H),
    [
      { x: W / 2, y: 0 },
      { x: W / 2, y: H },
    ],
    circle(W / 2, H / 2, PITCH.centerCircle, 64),
    circle(W / 2, H / 2, 5, 8),
    rect(0, by0, bd, by1),
    rect(W - bd, by0, W, by1),
    rect(0, gy0, gd, gy1),
    rect(W - gd, gy0, W, gy1),
    circle(spot, H / 2, 4, 8),
    circle(W - spot, H / 2, 4, 8),
  ];
}
