import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import { DEFAULT_MATCH_CONFIG } from '../../shared/matchConfig';
import { VIEW } from '../../shared/tuning';
import {
  DIFFICULTIES,
  type Difficulty,
  type MatchConfig,
} from '../../shared/types';
import { postChallenge } from '../challenge';
import { PLAY_BUTTON, paintMenuCard } from '../ui/menuCard';
import { PAL, PX } from '../ui/palette';
import { TextButton } from '../ui/TextButton';
import { markTiming } from '../ui/timing';

const CARD = 'menu-card';

// The title screen. Its backdrop, title and match line (or a moderator's
// locked settings) are painted by menuCard.ts, the same painting the feed
// splash shows; only the buttons are Phaser objects. A post with a locked
// custom match normally skips this screen (the splash already showed it,
// BootScene starts the match); it is still reached by QUIT.
export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = 'normal';

  constructor() {
    super('Menu');
  }

  create() {
    markTiming('menu');
    const challenge = postChallenge();
    const locked = challenge?.config.locked ? challenge.config : null;

    // Repainted every time (cheap), so it always matches the current post.
    if (this.textures.exists(CARD)) this.textures.remove(CARD);
    const card = this.textures.createCanvas(CARD, VIEW.width, VIEW.height);
    if (card) {
      paintMenuCard(card.getContext(), VIEW.width, VIEW.height, 0, 0, {
        config: locked,
        durationSec: DEFAULT_MATCH_CONFIG.durationSec,
        // context is only populated inside Reddit; a local preview has none.
        username: context?.username,
      });
      card.refresh();
      this.add.image(0, 0, CARD).setOrigin(0);
    }

    let play: () => MatchConfig;
    if (locked) {
      play = () => locked;
    } else {
      this.showDifficultyPicker();
      play = () => ({ ...DEFAULT_MATCH_CONFIG, difficulty: this.difficulty });
    }

    new TextButton(
      this,
      PLAY_BUTTON.x,
      PLAY_BUTTON.y,
      'PLAY',
      () => this.scene.start('Match', play()),
      {
        width: PLAY_BUTTON.w,
        height: PLAY_BUTTON.h,
        fill: PAL.green,
        textSize: 2 * PX,
      }
    );
  }

  private showDifficultyPicker() {
    const cx = VIEW.width / 2;
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
}
