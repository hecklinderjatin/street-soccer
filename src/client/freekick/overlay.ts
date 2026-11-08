import Phaser from 'phaser';
import { FREE_KICK as FK } from '../../shared/tuning';
import { CARD } from '../ui/infoCard';
import { PAL } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';

export type FreeKickOverlay = 'pause' | 'help' | null;
type OverlayOptions = {
  mode: Exclude<FreeKickOverlay, null>;
  level: number;
  metres: number;
  lives: number;
  backToPause: boolean;
  resume: () => void;
  help: () => void;
  back: () => void;
};

// Portrait counterpart of the normal match's navy information card.
export function buildFreeKickOverlay(
  scene: Phaser.Scene,
  options: OverlayOptions
) {
  const { width, height } = scene.scale;
  const help = options.mode === 'help';
  const panelWidth = Math.min(680, width - 48);
  const panelHeight = help ? Math.min(1000, height - 80) : 440;
  const left = (width - panelWidth) / 2;
  const top = (height - panelHeight) / 2;
  const root = scene.add.container(0, 0);
  root.add(
    scene.add
      .rectangle(0, 0, width, height, PAL.black, 0.8)
      .setOrigin(0)
      .setInteractive()
  );
  root.add(
    scene.add
      .rectangle(width / 2, height / 2, panelWidth, panelHeight, CARD.fill)
      .setStrokeStyle(2, CARD.border)
  );
  root.add(
    scene.add.rectangle(left, top, panelWidth, 5, PAL.blue).setOrigin(0)
  );
  const text = (y: number, value: string, size: number, color: number) =>
    pixelText(scene, width / 2, top + y, value, size, color).setOrigin(0.5);
  root.add(text(38, 'FREE KICK', 2, PAL.blue));
  root.add(text(88, help ? 'HOW TO PLAY' : 'PAUSED', 4, PAL.white));

  if (help) {
    root.add(
      text(
        136,
        `LEVEL ${options.level} / ${options.metres} M / ${options.lives} LIVES`,
        2,
        CARD.soft
      )
    );
    const sections: [string, string][] = [
      [
        '1. SET POWER',
        'Use the slider on the left. Green marks wall-clearing power. Orange marks the last missed shot.',
      ],
      [
        '2. CHOOSE SHOT TYPE',
        'Drag the ball dot below the slider. Centre: power. Sides: curl. Bottom: chip. Top: low drive.',
      ],
      [
        '3. SWIPE TO SHOOT',
        'Swipe upward on the clear pitch to the right, then release. Direction aims; your chosen power and shot type stay set.',
      ],
      [
        '4. LIVES AND LEVELS',
        `Start with ${FK.lives} lives. Each miss costs one life and retries the same spot. Every ${FK.goalsPerLevel} goals raises the level, up to ${FK.maxLevel}.`,
      ],
      [
        '5. READ THE DEFENCE',
        "The wall may jump or stay down. A lying defender blocks low shots. Look for gaps and the keeper's position.",
      ],
      [
        '6. BUILD YOUR SCORE',
        'Goals earn points and style bonuses. Consecutive goals build a streak multiplier. Your best score is saved on this device.',
      ],
    ];
    for (const [i, [heading, body]] of sections.entries()) {
      const y = top + 190 + i * 110;
      root.add(pixelText(scene, left + 28, y, heading, 2.2, PAL.yellow));
      root.add(
        pixelText(scene, left + 28, y + 30, body, 2, CARD.soft).setMaxWidth(
          panelWidth - 56
        )
      );
    }
    root.add(
      new TextButton(
        scene,
        width / 2,
        top + panelHeight - 60,
        options.backToPause ? 'BACK' : 'RESUME',
        options.back,
        { width: 360, height: 72, textSize: 3, fill: CARD.secondary }
      )
    );
  } else {
    root.add(
      new TextButton(scene, width / 2, top + 210, 'RESUME', options.resume, {
        width: 360,
        height: 80,
        textSize: 3.5,
        fill: PAL.darkGreen,
      })
    );
    root.add(
      new TextButton(scene, width / 2, top + 320, 'HOW TO PLAY', options.help, {
        width: 360,
        height: 80,
        textSize: 3,
        fill: CARD.secondary,
      })
    );
  }
  return root;
}
