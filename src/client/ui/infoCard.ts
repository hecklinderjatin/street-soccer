import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import { PAL, PX } from './palette';
import { CELL_W, pixelText } from './pixelFont';

// The look of the full-time results card (style.css .results-*), redrawn on
// the landscape game canvas for the i button's two info pages: a dark navy
// card with a coloured top edge, a mode tag and the page number above.

export const CARD = {
  x: 40,
  y: 20,
  width: VIEW.width - 80,
  height: VIEW.height - 40,
  fill: 0x0c192a,
  border: 0x3b506b,
  tile: 0x112037, // stat tiles and grouped sections
  tileBorder: 0x293e58,
  team: 0x15253b,
  muted: 0x91a4bc,
  soft: 0xa8b9cd,
  secondary: 0x22354c, // secondary buttons (casual-button.secondary)
} as const;

export const BODY = 0.5 * PX;

type Item = Phaser.GameObjects.GameObject;

// Backdrop, card and header row (mode tag left, page right).
export function infoFrame(
  scene: Phaser.Scene,
  items: Item[],
  options: { accent: number; tag?: string; tagColor?: number; page: string }
) {
  // Dim the match and swallow taps behind the card.
  items.push(
    scene.add
      .rectangle(0, 0, VIEW.width, VIEW.height, 0x070e19, 0.86)
      .setOrigin(0)
      .setInteractive()
  );
  const g = scene.add.graphics();
  // The results screen's soft glow from the top.
  g.fillStyle(0x243958, 0.35).fillEllipse(VIEW.width / 2, 0, 1100, 320);
  // Hard pixel drop shadow, card, border and the coloured top edge.
  g.fillStyle(PAL.black, 0.35).fillRect(
    CARD.x + 10,
    CARD.y + 12,
    CARD.width,
    CARD.height
  );
  g.fillStyle(CARD.fill, 0.97).fillRect(
    CARD.x,
    CARD.y,
    CARD.width,
    CARD.height
  );
  g.lineStyle(2, CARD.border, 1).strokeRect(
    CARD.x,
    CARD.y,
    CARD.width,
    CARD.height
  );
  g.fillStyle(options.accent, 1).fillRect(CARD.x, CARD.y, CARD.width, 6);
  items.push(g);
  if (options.tag)
    tag(
      scene,
      items,
      CARD.x + 32,
      52,
      options.tag,
      options.tagColor ?? PAL.yellow
    );
  items.push(
    pixelText(
      scene,
      CARD.x + CARD.width - 32,
      52,
      options.page,
      BODY,
      CARD.muted
    ).setOrigin(1, 0.5)
  );
}

// An outlined tag like .results-mode, left edge at x, centred on y.
export function tag(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  y: number,
  text: string,
  color: number
) {
  const label = pixelText(scene, x + 12, y, text, BODY, color).setOrigin(
    0,
    0.5
  );
  const w = label.displayWidth + 24;
  const box = scene.add
    .rectangle(x, y, w, 30, color, 0.08)
    .setOrigin(0, 0.5)
    .setStrokeStyle(2, color, 0.4);
  items.push(box, label);
  return w;
}

// A flat panel like .results-stats > div (fill plus a 2 px border).
export function tile(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = CARD.tile
) {
  items.push(
    scene.add
      .rectangle(x, y, w, h, fill)
      .setOrigin(0)
      .setStrokeStyle(2, CARD.tileBorder)
  );
}

// Shrinks a text to fit `maxWidth` one whole screen pixel per font pixel at
// a time (a fractional size garbles the pixel letters), never below 2.
export function fit<T extends Phaser.GameObjects.BitmapText>(
  text: T,
  maxWidth: number
) {
  let size = Math.round(text.fontSize / CELL_W);
  while (text.displayWidth > maxWidth && size > 2) {
    size -= 1;
    text.setFontSize(CELL_W * size);
  }
  return text;
}
