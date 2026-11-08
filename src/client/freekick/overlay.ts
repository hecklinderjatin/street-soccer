import Phaser from 'phaser';
import { FREE_KICK as FK } from '../../shared/tuning';
import { CARD } from '../ui/infoCard';
import { PAL } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';

export type FreeKickOverlay = 'pause' | 'details' | 'help' | null;
type OverlayOptions = {
  mode: Exclude<FreeKickOverlay, null>;
  level: number;
  metres: number;
  lives: number;
  practice?: boolean;
  newSpot?: () => void;
  backToPause: boolean;
  resume: () => void;
  help: () => void;
  back: () => void;
  next: () => void;
  previous: () => void;
  intro: boolean;
};

// Portrait counterpart of the normal match's navy information card.
export function buildFreeKickOverlay(
  scene: Phaser.Scene,
  options: OverlayOptions
) {
  const { width, height } = scene.scale;
  const details = options.mode === 'details';
  const help = options.mode === 'help';
  const panelWidth = Math.min(680, width - 48);
  const panelHeight =
    help || details
      ? Math.min(1000, height - 80)
      : options.practice
        ? 660
        : 550;
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
  root.add(
    text(38, options.practice ? 'FREE KICK PRACTICE' : 'FREE KICK', 2, PAL.blue)
  );
  root.add(
    text(
      88,
      details ? 'MATCH DETAILS' : help ? 'CONTROLS' : 'PAUSED',
      4,
      PAL.white
    )
  );

  if (details) {
    root.add(text(136, '1 / 2', 2, CARD.soft));
    const entries = [
      ['MODE', options.practice ? 'PRACTICE' : 'PLAY'],
      ['LIVES', options.practice ? 'UNLIMITED' : String(options.lives)],
      ['LEVEL', `${options.level} / ${FK.maxLevel}`],
      ['DISTANCE', `${options.metres} M`],
      [
        'LEVEL UP',
        options.practice ? 'FIXED LEVEL' : `${FK.goalsPerLevel} GOALS`,
      ],
      ['RECORDS', options.practice ? 'UNRANKED' : '7 DAYS'],
    ];
    for (const [i, [label, value]] of entries.entries()) {
      const x = left + 28 + (i % 2) * (panelWidth / 2 - 14),
        y = top + 200 + Math.floor(i / 2) * 125;
      root.add(
        scene.add
          .rectangle(x, y, panelWidth / 2 - 28, 105, CARD.tile)
          .setOrigin(0)
      );
      root.add(pixelText(scene, x + 14, y + 14, label ?? '', 1.8, CARD.muted));
      root.add(pixelText(scene, x + 14, y + 51, value ?? '', 2.8, PAL.white));
    }
    const notes = options.practice
      ? [
          'Train at your chosen level with unlimited attempts.',
          'The same spot repeats. Pause > New Spot changes it.',
          'Practice does not submit scores or speed records.',
        ]
      : [
          'Score goals and build streaks for bonus points.',
          'Each miss costs one life. The run ends at zero lives.',
          'Every two goals raises the wall and keeper difficulty.',
          'Completed runs rank by highest score.',
          'Fastest Goal uses scored-shot launch speed.',
          'Boards cover seven UTC days on this post.',
        ];
    notes.forEach((line, i) =>
      root.add(
        pixelText(
          scene,
          left + 28,
          top + 620 + i * 48,
          line,
          2,
          CARD.soft
        ).setMaxWidth(panelWidth - 56)
      )
    );
    root.add(
      new TextButton(
        scene,
        width / 2,
        top + panelHeight - 60,
        'NEXT',
        options.next,
        { width: 360, height: 72, textSize: 3, fill: PAL.orange }
      )
    );
  } else if (help) {
    root.add(
      text(
        136,
        `2 / 2 - ${options.practice ? 'PRACTICE' : 'PLAY'}`,
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
        options.practice
          ? 'Unlimited retries at this level and spot. Pause > New Spot changes the setup. Goals do not raise the level.'
          : `Start with ${FK.lives} lives. Each miss costs one life and retries the same spot. Every ${FK.goalsPerLevel} goals raises the level, up to ${FK.maxLevel}.`,
      ],
      [
        '5. READ THE DEFENCE',
        "The wall may jump or stay down. A lying defender blocks low shots. Look for gaps and the keeper's position.",
      ],
      [
        '6. BUILD YOUR SCORE',
        options.practice
          ? 'Experiment with power, curl and chip shots. Practice does not change your normal best score.'
          : 'Complete the run for its summary, leaderboards and optional score sharing. Only scored goals qualify for speed records.',
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
        width / 2 + 110,
        top + panelHeight - 60,
        options.intro ? 'START' : options.backToPause ? 'PAUSE' : 'RESUME',
        options.back,
        { width: 260, height: 72, textSize: 3, fill: CARD.secondary }
      )
    );
    root.add(
      new TextButton(
        scene,
        width / 2 - 170,
        top + panelHeight - 60,
        'BACK',
        options.previous,
        { width: 200, height: 72, textSize: 3, fill: CARD.secondary }
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
    if (options.practice && options.newSpot)
      root.add(
        new TextButton(
          scene,
          width / 2,
          top + 430,
          'NEW SPOT',
          options.newSpot,
          { width: 360, height: 80, textSize: 3, fill: CARD.secondary }
        )
      );
  }
  return root;
}
