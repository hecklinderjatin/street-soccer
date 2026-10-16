import Phaser from 'phaser';
import { PAL, PX } from './palette';
import { pixelText } from './pixelFont';

export type TextButtonOptions = {
  width?: number;
  height?: number;
  fill?: number;
  textColor?: number;
  textSize?: number; // logical px per font pixel
  icon?: 'pause' | 'info'; // drawn instead of the label
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
    const content =
      options.icon !== undefined
        ? scene.add.graphics()
        : pixelText(
            scene,
            0,
            0,
            label,
            options.textSize ?? PX,
            options.textColor ?? PAL.white
          ).setOrigin(0.5);
    if (
      content instanceof Phaser.GameObjects.Graphics &&
      options.icon === 'info'
    ) {
      // A pixel lowercase "i" (the font only has capitals) with the same
      // drop shadow as the pause bars; on the face so it sinks too.
      for (const [color, alpha, o] of [
        [PAL.black, 0.6, PX],
        [options.textColor ?? PAL.white, 1, 0],
      ] as const) {
        content.fillStyle(color, alpha);
        content.fillRect(-PX, -4 * PX + o - PX, 2 * PX, 2 * PX); // dot
        content.fillRect(-2 * PX, -PX + o - PX, 3 * PX, PX); // top serif
        content.fillRect(-PX, -PX + o - PX, 2 * PX, 5 * PX); // stem
        content.fillRect(-2 * PX, 3 * PX + o, 4 * PX, PX); // foot
      }
    } else if (content instanceof Phaser.GameObjects.Graphics) {
      // Two solid bars, with an equal gap and balanced padding. Keep the icon
      // on the face so it sinks with the button when pressed.
      content.fillStyle(PAL.black, 0.6);
      content.fillRect(-3 * PX, -3 * PX + PX, 2 * PX, 6 * PX);
      content.fillRect(PX, -3 * PX + PX, 2 * PX, 6 * PX);
      content.fillStyle(options.textColor ?? PAL.white, 1);
      content.fillRect(-3 * PX, -3 * PX, 2 * PX, 6 * PX);
      content.fillRect(PX, -3 * PX, 2 * PX, 6 * PX);
    }
    this.face = scene.add.container(0, 0, [this.bg, content]);
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
