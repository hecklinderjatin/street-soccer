import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import { PAL, PX } from './palette';

const KEY = 'backdrop-street';
const WALL_H = 440; // px of brick wall before the pavement starts

// Pixel-art street used behind the menu and result screens: a brick wall
// with a pavement kerb and dithered asphalt. Baked into a texture once.
export function addStreetBackdrop(scene: Phaser.Scene) {
  if (!scene.textures.exists(KEY)) {
    const g = scene.add.graphics();
    const rand = seededRandom(7);

    // Brick wall: 8x4 art-pixel bricks, every other row offset by half.
    const bw = 8 * PX;
    const bh = 4 * PX;
    g.fillStyle(PAL.plum, 1);
    g.fillRect(0, 0, VIEW.width, WALL_H);
    for (let row = 0; row * bh < WALL_H; row++) {
      const shift = row % 2 === 0 ? 0 : -bw / 2;
      for (let x = shift; x < VIEW.width; x += bw) {
        g.fillStyle(rand() < 0.15 ? PAL.darkGray : PAL.brown, 1);
        g.fillRect(x + PX, row * bh + PX, bw - PX, bh - PX);
      }
    }

    // Kerb, then asphalt with a sparse dither of lighter pixels.
    g.fillStyle(PAL.lightGray, 1);
    g.fillRect(0, WALL_H, VIEW.width, 3 * PX);
    g.fillStyle(PAL.darkGray, 1);
    g.fillRect(0, WALL_H + 3 * PX, VIEW.width, PX);
    g.fillStyle(PAL.navy, 1);
    g.fillRect(0, WALL_H + 4 * PX, VIEW.width, VIEW.height - WALL_H - 4 * PX);
    g.fillStyle(PAL.darkGray, 1);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor((rand() * VIEW.width) / PX) * PX;
      const y =
        WALL_H +
        5 * PX +
        Math.floor((rand() * (VIEW.height - WALL_H)) / PX) * PX;
      g.fillRect(x, y, PX, PX);
    }

    // Chalk centre line on the street.
    g.fillStyle(PAL.white, 0.8);
    for (let x = 0; x < VIEW.width; x += 16 * PX) {
      g.fillRect(x, 610, 10 * PX, PX);
    }

    g.generateTexture(KEY, VIEW.width, VIEW.height);
    g.destroy();
  }
  return scene.add.image(0, 0, KEY).setOrigin(0);
}

// Small deterministic RNG so the backdrop looks the same every time.
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
