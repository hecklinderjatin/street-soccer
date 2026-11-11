import Phaser from 'phaser';
import { FREE_KICK_GROUND_EXTENT } from '../art/pitchArt';
import { carKey, createCarTexture } from '../art/sceneryArt';
import { newProjected } from '../render/Projector';
import { seededRandom } from '../ui/backdrop';
import { PX } from '../ui/palette';
import type { KickCamera } from './KickCamera';
import { GOAL_X, GOAL_Y } from './rules';

// Cloud profiles in art pixels, from the crown down to the shaded underside.
const CLOUD_ROWS = [
  [9, 15],
  [7, 17],
  [6, 19],
  [4, 23],
  [3, 26],
  [1, 29],
  [0, 31],
  [1, 32],
  [3, 31],
  [6, 27],
] as const;

const CLOUDS = [
  { start: 0.16, altitude: 0.59, size: 3.4, speed: 0.013 },
  { start: 0.57, altitude: 0.73, size: 2.4, speed: 0.008 },
  { start: 0.92, altitude: 0.87, size: 2, speed: 0.006 },
  { start: 0.41, altitude: 0.94, size: 1.4, speed: 0.004 },
];

const CROWN_ROWS = [
  [-0.14, 0.16],
  [-0.26, 0.27],
  [-0.33, 0.31],
  [-0.41, 0.35],
  [-0.43, 0.42],
  [-0.38, 0.45],
  [-0.33, 0.37],
  [-0.21, 0.27],
] as const;

const ROAD_START = FREE_KICK_GROUND_EXTENT.x1 + 30;
const ROAD_WIDTH = 340;
const ROAD_HALF_LENGTH = 3800;
const TRAFFIC = [
  { lane: 0.25, speed: 184, offset: 3500, color: 0 },
  { lane: 0.25, speed: 184, offset: 2200, color: 4 },
  { lane: 0.25, speed: 184, offset: 5350, color: 6 },
  { lane: 0.75, speed: -152, offset: 4180, color: 2 },
  { lane: 0.75, speed: -152, offset: 1650, color: 5 },
  { lane: 0.75, speed: -152, offset: 6260, color: 1 },
];

export class Daylight {
  private readonly cars: Phaser.GameObjects.Image[];
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  private readonly point = newProjected();
  private readonly trees = [0, 1].flatMap((row) => {
    const random = seededRandom(40 + row);
    return Array.from({ length: 18 }, (_, i) => ({
      x: ROAD_START + ROAD_WIDTH + 75 + (1 - row) * 860 + random() * 330,
      y: GOAL_Y + (i - 9) * 410 + random() * 365,
      height: 95 + random() * 120,
      width: 0.74 + random() * 0.64,
      pine: random() < 0.35,
      color: row === 0 ? 0x8daa85 : random() < 0.5 ? 0x536e47 : 0x67784a,
      light: row === 0 ? 0xa0b794 : 0x789354,
    }));
  });

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number
  ) {
    this.art = scene.add.graphics().setDepth(depth);
    this.cars = TRAFFIC.map(({ color, speed }) => {
      createCarTexture(scene, color);
      return scene.add
        .image(0, 0, carKey(color))
        .setDepth(depth + (speed > 0 ? 0.5 : 0.25))
        .setOrigin(0.5, 1)
        .setFlipX(speed > 0);
    });
  }

  render(cam: KickCamera, timeSec: number) {
    const { width, height } = this.scene.scale;
    const p = cam.project(GOAL_X + 1_000_000, GOAL_Y, 0, this.point);
    const horizon = Phaser.Math.Clamp(p.y, 0, height);
    const unit = Math.max(1, Math.min(width, height) / 720);
    const drift = Phaser.Math.Clamp(p.x - width / 2, -width / 2, width / 2);
    const g = this.art.clear();
    g.fillStyle(0xa9b896).fillRect(0, horizon, width, height - horizon);
    g.fillGradientStyle(0x4a98d3, 0x5ba9dd, 0xcfeafa, 0xe7f0e2).fillRect(
      0,
      0,
      width,
      horizon
    );

    const sunX = width * 0.76 + drift * 0.15;
    const sunY = horizon * 0.55;
    if (sunY > 36 * unit) {
      g.fillStyle(0xffedb5, 0.16).fillCircle(sunX, sunY, 40 * unit);
      g.fillStyle(0xffefb9, 0.3).fillCircle(sunX, sunY, 31 * unit);
      g.fillStyle(0xfff3cb).fillCircle(sunX, sunY, 23 * unit);
    }

    const time = this.reducedMotion.matches ? 0 : timeSec;
    for (const cloud of CLOUDS) {
      const step = cloud.size * unit;
      const span = width + 64 * step;
      const x =
        Phaser.Math.Wrap(
          cloud.start * span + time * width * cloud.speed + drift * 0.27,
          0,
          span
        ) -
        32 * step;
      const y = horizon * cloud.altitude - 10 * step;
      CLOUD_ROWS.forEach(([left, right], row) => {
        g.fillStyle(row < 7 ? 0xf4fbff : 0xc1d9e8, 0.92).fillRect(
          Math.round(x + left * step),
          Math.round(y + row * step),
          Math.ceil((right - left) * step),
          Math.ceil(step)
        );
      });
    }

    // A loose flock alternates between flapping and gliding.
    const flockX = Phaser.Math.Wrap(
      width * 0.28 + time * width * 0.032,
      -90,
      width + 95
    );
    for (let i = 0; i < 5; i++) {
      const x = flockX - i * 15 * unit;
      const y =
        horizon * 0.65 + (i % 2) * 6 * unit + Math.sin(time * 0.7) * 6 * unit;
      const wing = Math.sin(time * 7 - i * 1.3) * 2.5 * unit;
      g.lineStyle(unit * 1.4, 0x435b6b, 0.85)
        .beginPath()
        .moveTo(x - 5 * unit, y - wing)
        .lineTo(x, y)
        .lineTo(x + 5 * unit, y - wing)
        .strokePath();
    }

    // Open gaps between irregular stands let the road and sky read clearly.
    for (const tree of this.trees) {
      cam.project(tree.x, tree.y, 0, p);
      if (p.x < -130 || p.x > width + 130) continue;
      const size = tree.height * p.scale;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      g.fillStyle(0x687455).fillRect(
        x - size * 0.035,
        y - size * 0.44,
        size * 0.07,
        size * 0.44
      );
      if (tree.pine) {
        for (let tier = 0; tier < 3; tier++) {
          const top = y - size + tier * size * 0.17;
          const spread = size * (0.19 + tier * 0.075) * tree.width;
          g.fillStyle(tree.color).fillTriangle(
            x,
            top,
            x - spread,
            top + size * 0.37,
            x + spread,
            top + size * 0.37
          );
          g.fillStyle(tree.light).fillTriangle(
            x,
            top,
            x + spread,
            top + size * 0.37,
            x + spread * 0.42,
            top + size * 0.35
          );
        }
        continue;
      }
      const step = size * 0.09;
      CROWN_ROWS.forEach(([left, right], row) => {
        const top = y - size + row * step;
        const spread = tree.width;
        g.fillStyle(tree.color).fillRect(
          x + left * size * spread,
          top,
          (right - left) * size * spread,
          step
        );
        if (row < 5)
          g.fillStyle(tree.light).fillRect(
            x + left * size * 0.45,
            top,
            (right - left) * size * 0.42,
            step
          );
      });
    }
    this.drawTraffic(cam, time);
  }

  private drawTraffic(cam: KickCamera, time: number) {
    const g = this.art;
    const start = GOAL_Y - ROAD_HALF_LENGTH;
    const end = GOAL_Y + ROAD_HALF_LENGTH;
    const strip = (
      x0: number,
      x1: number,
      y0: number,
      y1: number,
      color: number
    ) => {
      g.fillStyle(color).beginPath();
      const p = cam.project(x0, y0, 0, this.point);
      g.moveTo(p.x, p.y);
      cam.project(x0, y1, 0, p);
      g.lineTo(p.x, p.y);
      cam.project(x1, y1, 0, p);
      g.lineTo(p.x, p.y);
      cam.project(x1, y0, 0, p);
      g.lineTo(p.x, p.y).closePath().fillPath();
    };
    const far = ROAD_START + ROAD_WIDTH;
    strip(ROAD_START - 24, far + 24, start, end, 0xb5af95);
    strip(ROAD_START, far, start, end, 0x535e63);
    strip(ROAD_START + 12, ROAD_START + 19, start, end, 0xd1ccc0);
    strip(far - 19, far - 12, start, end, 0xd1ccc0);
    const center = ROAD_START + ROAD_WIDTH / 2;
    for (let y = start; y < end - 95; y += 230)
      strip(center - 4, center + 4, y, y + 95, 0xe1c37d);

    TRAFFIC.forEach(({ lane, offset, speed }, index) => {
      const y = start + Phaser.Math.Wrap(offset + time * speed, 0, end - start);
      const p = cam.project(ROAD_START + lane * ROAD_WIDTH, y, 0, this.point);
      this.cars[index]?.setPosition(p.x, p.y).setScale(PX * p.scale);
    });
  }
}
