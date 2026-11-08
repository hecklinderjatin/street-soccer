import { chaosLabel, chaosRules } from '../../shared/chaos';
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
import { BODY, CARD, fit, infoFrame, tile } from './infoCard';
import { PAL, PX, JERSEY_SWATCH } from './palette';
import { pixelText } from './pixelFont';
import { TextButton } from './TextButton';

type Item = Phaser.GameObjects.GameObject;

// Page 1 of the i button's match info: the briefing, styled like the
// full-time results card (team cards with kit stripes, stat tiles). Its
// buttons: START GAME (or RESUME mid-match), NEXT to how to play, and on
// desktop CONTROLS for the key bindings. Landscape, on the game canvas.
// Every text size is a whole number of screen pixels per font pixel
// (BODY = 2, 3, 4, 5, 7) so the letters stay crisp.

const CONTENT_TOP = 152; // below the title
const CONTENT_BOTTOM = 586; // above the button divider
const BUTTON_Y = 636;

export function buildMatchDetailsLayer(
  scene: Phaser.Scene,
  config: MatchConfig,
  type: PostType,
  actions: { start: () => void; next: () => void; controls?: () => void }
) {
  const items: Item[] = [];
  const cx = VIEW.width / 2;
  const casual = config.mode === 'casual';
  const chaos = config.dailyMode === 'chaos';
  const survival = config.dailyMode === 'survival';
  infoFrame(scene, items, {
    accent: PAL.yellow,
    tag: casual
      ? 'CUSTOM'
      : config.dailyMode
        ? DAILY_LABEL[config.dailyMode]
        : POST_TYPE_LABEL[type],
    tagColor: casual ? PAL.blue : PAL.yellow,
    page: 'MATCH INFO  1 / 2',
  });

  // Hero, as the results title.
  items.push(
    pixelText(scene, cx, 96, 'MATCH DETAILS', 1.25 * PX, PAL.yellow).setOrigin(
      0.5
    ),
    pixelText(
      scene,
      cx,
      132,
      casual ? 'UNRANKED MATCH' : 'RANKED MATCH',
      BODY,
      CARD.muted
    ).setOrigin(0.5)
  );

  // Objective, and the Chaos / Rampage specifics under it.
  const objective = chaos
    ? 'FINISH AHEAD AT FULL TIME. DRAWS FAIL. NO EXTRA TIME.'
    : dailyObjective(config) ||
      'Win the match. Golden goal if level at full time.';
  const extra: [string, number][] = [];
  if (chaos) {
    const { effect, strength } = chaosRules(config);
    const delta = Math.abs(strength - 100);
    const comparison =
      strength === 100
        ? 'NORMAL'
        : `${delta}% ${strength > 100 ? 'HIGHER' : 'LOWER'}`;
    const setting =
      effect === 'power'
        ? 'SHOT POWER'
        : effect === 'slippery'
          ? 'MOVEMENT SPEED + TACKLE REACH'
          : 'GOAL WIDTH/HEIGHT + END WALL HEIGHT';
    extra.push(
      [
        effect
          ? `${setting}: ${strength}% OF NORMAL (${comparison}).`
          : 'STANDARD SETTINGS - NO CHAOS EFFECT SELECTED.',
        PAL.pink,
      ],
      ['ONE FIXED EFFECT. BOTH TEAMS. WHOLE MATCH. 100% = NORMAL.', CARD.soft]
    );
  }
  if (survival)
    extra.push(
      [
        `${survivalProgression(config)}${survivalLimits(config).goals > 5 ? ' (THEN STAYS PRO)' : ''}`,
        PAL.pink,
      ],
      [
        'YOUR GOALS LEVEL UP AI + KEEPER. TIMEOUT FAILS. FASTEST CLEARS RANK.',
        CARD.soft,
      ]
    );

  // Fill the card from the title to the buttons: the team cards, tiles and
  // objective take the room the Chaos / Rampage lines don't need.
  const LINE_GAP = 26;
  const textBlock = 20 + extra.length * LINE_GAP; // objective + extra lines
  const room = CONTENT_BOTTOM - CONTENT_TOP - textBlock;
  const gapY = Math.round(room * 0.07); // between the blocks
  const teamH = Math.round((room - 2 * gapY) * 0.62);
  const tileH = room - 2 * gapY - teamH;
  const teamTop = CONTENT_TOP;
  const tileTop = teamTop + teamH + gapY;
  const objectiveY = tileTop + tileH + gapY + 10;

  // Scoreboard: each team on a card with its kit colour on top, and the
  // score the match starts from.
  const score = startScore(config);
  const teamW = 480;
  const scoreY = teamTop + teamH - 54;
  for (const side of ['home', 'away'] as const) {
    const x = side === 'home' ? CARD.x + 40 : CARD.x + CARD.width - 40 - teamW;
    const mid = x + teamW / 2;
    const team = config[side];
    items.push(
      scene.add.rectangle(x, teamTop, teamW, teamH, CARD.team).setOrigin(0),
      scene.add
        .rectangle(x, teamTop, teamW, 6, JERSEY_SWATCH[team.jersey])
        .setOrigin(0),
      pixelText(
        scene,
        mid,
        teamTop + 30,
        side === 'home' ? 'YOUR TEAM' : 'OPPONENT',
        BODY,
        CARD.muted
      ).setOrigin(0.5),
      fit(
        pixelText(scene, mid, teamTop + 64, team.name, PX, PAL.white).setOrigin(
          0.5
        ),
        teamW - 40
      ),
      fit(
        pixelText(
          scene,
          mid,
          teamTop + 98,
          `${team.formation} - ${team.jersey.toUpperCase()} KIT`,
          BODY,
          CARD.muted
        ).setOrigin(0.5),
        teamW - 40
      ),
      pixelText(
        scene,
        mid,
        scoreY,
        String(side === 'home' ? score.home : score.away),
        1.75 * PX,
        PAL.white
      ).setOrigin(0.5)
    );
  }
  items.push(
    pixelText(scene, cx, teamTop + 64, 'VS', PX, CARD.muted).setOrigin(0.5),
    pixelText(scene, cx, scoreY, 'START SCORE', BODY, CARD.muted).setOrigin(
      0.5
    )
  );

  // Stat tiles: value on top in green, caption below (as .results-stats).
  const tiles: [string, string][] = [
    ['TIME LIMIT', formatClock(config.durationSec)],
    [
      chaos ? 'OPPONENT AI' : 'DIFFICULTY',
      survival ? 'RAMPAGE' : DIFFICULTY_LABEL[config.difficulty],
    ],
    [
      chaos ? 'CHAOS EFFECT' : 'MATCH RULE',
      chaos
        ? chaosLabel(config)
        : survival
          ? `${survivalLimits(config).goals} GOALS / ${survivalLimits(config).conceded} CONCEDED`
          : config.dailyMode
            ? 'FINISH AHEAD'
            : 'GOLDEN GOAL IF LEVEL',
    ],
  ];
  const gap = 20;
  const tileW = (CARD.width - 80 - 2 * gap) / 3;
  for (const [i, [label, value]] of tiles.entries()) {
    const x = CARD.x + 40 + i * (tileW + gap);
    tile(scene, items, x, tileTop, tileW, tileH);
    items.push(
      fit(
        pixelText(
          scene,
          x + tileW / 2,
          tileTop + tileH / 2 - 14,
          value,
          PX,
          PAL.green
        ).setOrigin(0.5),
        tileW - 32
      ),
      pixelText(
        scene,
        x + tileW / 2,
        tileTop + tileH / 2 + 22,
        label,
        BODY,
        CARD.soft
      ).setOrigin(0.5)
    );
  }

  items.push(
    fit(
      pixelText(scene, cx, objectiveY, objective, BODY, PAL.yellow).setOrigin(
        0.5
      ),
      CARD.width - 80
    )
  );
  extra.forEach(([text, color], i) =>
    items.push(
      fit(
        pixelText(
          scene,
          cx,
          objectiveY + (i + 1) * LINE_GAP,
          text,
          BODY,
          color
        ).setOrigin(0.5),
        CARD.width - 80
      )
    )
  );

  // Actions, as on the results card: the primary in orange, the rest navy.
  items.push(
    scene.add
      .rectangle(
        CARD.x + 40,
        CONTENT_BOTTOM + 8,
        CARD.width - 80,
        2,
        PAL.white,
        0.08
      )
      .setOrigin(0)
  );
  // Desktop: START GAME | CONTROLS | NEXT. Touch: START GAME | NEXT.
  const buttonGap = 16;
  const shares = actions.controls ? [0.44, 0.28, 0.28] : [0.56, 0.44];
  const rowW = CARD.width - 80 - buttonGap * (shares.length - 1);
  let x = CARD.x + 40;
  const place = (share: number) => {
    const w = rowW * share;
    const mid = x + w / 2;
    x += w + buttonGap;
    return { w, mid };
  };
  const startAt = place(shares[0] ?? 0.5);
  const start = new TextButton(
    scene,
    startAt.mid,
    BUTTON_Y,
    'START GAME',
    actions.start,
    { width: startAt.w, height: 64, fill: PAL.orange }
  );
  items.push(start);
  if (actions.controls) {
    const at = place(shares[1] ?? 0.28);
    items.push(
      new TextButton(scene, at.mid, BUTTON_Y, 'CONTROLS', actions.controls, {
        width: at.w,
        height: 64,
        fill: CARD.secondary,
      })
    );
  }
  const nextAt = place(shares[shares.length - 1] ?? 0.44);
  items.push(
    new TextButton(scene, nextAt.mid, BUTTON_Y, 'NEXT', actions.next, {
      width: nextAt.w,
      height: 64,
      fill: CARD.secondary,
    })
  );

  const layer = scene.add.container(0, 0, items).setDepth(10);
  return {
    layer,
    // START GAME before kickoff; RESUME when opened mid-match.
    setStartLabel(text: string) {
      start.setLabel(text);
    },
  };
}
