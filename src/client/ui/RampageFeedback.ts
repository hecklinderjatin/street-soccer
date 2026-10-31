import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import { DIFFICULTY_LABEL, type Difficulty } from '../../shared/types';
import type { GoalCelebrationState } from './GoalCelebration';
import { PAL, PX } from './palette';
import { pixelText } from './pixelFont';

export type RampageHudState = {
  difficulty: Difficulty;
  upgradeAge: number | null; // seconds since the new tier was applied at kickoff
  lives: number;
};

// Muted fills for the persistent HUD.
const TIER_FILL: Record<Difficulty, number> = {
  noob: 0x456750,
  easy: 0x416569,
  normal: 0x716744,
  hard: 0x79583e,
  pro: 0x75424e,
};

// Fixed text objects, driven by active match time: pausing and restarting cannot
// leave a tween or timer running, and there is no background behind the counters.
export class RampageFeedback {
  private readonly badge: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly tier: Phaser.GameObjects.BitmapText;
  private readonly levelUp: Phaser.GameObjects.BitmapText;
  private readonly motion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  constructor(scene: Phaser.Scene) {
    this.badge = scene.add.container(VIEW.width / 2, 112).setVisible(false);
    this.fill = scene.add.rectangle(0, 0, 140, 30, TIER_FILL.noob, 0.65);
    this.badge.add(this.fill);
    this.tier = pixelText(scene, 0, 0, '', 0.65 * PX, PAL.white)
      .setOrigin(0.5)
      .setAlpha(0.9);
    this.badge.add(this.tier);

    // One short line below the HUD, after the goal graphics have cleared.
    this.levelUp = pixelText(
      scene,
      VIEW.width / 2,
      158,
      '',
      0.65 * PX,
      PAL.white
    )
      .setOrigin(0.5)
      .setDepth(5)
      .setVisible(false);
  }

  update(state: RampageHudState | null, goal: GoalCelebrationState) {
    this.badge.setVisible(state !== null && !goal.active);
    if (state) {
      this.fill.setFillStyle(TIER_FILL[state.difficulty], 0.65);
      this.tier.setText(DIFFICULTY_LABEL[state.difficulty]);
    }

    const duration = 1.6;
    const age = state?.upgradeAge;
    const visible =
      state !== null &&
      !goal.active &&
      age !== null &&
      age !== undefined &&
      age >= 0 &&
      age < duration;
    this.levelUp.setVisible(visible);
    if (!visible || age === null || age === undefined || !state) return;

    const enter = Phaser.Math.Clamp(age / 0.2, 0, 1);
    const fade = Phaser.Math.Clamp((duration - age) / 0.3, 0, 1);
    const steady = this.motion.matches;
    this.levelUp
      .setText(`LEVEL UP > ${DIFFICULTY_LABEL[state.difficulty]}`)
      .setY(158 + (steady ? 0 : (1 - enter) * 6))
      .setAlpha(steady ? 0.9 : 0.9 * enter * fade);
  }
}
