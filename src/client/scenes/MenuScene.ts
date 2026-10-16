import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import { DEFAULT_MATCH_CONFIG, formatClock } from '../../shared/matchConfig';
import { VIEW } from '../../shared/tuning';
import {
  DIFFICULTIES,
  type Difficulty,
  type MatchConfig,
  type TeamSetup,
} from '../../shared/types';
import { postChallenge } from '../challenge';
import { addStreetBackdrop } from '../ui/backdrop';
import { JERSEY_SWATCH, PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';
import { markTiming } from '../ui/timing';

// The title screen. A post with a moderator's custom match shows its
// settings, locked (players can only press PLAY); any other post lets the
// player pick the difficulty of the default match.
export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = 'normal';

  constructor() {
    super('Menu');
  }

  create() {
    markTiming('menu');
    const cx = VIEW.width / 2;
    addStreetBackdrop(this);

    // Title with a hard offset shadow, like spray paint on the wall.
    pixelText(
      this,
      cx + 2 * PX,
      150 + 2 * PX,
      'STREET SOCCER',
      2.5 * PX,
      PAL.black
    ).setOrigin(0.5);
    pixelText(this, cx, 150, 'STREET SOCCER', 2.5 * PX, PAL.yellow).setOrigin(
      0.5
    );

    const challenge = postChallenge();
    let play: () => MatchConfig;
    if (challenge?.config.locked) {
      const config = challenge.config;
      this.showSettings(config);
      play = () => config;
    } else {
      this.showDifficultyPicker();
      play = () => ({ ...DEFAULT_MATCH_CONFIG, difficulty: this.difficulty });
    }

    new TextButton(
      this,
      cx,
      540,
      'PLAY',
      () => this.scene.start('Match', play()),
      { width: 320, height: 96, fill: PAL.green, textSize: 2 * PX }
    );
  }

  private whoLine(text: string, y: number) {
    // context is only populated inside Reddit; a local preview has none.
    const username = context?.username;
    const who = username ? `u/${username}` : 'guest';
    pixelText(
      this,
      VIEW.width / 2,
      y,
      `${text} - ${who}`,
      PX,
      PAL.white
    ).setOrigin(0.5);
  }

  private showDifficultyPicker() {
    const cx = VIEW.width / 2;
    this.whoLine(`5V5 - ${formatClock(DEFAULT_MATCH_CONFIG.durationSec)}`, 260);
    const buttons = DIFFICULTIES.map(
      (difficulty, i) =>
        new TextButton(
          this,
          cx + (i - 1) * 248,
          380,
          difficulty,
          () => {
            this.difficulty = difficulty;
            refresh();
          },
          { width: 224, height: 64 }
        )
    );
    const refresh = () => {
      buttons.forEach((button, i) =>
        button.setFill(
          DIFFICULTIES[i] === this.difficulty ? PAL.orange : PAL.darkGray
        )
      );
    };
    refresh();
  }

  // The moderator's match: both teams (jersey chip, name, formation), then
  // time, AI level and the starting score. Nothing here can be changed.
  private showSettings(config: MatchConfig) {
    const cx = VIEW.width / 2;
    this.whoLine('CUSTOM MATCH', 236);
    const team = (setup: TeamSetup, x: number, align: number) => {
      const chipX = align === 0 ? x : x - 24;
      this.add
        .rectangle(chipX + 12, 312, 24, 40, JERSEY_SWATCH[setup.jersey])
        .setStrokeStyle(2, PAL.black);
      const textX = align === 0 ? x + 40 : x - 40;
      pixelText(this, textX, 300, setup.name, PX, PAL.white).setOrigin(
        align,
        0.5
      );
      pixelText(
        this,
        textX,
        326,
        setup.formation,
        0.75 * PX,
        PAL.lightGray
      ).setOrigin(align, 0.5);
    };
    team(config.home, cx - 400, 0);
    pixelText(this, cx, 312, 'VS', PX, PAL.yellow).setOrigin(0.5);
    team(config.away, cx + 400, 1);

    const score =
      config.startGoalsAgainst > 0
        ? ` - START 0-${config.startGoalsAgainst}`
        : '';
    pixelText(
      this,
      cx,
      400,
      `${formatClock(config.durationSec)} - ${config.difficulty} AI${score}`,
      PX,
      PAL.white
    ).setOrigin(0.5);
  }
}
