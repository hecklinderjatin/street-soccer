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
  private readonly strip: Phaser.GameObjects.Graphics;
  private readonly streaks: Phaser.GameObjects.Graphics;
  private readonly kicker: Phaser.GameObjects.BitmapText;
  private readonly body: Phaser.GameObjects.BitmapText;
  private readonly tail: Phaser.GameObjects.BitmapText;
  private readonly bodyShadow: Phaser.GameObjects.BitmapText;
  private readonly tailShadow: Phaser.GameObjects.BitmapText;
  private readonly details: Phaser.GameObjects.Container;
  private readonly tagPlate: Phaser.GameObjects.Rectangle;
  private readonly tag: Phaser.GameObjects.BitmapText;
  private readonly speed: Phaser.GameObjects.BitmapText;
  private readonly record: Phaser.GameObjects.Container;
  private readonly motion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  private accent = -1;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add
      .container(VIEW.width / 2, 280)
      .setDepth(5)
      .setVisible(false);
    this.strip = scene.add.graphics();
    this.streaks = scene.add.graphics();
    this.kicker = pixelText(scene, 0, -106, '', 0.7 * PX, PAL.white).setOrigin(
      0.5
    );
    this.bodyShadow = pixelText(scene, 0, 0, '', 3.5 * PX, PAL.black).setOrigin(
      0,
      0.5
    );
    this.tailShadow = pixelText(
      scene,
      0,
      0,
      'L!',
      3.5 * PX,
      PAL.black
    ).setOrigin(0, 0.5);
    this.body = pixelText(scene, 0, 0, '', 3.5 * PX, PAL.yellow).setOrigin(
      0,
      0.5
    );
    this.tail = pixelText(scene, 0, 0, 'L!', 3.5 * PX, PAL.yellow).setOrigin(
      0,
      0.5
    );
    this.root.add([
      this.strip,
      this.streaks,
      this.kicker,
      this.bodyShadow,
      this.tailShadow,
      this.body,
      this.tail,
    ]);

    this.details = scene.add.container(0, 110);
    const detailShadow = scene.add.rectangle(5, 6, 620, 78, PAL.black, 0.5);
    const detailPlate = scene.add
      .rectangle(0, 0, 620, 78, PAL.navy, 0.95)
      .setStrokeStyle(2, PAL.white, 0.25);
    this.tagPlate = scene.add.rectangle(-154, 0, 284, 52, PAL.blue);
    this.tag = pixelText(scene, -154, 0, '', 0.75 * PX, PAL.black).setOrigin(
      0.5
    );
    this.speed = pixelText(scene, 83, 0, '', 1.9 * PX, PAL.white).setOrigin(
      0.5
    );
    const unit = pixelText(
      scene,
      187,
      9,
      'KM/H',
      0.7 * PX,
      PAL.lightGray
    ).setOrigin(0, 0.5);
    this.details.add([
      detailShadow,
      detailPlate,
      this.tagPlate,
      this.tag,
      this.speed,
      unit,
    ]);
    this.root.add(this.details);

    this.record = scene.add.container(0, 201);
    const ribbonShadow = scene.add.rectangle(5, 5, 520, 62, PAL.black, 0.5);
    const ribbon = scene.add.rectangle(0, 0, 520, 62, PAL.green);
    const recordText = pixelText(
      scene,
      0,
      -10,
      'NEW PERSONAL BEST!',
      0.8 * PX,
      PAL.black
    ).setOrigin(0.5);
    const caption = pixelText(
      scene,
      0,
      17,
      'ON THIS DEVICE',
      0.45 * PX,
      PAL.black
    ).setOrigin(0.5);
    this.record.add([ribbonShadow, ribbon, recordText, caption]);
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
    if (this.accent !== accent) {
      this.accent = accent;
      this.strip
        .clear()
        .fillStyle(PAL.black, 0.68)
        .fillRect(-492, -83, 984, 166)
        .fillStyle(accent)
        .fillRect(-492, -83, 984, 6)
        .fillRect(-492, -77, 10, 160)
        .fillStyle(PAL.yellow)
        .fillRect(-492, 80, 984, 4);
    }
    this.kicker.setText(
      state.team ? `${teams[state.team].name} SCORES` : 'STREET SOCCER'
    );

    // Hit, shake, add O's, then stretch the final L! and snap it back.
    const extra = steady ? 3 : Math.floor(progress(age, 0.28, 0.82) * 3);
    this.body.setText(`G${'O'.repeat(1 + extra)}A`);
    this.bodyShadow.setText(this.body.text);
    const stretch = steady
      ? 1
      : 1 + 0.52 * Math.sin(Math.PI * progress(age, 0.84, 1.22));
    this.tail.setScale(stretch, 1);
    this.tailShadow.setScale(stretch, 1);
    const bodyWidth = this.body.getTextBounds().local.width;
    const tailWidth = this.tail.getTextBounds().local.width;
    const width = bodyWidth + tailWidth * stretch;
    const x = -width / 2;
    this.body.setPosition(x, 20);
    this.tail.setPosition(x + bodyWidth, 20);
    this.bodyShadow.setPosition(x + 7, 28);
    this.tailShadow.setPosition(x + bodyWidth + 7, 28);
    const hit = progress(age, 0, 0.25);
    const scale = steady
      ? 1
      : hit < 0.65
        ? 0.72 + 0.4 * (hit / 0.65)
        : 1.12 - 0.12 * ((hit - 0.65) / 0.35);
    const shake = steady ? 0 : 7 * (1 - progress(age, 0, 0.23));
    this.root
      .setPosition(
        VIEW.width / 2 + Math.sin(age * 105) * shake,
        280 + Math.cos(age * 87) * shake
      )
      .setScale(scale);
    const end = MATCH.goalHitStopSec + MATCH.celebrationSec;
    this.root.setAlpha(steady ? 1 : 1 - progress(age, end - 0.32, end));

    const reveal = steady ? 1 : progress(age, 0.48, 0.72);
    this.details
      .setVisible(state.kmh > 0)
      .setAlpha(reveal)
      .setX((1 - reveal) * 48);
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
      .setY(201 + (1 - recordReveal) * 18);

    this.streaks.clear();
    if (!steady) {
      const burst = progress(age, 0.12, 0.62);
      this.streaks.fillStyle(PAL.yellow, (1 - burst) * 0.8);
      for (const side of [-1, 1])
        for (let i = 0; i < 4; i++)
          this.streaks.fillRect(
            side * (320 + burst * 200 + i * 15),
            -62 + i * 30,
            side * (32 + i * 6),
            4
          );
    }
  }

  get headline() {
    return this.body.text + this.tail.text;
  }
}

function progress(age: number, start: number, end: number) {
  return Phaser.Math.Clamp((age - start) / (end - start), 0, 1);
}
