import Phaser from 'phaser';
import { MATCH, VIEW } from '../../shared/tuning';
import { DIFFICULTY_LABEL, type Difficulty } from '../../shared/types';
import type { GoalCelebrationState } from './GoalCelebration';
import { PAL, PX } from './palette';
import { pixelText } from './pixelFont';

export type RampageHudState = {
  difficulty: Difficulty;
  nextDifficulty: Difficulty | null;
  lives: number;
};

const TIER_COLOR: Record<Difficulty, number> = {
  noob: PAL.green,
  easy: PAL.kitTeal,
  normal: PAL.yellow,
  hard: PAL.orange,
  pro: PAL.red,
};

// Fixed text pools, driven by match phase age: pausing and restarting cannot
// leave a tween or timer running, and there is no background behind the counters.
export class RampageFeedback {
  private readonly badge: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly tier: Phaser.GameObjects.BitmapText[];
  private readonly levelUp: Phaser.GameObjects.Container;
  private readonly transition: Phaser.GameObjects.BitmapText[];
  private readonly motion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  constructor(scene: Phaser.Scene) {
    const outlined = (
      parent: Phaser.GameObjects.Container,
      y: number,
      size: number,
      text: string
    ) => {
      const offsets: [number, number][] = [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
        [0, 0],
      ];
      const layers = offsets.map(([x, dy], i) =>
        pixelText(
          scene,
          x,
          y + dy,
          text,
          size,
          i === 4 ? PAL.white : PAL.black
        ).setOrigin(0.5)
      );
      parent.add(layers);
      return layers;
    };
    this.badge = scene.add.container(VIEW.width / 2, 112).setVisible(false);
    this.fill = scene.add.rectangle(0, 0, 152, 36, PAL.green);
    this.badge.add(this.fill);
    this.tier = outlined(this.badge, 0, 0.75 * PX, '');

    this.levelUp = scene.add
      .container(VIEW.width / 2, 310)
      .setDepth(5)
      .setVisible(false);
    outlined(this.levelUp, 0, 0.9 * PX, 'LEVEL UP!');
    this.transition = outlined(this.levelUp, 34, 0.65 * PX, '');
  }

  update(state: RampageHudState | null, goal: GoalCelebrationState) {
    this.badge.setVisible(state !== null && !goal.active);
    if (state) {
      this.fill.setFillStyle(TIER_COLOR[state.difficulty]);
      for (const layer of this.tier)
        layer.setText(DIFFICULTY_LABEL[state.difficulty]);
    }

    const revealAt = 1.4;
    const end = MATCH.goalHitStopSec + MATCH.celebrationSec;
    const visible =
      state !== null &&
      state.nextDifficulty !== null &&
      goal.active &&
      goal.age >= revealAt;
    this.levelUp.setVisible(visible);
    if (!visible || !state?.nextDifficulty) return;

    const age = Math.max(0, goal.age - revealAt);
    const enter = Math.min(1, age / 0.3);
    const fade = Phaser.Math.Clamp((end - goal.age) / 0.2, 0, 1);
    const steady = this.motion.matches;
    this.levelUp
      .setPosition(VIEW.width / 2, 310 + (steady ? 0 : (1 - enter) * 14))
      .setScale(steady ? 1 : 1 + Math.sin(enter * Math.PI) * 0.12)
      .setAlpha(steady ? 1 : enter * fade);
    for (const layer of this.transition)
      layer.setText(
        `${DIFFICULTY_LABEL[state.difficulty]} > ${DIFFICULTY_LABEL[state.nextDifficulty]}`
      );
    this.transition.at(-1)?.setTint(TIER_COLOR[state.nextDifficulty]);
  }
}
