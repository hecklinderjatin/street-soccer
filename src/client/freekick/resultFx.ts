import Phaser from 'phaser';
import { PAL } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';

const CELL = 7; // font px per character cell
const CONFETTI = 80;
const CONFETTI_COLORS = [PAL.yellow, PAL.orange, PAL.pink, PAL.blue, PAL.green];
const FADE_SEC = 0.25; // fades out this long before `endSec`

type Piece = {
  x: number; // start, as shares of the view
  y: number;
  vx: number; // px/s
  vy: number;
  size: number;
  spin: number;
  color: number;
};

const clamp01 = (v: number) => Phaser.Math.Clamp(v, 0, 1);
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
// A drop that lands with two small bounces.
function bounceOut(t: number) {
  const u = clamp01(t);
  if (u < 0.55) return (u / 0.55) ** 2;
  if (u < 0.85) return 1 - 0.14 * (1 - ((u - 0.7) / 0.15) ** 2);
  return 1 - 0.04 * (1 - ((u - 0.925) / 0.075) ** 2);
}

// Shot feedback stays above the play: outlined animated text and confetti,
// without a full-width plate or a box around the subtitle. A goal stretches
// like the match's GOOOAL; a miss settles with a small bounce.
// Every frame is drawn from the result's age, so it pauses with the game
// and nothing outlives a restart.
export class ResultFx {
  private readonly back: Phaser.GameObjects.Graphics;
  private readonly front: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Container;
  private readonly letters: Phaser.GameObjects.BitmapText[];
  private readonly sub: Phaser.GameObjects.BitmapText;
  private goal = false;
  private text = '';
  private color: number = PAL.white;
  private pieces: Piece[] = [];
  private shown = false;

  constructor(scene: Phaser.Scene, depth: number) {
    this.back = scene.add.graphics().setDepth(depth);
    // A black outline, the match's blue / pink offsets, then the fill.
    const copies: [number, number, number][] = [
      [-4, 0, PAL.black],
      [4, 0, PAL.black],
      [0, -4, PAL.black],
      [0, 4, PAL.black],
      [-4, 3, PAL.blue],
      [4, -3, PAL.pink],
      [0, 0, PAL.white],
    ];
    this.letters = copies.map(([x, y, tint]) =>
      pixelText(scene, x, y, '', 10, tint).setOrigin(0.5)
    );
    this.title = scene.add
      .container(0, 0, this.letters)
      .setDepth(depth + 1)
      .setVisible(false);
    this.sub = pixelText(scene, 0, 0, '', 3, PAL.white)
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setDepth(depth + 1)
      .setVisible(false);
    this.front = scene.add.graphics().setDepth(depth + 2);
  }

  show(goal: boolean, text: string, color: number, sub: string) {
    this.goal = goal;
    this.text = text;
    this.color = color;
    this.shown = true;
    this.sub.setText(sub);
    this.letters[this.letters.length - 1]?.setTint(color);
    // Confetti from both bottom corners, thrown up and inward.
    this.pieces = goal
      ? Array.from({ length: CONFETTI }, (_, i) => {
          const left = i % 2 === 0;
          return {
            x: left ? -0.02 : 1.02,
            y: 0.72 + Math.random() * 0.2,
            vx: (left ? 1 : -1) * (160 + Math.random() * 520),
            vy: -(700 + Math.random() * 900),
            size: 8 + Math.random() * 10,
            spin: 6 + Math.random() * 10,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? PAL.yellow,
          };
        })
      : [];
  }

  hide() {
    this.shown = false;
    this.back.clear();
    this.front.clear();
    this.title.setVisible(false);
    this.sub.setVisible(false);
  }

  // `age`: seconds since the result; `still`: reduced motion.
  update(
    age: number,
    endSec: number,
    width: number,
    height: number,
    still: boolean
  ) {
    if (!this.shown) return;
    this.back.clear();
    const front = this.front.clear();
    const cx = width / 2;
    const cy = Math.max(220, height * 0.28); // clear of the kicker and ball
    const out = 1 - clamp01((age - (endSec - FADE_SEC)) / FADE_SEC);

    // The goal's title stretches: GOAL! -> GOOOAL!
    const extra = this.goal
      ? still
        ? 2
        : Math.floor(clamp01(age / 0.5) * 3)
      : 0;
    const text = this.goal ? `G${'O'.repeat(1 + extra)}AL!` : this.text;
    const longest = this.goal ? 8 : text.length;
    const size = Math.max(
      4,
      Math.min(8, Math.floor((width - 64) / (longest * CELL)))
    );
    for (const letter of this.letters)
      letter.setText(text).setFontSize(size * CELL);

    // Miss titles settle from above; goals animate in place.
    const hit = still
      ? 1
      : this.goal
        ? easeOut(age / 0.2)
        : bounceOut(age / 0.5);
    const drop = this.goal ? 0 : (hit - 1) * 260;
    const land = still ? 0 : Math.exp(-7 * Math.max(0, age - 0.25));
    const scale = still
      ? 1
      : this.goal
        ? 1 +
          1.7 * (1 - easeOut(age / 0.22)) ** 2 +
          0.05 * Math.sin(age * 20) * land
        : 1;
    const shake =
      this.goal || still || age < 0.27 ? 0 : Math.sin(age * 70) * 9 * land;
    this.title
      .setVisible(true)
      .setPosition(cx + shake, cy + drop)
      .setScale(scale)
      .setAngle(still ? 0 : this.goal ? -5 : 2.5)
      .setAlpha(out * clamp01(age / 0.06 + (still ? 1 : 0)));
    const subAlpha = out * (still ? 1 : clamp01((age - 0.3) / 0.2));
    this.sub
      .setVisible(this.sub.text !== '')
      .setPosition(cx, cy + 60)
      .setAlpha(subAlpha);
    if (still) return;

    // Flash: white for a goal, the title's colour for a miss.
    const flash = this.goal
      ? 0.6 * (1 - clamp01(age / 0.28))
      : 0.3 * (1 - clamp01(age / 0.35));
    if (flash > 0)
      front
        .fillStyle(this.goal ? PAL.white : this.color, flash)
        .fillRect(0, 0, width, height);
    for (const p of this.pieces) {
      const x = p.x * width + p.vx * age;
      const y = p.y * height + p.vy * age + 900 * age * age;
      if (y > height + 20) continue;
      // Fluttering: the piece turns edge-on and back.
      const w = p.size * Math.abs(Math.cos(age * p.spin));
      front
        .fillStyle(p.color, out)
        .fillRect(x - w / 2, y - p.size / 2, Math.max(2, w), p.size);
    }
  }
}
