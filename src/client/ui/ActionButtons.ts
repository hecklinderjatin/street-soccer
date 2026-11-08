import Phaser from 'phaser';
import { SHOOT, VIEW } from '../../shared/tuning';
import { createButtonTexture } from '../art/playerArt';
import type { ButtonId, Controls } from '../systems/Controls';
import { PAL, PX } from './palette';
import { pixelText } from './pixelFont';

// What each button does right now, set by the Match scene every frame.
export type ButtonContext = {
  b1: string;
  b2: string;
  charge: number; // shot/kick charge 0..1 while charging, otherwise < 0
  sweetSpot: boolean; // show the shot sweet-spot colours (false for a keeper kick)
};

// Width of the green "perfect strike" band on the shot charge ring.
const SWEET_BAND = SHOOT.perfectBand;

type SwipeDir = {
  dx: number;
  dy: number;
};
const SWIPES: SwipeDir[] = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];
const SWIPE_NAMES: Record<string, readonly string[]> = {
  PASS: ['LOB', 'DRIVE', 'CURL', 'CURL'],
  SHOOT: ['CHIP', 'POWER', 'CURL', 'CURL'],
  KICK: ['PUNT', 'DRIVE', 'CURL', 'CURL'],
};
// Below this amount a direction counts as not swiped (display only).
const SWIPE_SHOWN = 0.1;

export const ACTION_COLORS: Record<string, number> = {
  PASS: PAL.green,
  SHOOT: PAL.red,
  TACKLE: PAL.orange,
  SWITCH: PAL.blue,
  THROW: PAL.green,
  KICK: PAL.red,
  DIVE: PAL.yellow,
};

type Button = {
  id: ButtonId;
  x: number;
  y: number;
  radius: number; // screen px
  disc: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  swipeLabels: Phaser.GameObjects.BitmapText[];
  pointerId: number | null;
  downX: number; // where the thumb went down (for swipes)
  downY: number;
  action: string;
  shown: string; // label currently drawn
};

// The two context buttons in the bottom-right thumb zone. They react on
// touch down (scale + press registered at once) and track their own pointer
// id, so the joystick thumb and the button thumb never interfere. Labels and
// colours swap instantly with the situation (PASS/SHOOT with the ball,
// TACKLE/SWITCH without). Button 2 shows a ring filling with shot charge.
// On PASS, SHOOT and KICK the thumb can also slide. The slide is analog:
// how far the thumb goes
// (up to SHOOT.swipeFullPx) is how much of each effect the strike gets, and
// diagonals mix. Arrows around the button grow and light up with the
// amount; the label above the player spells it out.
export class ActionButtons {
  enabled = true;
  private readonly buttons: Button[];
  private readonly chargeArc: Phaser.GameObjects.Graphics;
  private readonly swipeArrows: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly controls: Controls
  ) {
    this.chargeArc = scene.add.graphics().setDepth(1);
    this.swipeArrows = scene.add.graphics().setDepth(1);
    this.buttons = [
      this.makeButton(scene, 1, VIEW.width - 300, VIEW.height - 104, 14),
      this.makeButton(scene, 2, VIEW.width - 136, VIEW.height - 196, 18),
    ];
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  update(context: ButtonContext) {
    this.swipeArrows.clear();
    for (const b of this.buttons) {
      const action = b.id === 1 ? context.b1 : context.b2;
      if (action !== b.action) {
        b.action = action;
        b.disc.setTint(ACTION_COLORS[action] ?? PAL.darkGray);
      }
      const shown = this.drawSwipeHints(b, SWIPE_NAMES[action]) ?? action;
      if (shown !== b.shown) {
        b.shown = shown;
        b.label.setText(shown).setScale(shown === 'TACKLE' ? 0.75 : 1);
      }
      const pressed = b.pointerId !== null || this.controls.isHeld(b.id);
      b.disc.setScale(PX * (pressed ? 0.92 : 1));
    }

    const b2 = this.buttons[1];
    this.chargeArc.clear();
    if (b2 && context.charge >= 0) {
      const start = -Math.PI / 2;
      this.chargeArc
        .lineStyle(3 * PX, PAL.black, 0.6)
        .strokeCircle(b2.x, b2.y, b2.radius + 2 * PX);
      // White while building, green in the sweet spot, red when over-hitting
      // (extra lift that can send the shot over the bar).
      const color = !context.sweetSpot
        ? context.charge >= 1
          ? PAL.yellow
          : PAL.white
        : context.charge > SHOOT.sweetSpot
          ? PAL.red
          : context.charge >= SHOOT.sweetSpot - SWEET_BAND
            ? PAL.green
            : PAL.white;
      this.chargeArc
        .lineStyle(2 * PX, color, 1)
        .beginPath()
        .arc(
          b2.x,
          b2.y,
          b2.radius + 2 * PX,
          start,
          start + Math.PI * 2 * Math.max(0.02, context.charge)
        )
        .strokePath();
    }
  }

  // Small arrows around swipe actions: faint while idle, bright while the
  // thumb is on it; each grows and turns yellow with how far it's swiped.
  private drawSwipeHints(b: Button, names: readonly string[] | undefined) {
    const g = this.swipeArrows;
    const pressed = names !== undefined && this.controls.isHeld(b.id);
    const swipe = this.controls.swipeFor(b.id);
    let strongest = SWIPE_SHOWN;
    let best: string | undefined;
    SWIPES.forEach((s, i) => {
      const amount = pressed ? Math.max(0, swipe.x * s.dx + swipe.y * s.dy) : 0;
      const chosen = amount >= SWIPE_SHOWN;
      const name = names?.[i];
      const label = b.swipeLabels[i];
      if (label && pressed && name && label.text !== name) label.setText(name);
      label?.setVisible(pressed).setTint(chosen ? PAL.yellow : PAL.white);
      if (!name) return;
      if (amount >= strongest) {
        strongest = amount;
        best = name;
      }
      const r = b.radius + (3.5 + 2 * amount) * PX;
      const cx = b.x + s.dx * r;
      const cy = b.y + s.dy * r;
      const size = (1.5 + 1.5 * amount) * PX;
      // Triangle pointing outward along (dx, dy); (px, py) is across it.
      const px = -s.dy;
      const py = s.dx;
      g.fillStyle(chosen ? PAL.yellow : PAL.white, pressed ? 0.9 : 0.35);
      g.fillTriangle(
        cx + s.dx * size,
        cy + s.dy * size,
        cx - s.dx * size + px * size,
        cy - s.dy * size + py * size,
        cx - s.dx * size - px * size,
        cy - s.dy * size - py * size
      );
    });
    return best;
  }

  // Lets go of everything (pause, app losing focus).
  release() {
    for (const b of this.buttons) {
      if (b.pointerId !== null) this.controls.release(b.id);
      b.pointerId = null;
    }
  }

  private makeButton(
    scene: Phaser.Scene,
    id: ButtonId,
    x: number,
    y: number,
    artRadius: number
  ): Button {
    const key = createButtonTexture(scene, artRadius);
    const radius = artRadius * PX;
    const disc = scene.add.image(x, y, key).setScale(PX).setAlpha(0.9);
    const label = pixelText(scene, x, y, '', 0.75 * PX, PAL.white).setOrigin(
      0.5
    );
    const swipeLabels = SWIPES.map(({ dx, dy }) => {
      // Vertical labels sit beyond their arrow; horizontal ones sit above it.
      const r = radius + (dx === 0 ? 7 : 3.5) * PX;
      return pixelText(
        scene,
        x + dx * r,
        y + dy * r - (dx === 0 ? 0 : 5 * PX),
        '',
        0.4 * PX,
        PAL.white
      )
        .setOrigin(0.5)
        .setDepth(2)
        .setVisible(false);
    });
    return {
      id,
      x,
      y,
      radius,
      disc,
      label,
      swipeLabels,
      pointerId: null,
      downX: x,
      downY: y,
      action: '',
      shown: '',
    };
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (!this.enabled) return;
    for (const b of this.buttons) {
      if (b.pointerId !== null) continue;
      if (Math.hypot(pointer.x - b.x, pointer.y - b.y) <= b.radius * 1.2) {
        b.pointerId = pointer.id;
        b.downX = pointer.x;
        b.downY = pointer.y;
        this.controls.press(b.id);
        return;
      }
    }
  }

  // The thumb's slide from where it pressed, as the analog
  // swipe: wobble under swipeDeadPx is ignored, full effect at
  // swipeFullPx. It follows the thumb, so sliding back takes effect away.
  private onMove(pointer: Phaser.Input.Pointer) {
    const b = this.buttons.find((button) => button.pointerId === pointer.id);
    if (!b || !SWIPE_NAMES[b.action]) return;
    const dx = pointer.x - b.downX;
    const dy = pointer.y - b.downY;
    const len = Math.hypot(dx, dy);
    if (len < SHOOT.swipeDeadPx) {
      this.controls.setSwipe(b.id, 0, 0);
      return;
    }
    const amount = Math.min(
      1,
      (len - SHOOT.swipeDeadPx) / (SHOOT.swipeFullPx - SHOOT.swipeDeadPx)
    );
    this.controls.setSwipe(b.id, (dx / len) * amount, (dy / len) * amount);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    this.onMove(pointer); // a quick flick can end without a move event
    for (const b of this.buttons) {
      if (b.pointerId === pointer.id) {
        b.pointerId = null;
        this.controls.release(b.id);
      }
    }
  }
}
