import Phaser from 'phaser';
import { MATCH, VIEW } from '../../shared/tuning';
import type { Team, TeamSetup } from '../../shared/types';
import { JERSEY_SWATCH, PAL, PX } from './palette';
import { pixelText } from './pixelFont';

export type GoalCelebrationState = {
  active: boolean;
  age: number; // match phase time: pauses with the match, resets for every goal
  team: Team | null;
  tag: string;
  kmh: number;
  personalBest: boolean;
};

// Screen-space celebration. No timers or tweens survive a restart: every
// frame is derived from this goal's age, including its final fade to kickoff.
export class GoalCelebration {
  readonly root: Phaser.GameObjects.Container;
  private readonly kicker: Phaser.GameObjects.BitmapText;
  private readonly headlineLayer: Phaser.GameObjects.Container;
  private readonly letters: Phaser.GameObjects.BitmapText[] = [];
  private readonly echoes: {
    root: Phaser.GameObjects.Container;
    letters: Phaser.GameObjects.BitmapText[];
  }[] = [];
  private readonly details: Phaser.GameObjects.Container;
  private readonly tagPlate: Phaser.GameObjects.Rectangle;
  private readonly tag: Phaser.GameObjects.BitmapText;
  private readonly speed: Phaser.GameObjects.BitmapText;
  private readonly record: Phaser.GameObjects.Container;
  private readonly motion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  constructor(scene: Phaser.Scene) {
    this.root = scene.add
      .container(VIEW.width / 2, 150)
      .setDepth(5)
      .setVisible(false);
    this.kicker = pixelText(scene, 0, -52, '', 0.55 * PX, PAL.white).setOrigin(
      0.5
    );
    this.headlineLayer = scene.add.container(0, -4);
    // Outline + cyan/pink offsets create the chromatic comic-text effect.
    // Fixed pools are reused every goal: no accumulating tweens or objects.
    const line = (size: number, fill: number) => {
      const root = scene.add.container(0, 0);
      const offsets: [number, number][] = [
        [-3, 0],
        [3, 0],
        [0, -3],
        [0, 3],
      ];
      const letters = [
        ...offsets.map(([x, y]) =>
          pixelText(scene, x, y, '', size, PAL.black).setOrigin(0.5)
        ),
        pixelText(scene, -3, 2, '', size, PAL.blue).setOrigin(0.5),
        pixelText(scene, 3, -2, '', size, PAL.pink).setOrigin(0.5),
        pixelText(scene, 0, 0, '', size, fill).setOrigin(0.5),
      ];
      root.add(letters);
      return { root, letters };
    };
    for (let i = 0; i < 4; i++) {
      const echo = line(1.7 * PX, i % 2 ? PAL.white : PAL.yellow);
      this.echoes.push(echo);
      this.headlineLayer.add(echo.root);
    }
    const main = line(2.3 * PX, PAL.white);
    this.letters = main.letters;
    this.headlineLayer.add(main.root);
    this.root.add([this.kicker, this.headlineLayer]);

    // Keep all secondary feedback in one shallow row above the scorer.
    // Only the coloured badges have fills; the pitch stays visible behind text.
    this.details = scene.add.container(0, 96);
    this.tagPlate = scene.add.rectangle(-160, 0, 206, 32, PAL.blue);
    this.tag = pixelText(scene, -160, 0, '', 0.55 * PX, PAL.black).setOrigin(
      0.5
    );
    const speedPlate = scene.add.rectangle(86, 0, 256, 50, PAL.navy, 0.45);
    this.speed = pixelText(scene, 50, 4, '', 1.35 * PX, PAL.white).setOrigin(
      0.5
    );
    const unit = pixelText(
      scene,
      126,
      6,
      'KM/H',
      0.6 * PX,
      PAL.yellow
    ).setOrigin(0, 0.5);
    this.details.add([this.tagPlate, this.tag, speedPlate, this.speed, unit]);
    this.root.add(this.details);

    this.record = scene.add.container(230, 96);
    const ribbon = scene.add.rectangle(0, 0, 356, 40, PAL.green);
    const recordText = pixelText(
      scene,
      0,
      -7,
      'NEW PERSONAL BEST!',
      0.52 * PX,
      PAL.black
    ).setOrigin(0.5);
    const caption = pixelText(
      scene,
      0,
      11,
      'ON THIS DEVICE',
      0.32 * PX,
      PAL.black
    ).setOrigin(0.5);
    this.record.add([ribbon, recordText, caption]);
    this.root.add(this.record);
  }

  update(state: GoalCelebrationState, teams: Record<Team, TeamSetup>) {
    this.root.setVisible(state.active);
    if (!state.active) return;
    const age = Math.max(0, state.age);
    const steady = this.motion.matches;
    const accent = state.team
      ? JERSEY_SWATCH[teams[state.team].jersey]
      : PAL.yellow;
    this.kicker.setTint(
      accent === JERSEY_SWATCH.black ? PAL.lightGray : accent
    );
    this.kicker.setText(
      state.team ? `${teams[state.team].name} SCORES` : 'STREET SOCCER'
    );

    const extra = steady ? 3 : Math.floor(progress(age, 0.22, 0.7) * 3);
    const text = `G${'O'.repeat(1 + extra)}AL!`;
    for (const letter of this.letters) letter.setText(text);
    const hit = progress(age, 0, 0.25);
    const scale = steady
      ? 1
      : hit < 0.65
        ? 0.65 + 0.47 * (hit / 0.65)
        : 1.12 - 0.12 * ((hit - 0.65) / 0.35);
    const shake = steady ? 0 : 5 * (1 - progress(age, 0.06, 0.4));
    const exit = steady ? 0 : progress(age, 1.95, 2.55);
    this.headlineLayer
      .setPosition(Math.sin(age * 105) * shake + exit * 65, -4 - exit * 22)
      .setAngle(steady ? 0 : -8 + Math.sin(age * 55) * shake * 0.5)
      .setScale(scale + exit * 0.12)
      .setAlpha(1 - exit);
    for (const [i, echo] of this.echoes.entries()) {
      const spread = progress(age, 0.48 + i * 0.1, 0.9 + i * 0.1);
      for (const letter of echo.letters) letter.setText(text);
      echo.root
        .setVisible(!steady && spread > 0 && exit < 1)
        .setPosition((i + 1) * 85 * spread, (i + 1) * 21 * spread)
        .setScale(0.88 - i * 0.06)
        .setAlpha((0.72 - i * 0.1) * spread);
    }
    this.root.setPosition(VIEW.width / 2, 150).setScale(1);
    const end = MATCH.goalHitStopSec + MATCH.celebrationSec;
    this.root.setAlpha(1 - progress(age, end - 0.25, end));

    const reveal = steady ? 1 : progress(age, 0.48, 0.72);
    this.details
      .setVisible(state.kmh > 0)
      .setAlpha(reveal)
      .setX((state.personalBest ? -215 : 0) + (1 - reveal) * 18);
    this.tag.setText(state.tag);
    const color =
      state.tag === 'ROCKET'
        ? PAL.orange
        : state.tag === 'CHIP'
          ? PAL.blue
          : state.tag === 'CURL'
            ? PAL.pink
            : PAL.yellow;
    this.tagPlate.setFillStyle(color);
    this.speed.setText(String(state.kmh));
    const recordReveal = steady ? 1 : progress(age, 0.9, 1.12);
    this.record
      .setVisible(state.personalBest && state.kmh > 0)
      .setAlpha(recordReveal)
      .setY(96 + (1 - recordReveal) * 8);
  }

  get headline() {
    return this.letters.at(-1)?.text ?? '';
  }
}

function progress(age: number, start: number, end: number) {
  return Phaser.Math.Clamp((age - start) / (end - start), 0, 1);
}
