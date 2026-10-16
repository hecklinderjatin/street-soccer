import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import type { MatchConfig, MatchResult } from '../../shared/types';
import { addStreetBackdrop } from '../ui/backdrop';
import { PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';

export class ResultScene extends Phaser.Scene {
  private result!: MatchResult;

  constructor() {
    super('Result');
  }

  init(data: MatchResult) {
    this.result = data;
  }

  create() {
    const cx = VIEW.width / 2;
    const r = this.result;
    const won = r.goalsFor > r.goalsAgainst;
    const lost = r.goalsFor < r.goalsAgainst;
    const headline = won ? 'YOU WIN!' : lost ? 'YOU LOSE' : 'DRAW';
    const color = won ? PAL.green : lost ? PAL.red : PAL.yellow;

    addStreetBackdrop(this);

    pixelText(
      this,
      cx + 2 * PX,
      130 + 2 * PX,
      headline,
      2.5 * PX,
      PAL.black
    ).setOrigin(0.5);
    pixelText(this, cx, 130, headline, 2.5 * PX, color).setOrigin(0.5);
    pixelText(
      this,
      cx,
      260,
      `${r.goalsFor} - ${r.goalsAgainst}`,
      2 * PX
    ).setOrigin(0.5);
    pixelText(
      this,
      cx,
      350,
      `VS ${r.config.difficulty} AI | SHOTS ${r.shots} | PASSES ${r.passes} | TACKLES ${r.tacklesWon}`,
      0.75 * PX
    ).setOrigin(0.5);

    new TextButton(
      this,
      cx - 176,
      530,
      'PLAY AGAIN',
      () => {
        const config: MatchConfig = r.config; // the same match, settings and all
        this.scene.start('Match', config);
      },
      { width: 320, fill: PAL.green }
    );
    new TextButton(
      this,
      cx + 176,
      530,
      'MENU',
      () => this.scene.start('Menu'),
      {
        width: 320,
        fill: PAL.darkGray,
      }
    );
  }
}
