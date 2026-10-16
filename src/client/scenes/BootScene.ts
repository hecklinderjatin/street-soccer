import Phaser from 'phaser';
import {
  PREPARE_STEPS,
  REST_ASSETS,
  firstAssets,
  queueAssets,
  type Asset,
} from '../art/gameAssets';
import { postChallenge, startingConfig } from '../challenge';
import { createPixelFont } from '../ui/pixelFont';
import { markTiming } from '../ui/timing';

type Stage = 'first' | 'rest-next' | 'rest' | 'prepare';

// Opens the menu at once (no downloads first), then keeps running in the
// background, drawing nothing, to get the match ready while the menu is up:
// downloads the art (outfield kits and looks first, then keepers and ball),
// then prepares it one step per frame (player frames and animations, ball,
// court, scenery) and stops itself. PLAY then only places the players; the
// match does whatever is still missing if it comes first.
export class BootScene extends Phaser.Scene {
  private stage: Stage = 'first';
  private step = 0;

  constructor() {
    super('Boot');
  }

  create() {
    createPixelFont(this);
    markTiming('boot');
    document.getElementById('boot-loading')?.remove();
    // A moderator's locked match was already shown on the feed splash (the
    // same title screen), so PLAY there goes straight into the match.
    const challenge = postChallenge();
    if (challenge?.config.locked) this.scene.launch('Match', challenge.config);
    else this.scene.launch('Menu');
    this.stage = 'first';
    this.step = 0;
    // The kits this post's match wears (the default ones without settings).
    this.download(firstAssets(startingConfig()), 'kits and looks', 'rest-next');
  }

  // Starts a download; `next` once it is in (or at once if nothing is
  // missing). A failed file is fetched again by the match.
  private download(assets: readonly Asset[], name: string, next: Stage) {
    if (!queueAssets(this, assets)) {
      this.stage = next;
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      markTiming(name);
      this.stage = next;
    });
    this.load.start();
  }

  override update() {
    if (this.stage === 'rest-next') {
      this.stage = 'rest';
      this.download(REST_ASSETS, 'keepers and ball', 'prepare');
    } else if (this.stage === 'prepare') {
      const step = PREPARE_STEPS[this.step++];
      if (step) {
        step[1](this);
        return;
      }
      markTiming('match prepared');
      this.scene.stop();
    }
  }
}
