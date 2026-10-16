import Phaser from 'phaser';
import { GLYPHS } from './glyphs';
import { PAL, PX } from './palette';

export const PIXEL_FONT = 'pixel';

// Each cell holds the 5x7 glyph plus a 1-pixel drop shadow and a 1-pixel gap.
const CELL_W = 7;
const CELL_H = 9;

// Builds the font texture from GLYPHS and registers it as a retro bitmap font.
// Glyphs are white with a black shadow, so a tint recolours the ink only.
export function createPixelFont(scene: Phaser.Scene) {
  if (scene.cache.bitmapFont.exists(PIXEL_FONT)) return;

  const chars = Object.keys(GLYPHS).join('');
  const texture = scene.textures.createCanvas(
    PIXEL_FONT,
    chars.length * CELL_W,
    CELL_H
  );
  if (!texture) return;
  const ctx = texture.getContext();

  [...chars].forEach((char, i) => {
    const rows = (GLYPHS[char] ?? '').split(' ');
    for (const [color, offset] of [
      ['#000000', 1],
      ['#ffffff', 0],
    ] as const) {
      ctx.fillStyle = color;
      rows.forEach((row, y) => {
        [...row].forEach((cell, x) => {
          if (cell === '#')
            ctx.fillRect(i * CELL_W + x + offset, y + offset, 1, 1);
        });
      });
    }
  });
  texture.refresh();

  scene.cache.bitmapFont.add(
    PIXEL_FONT,
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: PIXEL_FONT,
      width: CELL_W,
      height: CELL_H,
      chars,
      charsPerRow: chars.length,
      'spacing.x': 0,
      'spacing.y': 0,
      'offset.x': 0,
      'offset.y': 0,
      lineSpacing: 2,
    })
  );
}

// Paints text straight into a canvas (for baked art such as graffiti).
// `scale` is canvas pixels per font pixel; an optional shadow sits 1 scale-step down-right.
export function paintPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string,
  shadow?: string
) {
  const layers: [string, number][] = shadow
    ? [
        [shadow, scale],
        [color, 0],
      ]
    : [[color, 0]];
  for (const [fillStyle, offset] of layers) {
    ctx.fillStyle = fillStyle;
    [...text.toUpperCase()].forEach((char, i) => {
      (GLYPHS[char] ?? '').split(' ').forEach((row, gy) => {
        [...row].forEach((cell, gx) => {
          if (cell === '#') {
            ctx.fillRect(
              x + (i * 6 + gx) * scale + offset,
              y + gy * scale + offset,
              scale,
              scale
            );
          }
        });
      });
    });
  }
}

// Pixel text. `size` is how many logical px one font pixel takes (PX by default).
export function pixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number = PX,
  color: number = PAL.white
) {
  return scene.add
    .bitmapText(x, y, PIXEL_FONT, text.toUpperCase(), CELL_W * size)
    .setTint(color);
}
