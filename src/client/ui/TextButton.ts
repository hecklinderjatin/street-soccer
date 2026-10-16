import Phaser from 'phaser';
import { PAL, PX } from './palette';
import { pixelText } from './pixelFont';

export type TextButtonOptions = {
  width?: number;
  height?: number;
  fill?: number;
  textColor?: number;
  textSize?: number; // logical px per font pixel
};

// A chunky pixel-art button. It sinks on touch down (instant feedback) and
// fires on release, so a thumb that slides off cancels the press.
export class TextButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Container;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private fill: number;
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    options: TextButtonOptions = {}
  ) {
    super(scene, x, y);
    this.buttonWidth = snap(options.width ?? 264);
    this.buttonHeight = snap(options.height ?? 72);
    this.fill = options.fill ?? PAL.orange;

    const shadow = scene.add.graphics();
    drawStepped(shadow, this.buttonWidth, this.buttonHeight, PX, PAL.black);
    this.bg = scene.add.graphics();
    const text = pixelText(
      scene,
      0,
      0,
      label,
      options.textSize ?? PX,
      options.textColor ?? PAL.white
    ).setOrigin(0.5);
    this.face = scene.add.container(0, 0, [this.bg, text]);
    this.add([shadow, this.face]);
    this.draw();

    this.setSize(this.buttonWidth, this.buttonHeight);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerdown', () => {
      this.pressed = true;
      this.face.y = PX;
    });
    this.on('pointerout', () => {
      this.pressed = false;
      this.face.y = 0;
    });
    this.on('pointerup', () => {
      this.face.y = 0;
      if (!this.pressed) return;
      this.pressed = false;
      onClick();
    });

    scene.add.existing(this);
  }

  setFill(color: number) {
    this.fill = color;
    this.draw();
  }

  private draw() {
    const w = this.buttonWidth;
    const h = this.buttonHeight;
    const g = this.bg;
    g.clear();
    drawStepped(g, w, h, 0, PAL.black);
    g.fillStyle(this.fill, 1);
    g.fillRect(-w / 2 + PX, -h / 2 + PX, w - 2 * PX, h - 2 * PX);
    // Top highlight and bottom shade give the classic bevel.
    g.fillStyle(PAL.white, 0.35);
    g.fillRect(-w / 2 + 2 * PX, -h / 2 + PX, w - 4 * PX, PX);
    g.fillStyle(PAL.black, 0.3);
    g.fillRect(-w / 2 + PX, h / 2 - 2 * PX, w - 2 * PX, PX);
  }
}

// A rectangle with one-pixel notched corners, centred on (0, offsetY).
function drawStepped(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  offsetY: number,
  color: number
) {
  g.fillStyle(color, 1);
  g.fillRect(-w / 2 + PX, -h / 2 + offsetY, w - 2 * PX, h);
  g.fillRect(-w / 2, -h / 2 + PX + offsetY, w, h - 2 * PX);
}

function snap(value: number) {
  return Math.round(value / PX) * PX;
}
