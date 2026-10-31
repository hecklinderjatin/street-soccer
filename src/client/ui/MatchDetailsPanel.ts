import { chaosLabel } from '../../shared/chaos';
import Phaser from 'phaser';
import type { MatchConfig } from '../../shared/types';
import { DIFFICULTY_LABEL } from '../../shared/types';
import {
  DAILY_LABEL,
  dailyObjective,
  startScore,
  survivalLimits,
  survivalProgression,
} from '../../shared/dailyMode';
import { formatClock } from '../../shared/matchConfig';
import { POST_TYPE_LABEL, type PostType } from '../../shared/postType';
import { VIEW } from '../../shared/tuning';
import { PAL, PX, JERSEY_SWATCH } from './palette';
import { pixelText } from './pixelFont';
import { TextButton } from './TextButton';

// Read-only match briefing, before the controls page. It shares the game
// canvas layout/rotation and has no independent scroll area on mobile.
export function buildMatchDetailsLayer(
  scene: Phaser.Scene,
  config: MatchConfig,
  type: PostType,
  next: () => void
) {
  const root = scene.add.container(0, 0).setDepth(10);
  root.add(
    scene.add
      .rectangle(0, 0, VIEW.width, VIEW.height, PAL.black, 0.8)
      .setOrigin(0)
      .setInteractive()
  );
  root.add(
    scene.add
      .rectangle(VIEW.width / 2, 360, 1200, 680, PAL.ink)
      .setStrokeStyle(3, PAL.navy)
  );
  root.add(
    pixelText(scene, 640, 65, 'MATCH DETAILS', PX, PAL.yellow).setOrigin(0.5)
  );
  const mode =
    config.mode === 'casual'
      ? 'CASUAL - UNRANKED'
      : config.dailyMode
        ? DAILY_LABEL[config.dailyMode]
        : POST_TYPE_LABEL[type];
  root.add(
    pixelText(scene, 640, 112, mode, 0.7 * PX, PAL.white).setOrigin(0.5)
  );
  const score = startScore(config);
  const entries: [string, string][] = [
    ['YOUR TEAM', `${config.home.name} (${config.home.jersey.toUpperCase()})`],
    ['OPPONENT', `${config.away.name} (${config.away.jersey.toUpperCase()})`],
    ['TIME LIMIT', formatClock(config.durationSec)],
    [
      'DIFFICULTY',
      config.dailyMode === 'survival'
        ? 'RAMPAGE'
        : DIFFICULTY_LABEL[config.difficulty],
    ],
    ['YOUR FORMATION', config.home.formation],
    ['OPP FORMATION', config.away.formation],
    ['START SCORE', `${score.home} - ${score.away}`],
    [
      config.dailyMode === 'chaos' ? 'CHAOS EFFECT' : 'MATCH RULE',
      config.dailyMode === 'chaos'
        ? chaosLabel(config)
        : config.dailyMode === 'survival'
          ? `${survivalLimits(config).goals} GOALS / ${survivalLimits(config).conceded} CONCEDED`
          : config.dailyMode
            ? 'FINISH AHEAD'
            : 'GOLDEN GOAL IF LEVEL',
    ],
  ];
  for (const [i, [label, value]] of entries.entries()) {
    const x = i % 2 === 0 ? 86 : 666,
      y = 157 + Math.floor(i / 2) * 81;
    root.add(scene.add.rectangle(x, y, 528, 69, PAL.navy, 0.65).setOrigin(0));
    root.add(pixelText(scene, x + 16, y + 8, label, 0.45 * PX, PAL.lightGray));
    if (i < 2)
      root.add(
        scene.add
          .rectangle(
            x,
            y,
            4,
            69,
            JERSEY_SWATCH[i === 0 ? config.home.jersey : config.away.jersey]
          )
          .setOrigin(0)
      );
    root.add(pixelText(scene, x + 16, y + 34, value, 0.65 * PX, PAL.white));
  }
  const objective =
    dailyObjective(config) ||
    'Win the match. Golden goal if level at full time.';
  root.add(
    pixelText(
      scene,
      640,
      config.dailyMode === 'survival' ? 497 : 510,
      objective,
      0.5 * PX,
      PAL.yellow
    ).setOrigin(0.5)
  );
  if (config.dailyMode === 'survival') {
    root.add(
      pixelText(
        scene,
        640,
        526,
        `${survivalProgression(config)}${survivalLimits(config).goals > 5 ? ' (THEN STAYS PRO)' : ''}`,
        0.5 * PX,
        PAL.pink
      ).setOrigin(0.5)
    );
    root.add(
      pixelText(
        scene,
        640,
        554,
        'YOUR GOALS LEVEL UP AI + KEEPER. TIMEOUT FAILS. FASTEST CLEARS RANK.',
        0.5 * PX,
        PAL.lightGray
      ).setOrigin(0.5)
    );
  }
  root.add(
    pixelText(
      scene,
      640,
      587,
      '1 / 2 - MATCH DETAILS',
      0.45 * PX,
      PAL.lightGray
    ).setOrigin(0.5)
  );
  root.add(
    new TextButton(scene, 640, 647, 'NEXT', next, {
      width: 360,
      height: 60,
      fill: PAL.orange,
    })
  );
  return root;
}
