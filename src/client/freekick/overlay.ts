import { BALL_KEY } from '../art/ballArt';
import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import { FREE_KICK as FK } from '../../shared/tuning';
import {
  FREE_KICK_CHALLENGE_DEFAULT,
  freeKickSkill,
  type FreeKickChallengeConfig,
} from '../../shared/freeKickChallenge';
import { DIFFICULTY_LABEL } from '../../shared/types';
import { BODY, CARD, tag, tile } from '../ui/infoCard';
import { PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';

export type FreeKickOverlay = 'pause' | 'details' | 'help' | null;
type OverlayOptions = {
  mode: Exclude<FreeKickOverlay, null>;
  level: number;
  metres: number;
  lives: number;
  practice?: boolean;
  challenge?: FreeKickChallengeConfig; // a challenge run's post settings
  newSpot?: () => void;
  intro: boolean; // first entry: page 1's primary is START GAME, else RESUME
  restart: () => void; // pause: start a fresh run with the same settings
  resume: () => void; // pause: RESUME
  start: () => void; // page 1: START GAME / RESUME (skips page 2)
  next: () => void; // page 1: NEXT -> how to play
  previous: () => void; // page 2: BACK -> page 1
  close: () => void; // page 2: PLAY
};

type Item = Phaser.GameObjects.GameObject;

// Where the pause menu's buttons sit (the DOM QUIT link is placed by the
// scene at quitY, below the canvas buttons).
export function pauseLayout(height: number, practice: boolean) {
  const resumeY = height / 2 - (practice ? 150 : 95);
  const newSpotY = practice ? resumeY + 110 : null;
  const restartY = resumeY + (practice ? 220 : 110);
  return { resumeY, newSpotY, restartY, quitY: restartY + 110 };
}

// The i button's two info pages and the pause menu, in portrait: the same
// navy results card as the normal match (infoCard) with a coloured top
// edge, the mode tag left and the page number right, and the same flow:
// page 1 MATCH DETAILS (START GAME or RESUME | NEXT), page 2 HOW TO PLAY
// (BACK | PLAY). Pause: PAUSED, RESUME (and NEW SPOT in practice), QUIT.
export function buildFreeKickOverlay(
  scene: Phaser.Scene,
  options: OverlayOptions
) {
  const { width, height } = scene.scale;
  const items: Item[] = [];
  if (options.mode === 'pause') {
    pauseMenu(scene, items, options, width, height);
    return scene.add.container(0, 0, items);
  }
  const details = options.mode === 'details';
  const card = {
    x: 24,
    y: 32,
    width: width - 48,
    height: Math.min(1180, height - 64),
  };
  const cx = width / 2;
  frame(scene, items, card, {
    accent: details ? PAL.yellow : PAL.orange,
    tag: details
      ? options.practice
        ? 'FREE KICK PRACTICE'
        : 'FREE KICK'
      : 'TOUCH CONTROLS',
    tagColor: details ? PAL.yellow : PAL.blue,
    page: details ? 'MATCH INFO  1 / 2' : 'MATCH INFO  2 / 2',
  });
  items.push(
    pixelText(
      scene,
      cx,
      card.y + 100,
      details ? 'MATCH DETAILS' : 'HOW TO PLAY',
      1.25 * PX,
      PAL.yellow
    ).setOrigin(0.5)
  );
  const left = card.x + 32;
  const inner = card.width - 64;
  const buttonY = card.y + card.height - 56;
  // The divider above the buttons, as the match cards.
  items.push(
    scene.add
      .rectangle(left, buttonY - 52, inner, 2, PAL.white, 0.08)
      .setOrigin(0)
  );
  if (details) detailsPage(scene, items, options, card, left, inner, buttonY);
  else helpPage(scene, items, options, card, left, inner, buttonY);
  return scene.add.container(0, 0, items);
}

// Backdrop, card and header row (infoCard.infoFrame, sized for portrait).
function frame(
  scene: Phaser.Scene,
  items: Item[],
  card: { x: number; y: number; width: number; height: number },
  options: { accent: number; tag: string; tagColor: number; page: string }
) {
  const { width, height } = scene.scale;
  items.push(
    scene.add
      .rectangle(0, 0, width, height, 0x070e19, 0.86)
      .setOrigin(0)
      .setInteractive()
  );
  const g = scene.add.graphics();
  g.fillStyle(0x243958, 0.35).fillEllipse(width / 2, 0, width * 1.2, 320);
  g.fillStyle(PAL.black, 0.35).fillRect(
    card.x + 10,
    card.y + 12,
    card.width,
    card.height
  );
  g.fillStyle(CARD.fill, 0.97).fillRect(
    card.x,
    card.y,
    card.width,
    card.height
  );
  g.lineStyle(2, CARD.border, 1).strokeRect(
    card.x,
    card.y,
    card.width,
    card.height
  );
  g.fillStyle(options.accent, 1).fillRect(card.x, card.y, card.width, 6);
  items.push(g);
  tag(scene, items, card.x + 32, card.y + 40, options.tag, options.tagColor);
  items.push(
    pixelText(
      scene,
      card.x + card.width - 32,
      card.y + 40,
      options.page,
      BODY,
      CARD.muted
    ).setOrigin(1, 0.5)
  );
}

function detailsPage(
  scene: Phaser.Scene,
  items: Item[],
  options: OverlayOptions,
  card: { y: number },
  left: number,
  inner: number,
  buttonY: number
) {
  const practice = options.practice === true;
  const challenge = practice
    ? undefined
    : (options.challenge ?? FREE_KICK_CHALLENGE_DEFAULT);
  items.push(
    pixelText(
      scene,
      left + inner / 2,
      card.y + 140,
      practice
        ? 'UNRANKED PRACTICE'
        : challenge
          ? challenge.mode === 'infinity'
            ? `${freeKickSkill(options.level)} · INFINITY`
            : challenge.mode === 'custom'
              ? `${DIFFICULTY_LABEL[challenge.difficulty]} CUSTOM KICK`
              : `${DIFFICULTY_LABEL[challenge.difficulty]} CHALLENGE`
          : 'RANKED RUN',
      BODY,
      CARD.muted
    ).setOrigin(0.5)
  );
  const entries = [
    [
      'MODE',
      practice
        ? 'PRACTICE'
        : challenge?.mode === 'infinity'
          ? 'INFINITY'
          : challenge?.mode === 'custom'
            ? 'CUSTOM'
            : 'CHALLENGE',
    ],
    ['LIVES', practice ? 'UNLIMITED' : String(options.lives)],
    ['LEVEL', `${options.level} / ${FK.maxLevel}`],
    ['DISTANCE', `${options.metres} M`],
    challenge
      ? [
          'TARGET',
          challenge.mode === 'infinity'
            ? 'INFINITY'
            : challenge.mode === 'custom'
              ? 'ENDLESS'
              : `${challenge.goals} GOALS`,
        ]
      : ['LEVEL UP', practice ? 'FIXED LEVEL' : `${FK.goalsPerLevel} GOALS`],
    ['RECORDS', practice ? 'UNRANKED' : '7 DAYS'],
  ];
  const gap = 16;
  const tileW = (inner - gap) / 2;
  for (const [i, [label, value]] of entries.entries()) {
    const x = left + (i % 2) * (tileW + gap);
    const y = card.y + 180 + Math.floor(i / 2) * 116;
    tile(scene, items, x, y, tileW, 100);
    items.push(
      pixelText(scene, x + 16, y + 16, label ?? '', BODY, CARD.muted),
      pixelText(scene, x + 16, y + 50, value ?? '', 3, PAL.white)
    );
  }
  const infinity = challenge?.mode === 'infinity';
  const notes = practice
    ? [
        'Train this Free Kick setup at your chosen fixed level.',
        'Unlimited attempts. Pause > New Spot changes the angle.',
        'Practice does not submit scores or speed records.',
      ]
    : challenge?.mode === 'custom'
      ? [
          'A kick built by a player in the Playground.',
          'The same spot, wall and keeper every time.',
          'Score as many goals in a row as you can.',
          'One life: your first miss ends the run.',
          'Your best score and fastest goal rank on this post.',
        ]
      : infinity && challenge
      ? [
          `Score as many goals as possible with ${challenge.lives} lives.`,
          'Start at Easy. Every two goals raises your level, up to Pro.',
          'At Pro, keep scoring until your lives run out.',
          'Every miss costs one life and retries the current spot.',
          'Your best score and fastest goal rank on this post.',
        ]
      : challenge
        ? [
            `Score ${challenge.goals} goals before your ${challenge.lives} ${challenge.lives === 1 ? 'life runs' : 'lives run'} out.`,
            `Spots around ${challenge.distanceM} m, wall ${challenge.wallFromGoalM} m from goal.`,
            'Fixed sequence for everyone. Each goal is harder; a miss costs a life.',
            'Harder spots (low XG) and better finishes (XGOT) score more points.',
            'Completed runs rank on this post: highest score and fastest goal.',
          ]
        : [
            'Low XG spots pay more. A better finish (XGOT) pays up to 3x.',
            'A miss costs a life. A great save (XGOT 0.5+) does not.',
            `Every ${FK.goalsPerLevel} goals raises the wall and keeper difficulty.`,
            'Completed runs rank by highest score over seven UTC days.',
          ];
  const notesTop = card.y + 180 + 3 * 116 + 16;
  notes.forEach((line, i) =>
    items.push(
      pixelText(
        scene,
        left,
        notesTop + i * 56,
        line,
        BODY,
        CARD.soft
      ).setMaxWidth(inner)
    )
  );
  // START GAME (RESUME once playing) | NEXT, as the match's page 1.
  const startW = (inner - gap) * 0.56;
  const nextW = inner - gap - startW;
  items.push(
    new TextButton(
      scene,
      left + startW / 2,
      buttonY,
      options.intro ? 'START GAME' : 'RESUME',
      options.start,
      { width: startW, height: 72, textSize: 3, fill: PAL.orange }
    ),
    new TextButton(
      scene,
      left + startW + gap + nextW / 2,
      buttonY,
      'NEXT',
      options.next,
      { width: nextW, height: 72, textSize: 3, fill: CARD.secondary }
    )
  );
}

function helpPage(
  scene: Phaser.Scene,
  items: Item[],
  options: OverlayOptions,
  card: { y: number },
  left: number,
  inner: number,
  buttonY: number
) {
  const practice = options.practice === true;
  const challenge = practice
    ? undefined
    : (options.challenge ?? FREE_KICK_CHALLENGE_DEFAULT);
  const sections: [string, string][] = [
    [
      '1. SET POWER',
      'Drag the side slider. Green: clears the wall. Orange: your last missed shot.',
    ],
    [
      '2. CHOOSE SHOT TYPE',
      'Drag the dot on the ball. Centre: power. Sides: curl. Bottom: chip. Top: low drive.',
    ],
    [
      '3. SWIPE TO SHOOT',
      'Swipe at the goal, then release. The arrow shows your aim. A curved swipe adds curl.',
    ],
    [
      '4. LIVES AND LEVELS',
      practice
        ? 'Unlimited retries at this level and spot. Pause > New Spot changes the setup.'
        : challenge
          ? challenge.mode === 'custom'
            ? 'One life. The same custom kick every time: keep scoring until your first miss.'
            : challenge.mode === 'infinity'
            ? `${challenge.lives} lives. Every miss costs one. Two goals per level: Easy to Pro, then keep scoring until lives run out.`
            : `${challenge.lives} ${challenge.lives === 1 ? 'life' : 'lives'}, ${challenge.goals} goals to win. A miss costs a life. Each goal advances the fixed sequence.`
          : `Start with ${FK.lives} lives. A miss costs one and retries the spot. Every ${FK.goalsPerLevel} goals raises the level.`,
    ],
    [
      '5. READ THE DEFENCE',
      "The wall may jump or stay down. A lying defender blocks low shots. Watch the keeper's position.",
    ],
    [
      '6. XG SCORING',
      practice
        ? 'XG shows how hard the spot is. XGOT how hard your shot was to save.'
        : challenge
          ? 'Low XG spots pay more. A high XGOT finish pays up to 3x. Your points are shown at the end.'
          : 'Low XG spots pay more. A high XGOT finish pays up to 3x. A great save costs no life.',
    ],
  ];
  const sectionH = 134;
  const top = card.y + 150;
  for (const [i, [heading, body]] of sections.entries()) {
    const y = top + i * sectionH;
    helpHud(scene, items, i, left + 48, y + 48);
    items.push(
      pixelText(scene, left + 128, y, heading, 2.5, PAL.yellow),
      pixelText(scene, left + 128, y + 32, body, BODY, CARD.soft).setMaxWidth(
        inner - 128
      )
    );
  }
  // Devvit Rules, as the match's how-to-play page.
  const where = context?.subredditName
    ? `MESSAGE THE MODS OF R/${context.subredditName}`
    : 'MESSAGE THE MODS OF THIS SUBREDDIT';
  const footY = buttonY - 120;
  items.push(
    pixelText(
      scene,
      left,
      footY,
      'DELETE SAVED SCORES: SUBREDDIT MENU > DELETE MY STREET SOCCER DATA',
      BODY,
      CARD.soft
    ).setMaxWidth(inner),
    pixelText(
      scene,
      left,
      footY + 40,
      `REPORT A PROBLEM: ${where}`,
      BODY,
      CARD.soft
    ).setMaxWidth(inner)
  );
  // BACK | PLAY, as the match's page 2.
  const gap = 16;
  const backW = (inner - gap) * 0.4;
  const playW = inner - gap - backW;
  items.push(
    new TextButton(scene, left + backW / 2, buttonY, 'BACK', options.previous, {
      width: backW,
      height: 72,
      textSize: 3,
      fill: CARD.secondary,
    }),
    new TextButton(
      scene,
      left + backW + gap + playW / 2,
      buttonY,
      'PLAY',
      options.close,
      { width: playW, height: 72, textSize: 3, fill: PAL.orange }
    )
  );
}

// HUD-like examples: actual ball/life art, power meter and gesture guides.
function helpHud(
  scene: Phaser.Scene,
  items: Item[],
  index: number,
  x: number,
  y: number
) {
  const g = scene.add.graphics();
  items.push(g);
  if (index === 0) {
    g.fillStyle(PAL.navy).fillRect(x - 14, y - 44, 28, 88);
    g.fillStyle(PAL.blue).fillRect(x - 10, y - 6, 20, 46);
    g.fillStyle(PAL.green).fillRect(x - 20, y - 12, 40, 5);
    g.fillStyle(PAL.orange).fillRect(x - 20, y + 16, 40, 4);
    g.fillStyle(PAL.white).fillRect(x - 24, y - 4, 48, 9);
  } else if (index === 1 || index === 3) {
    if (index === 1) {
      items.push(scene.add.image(x, y, BALL_KEY, 'a').setDisplaySize(76, 76));
      g.lineStyle(2, PAL.white, 0.6).strokeRect(x - 44, y - 44, 88, 88);
      // Dot above the image, as in the shot-type selector.
      const dot = scene.add
        .graphics()
        .fillStyle(PAL.yellow)
        .fillCircle(x, y + 5, 7);
      items.push(dot);
    } else {
      for (let i = 0; i < 3; i++)
        items.push(
          scene.add
            .image(x - 30 + i * 30, y - 12, BALL_KEY, 'a')
            .setDisplaySize(28, 28)
            .setAlpha(i === 2 ? 0.25 : 1)
        );
      items.push(
        pixelText(scene, x, y + 18, 'LVL +', 2, PAL.green).setOrigin(0.5)
      );
    }
  } else if (index === 2) {
    g.lineStyle(7, PAL.blue, 0.25).lineBetween(x - 14, y + 40, x + 12, y - 28);
    g.lineStyle(3, PAL.yellow).lineBetween(x - 14, y + 40, x + 12, y - 28);
    g.fillStyle(PAL.yellow).fillTriangle(
      x + 12,
      y - 40,
      x - 3,
      y - 17,
      x + 26,
      y - 20
    );
    items.push(
      scene.add.image(x - 14, y + 40, BALL_KEY, 'a').setDisplaySize(24, 24)
    );
  } else if (index === 4) {
    for (let i = -1; i <= 1; i++) {
      g.fillStyle(PAL.orange).fillCircle(x + i * 28, y - 22, 9);
      g.fillRect(x + i * 28 - 8, y - 10, 16, 45);
    }
    g.lineStyle(2, PAL.white, 0.5).lineBetween(x - 48, y + 40, x + 48, y + 40);
  } else {
    items.push(
      pixelText(scene, x, y - 28, 'XG', 3, PAL.yellow).setOrigin(0.5),
      pixelText(scene, x, y + 4, '0.18', 2, PAL.white).setOrigin(0.5),
      pixelText(scene, x, y + 30, '3X', 2, PAL.green).setOrigin(0.5)
    );
  }
}

// The match's pause menu: dimmed game, PAUSED, RESUME in green; the DOM
// QUIT link (red) goes below.
function pauseMenu(
  scene: Phaser.Scene,
  items: Item[],
  options: OverlayOptions,
  width: number,
  height: number
) {
  const cx = width / 2;
  const layout = pauseLayout(height, options.practice === true);
  items.push(
    scene.add
      .rectangle(0, 0, width, height, PAL.black, 0.7)
      .setOrigin(0)
      .setInteractive(),
    pixelText(
      scene,
      cx,
      layout.resumeY - 140,
      'PAUSED',
      2 * PX,
      PAL.yellow
    ).setOrigin(0.5),
    new TextButton(scene, cx, layout.resumeY, 'RESUME', options.resume, {
      width: 360,
      height: 80,
      fill: PAL.green,
    })
  );
  items.push(
    new TextButton(scene, cx, layout.restartY, 'RESTART', options.restart, {
      width: 360,
      height: 80,
      textSize: 3,
      fill: PAL.orange,
    })
  );
  if (layout.newSpotY !== null && options.newSpot)
    items.push(
      new TextButton(scene, cx, layout.newSpotY, 'NEW SPOT', options.newSpot, {
        width: 360,
        height: 80,
        textSize: 3,
        fill: PAL.blue,
      })
    );
}
