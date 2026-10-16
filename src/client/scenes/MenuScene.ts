import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import { VIEW } from '../../shared/tuning';
import {
  DIFFICULTIES,
  type Difficulty,
  type MatchConfig,
} from '../../shared/types';
import { addStreetBackdrop } from '../ui/backdrop';
import { PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';
import { markTiming } from '../ui/timing';

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

    // context is only populated inside Reddit; a local preview has none.
    const username = context?.username;
    const who = username ? `u/${username}` : 'guest';
    pixelText(
      this,
      cx,
      260,
      `5V5 - 90 SECONDS - ${who}`,
      PX,
      PAL.white
    ).setOrigin(0.5);

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

    new TextButton(
      this,
      cx,
      540,
      'PLAY',
      () => {
        const config: MatchConfig = { difficulty: this.difficulty };
        this.scene.start('Match', config);
      },
      { width: 320, height: 96, fill: PAL.green, textSize: 2 * PX }
    );
  }
}
