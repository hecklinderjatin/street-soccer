import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import {
  PAINT_STEPS,
  PREPARE_STEPS,
  REST_ASSETS,
  firstAssets,
  queueAssets,
  type Asset,
} from '../art/gameAssets';
import { currentPostType, startingConfig } from '../challenge';
import { releaseEarlyDownloads, withEarlyDownloads } from '../earlyAssets';
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
  private painted = 0; // PAINT_STEPS done

  constructor() {
    super('Boot');
  }

  create() {
    createPixelFont(this);
    markTiming('boot');
    // The page loader fades out (style.css) while the court fades in.
    const loader = document.getElementById('boot-loading');
    loader?.classList.add('done');
    setTimeout(() => loader?.remove(), 400);
    // The feed lobby already offered PLAY: expanded Reddit opens a fresh
    // player match. Localhost and the inline card open the live lobby.
    // That first match opens with how to play (HudScene clears the flag).
    if (
      !this.registry.get('inline') &&
      (this.registry.get('casualEntry') || currentPostType() === 'casual')
    ) {
      this.scene.launch('Casual');
    } else if (!this.registry.get('inline') && context?.postId) {
      this.registry.set('helpAtStart', true);
      this.scene.launch('Match', startingConfig());
    } else this.scene.launch('Menu');
    this.stage = 'first';
    this.step = 0;
    this.painted = 0;
    // The kits this post's match wears (the default ones without settings).
    this.download(firstAssets(startingConfig()), 'kits and looks', 'rest-next');
  }

  // Starts a download; `next` once it is in (or at once if nothing is
  // missing). A failed file is fetched again by the match.
  // The files usually started downloading before the game code arrived
  // (earlyAssets.ts): the loader then reads those copies.
  private download(assets: readonly Asset[], name: string, next: Stage) {
    void withEarlyDownloads(assets).then((ready) => {
      if (!this.scene.isActive()) return;
      if (!queueAssets(this, ready)) {
        this.stage = next;
        return;
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        markTiming(name);
        void releaseEarlyDownloads(assets);
        this.stage = next;
      });
      this.load.start();
    });
  }

  override update() {
    // Court and scenery are painted while the art downloads.
    const paint = PAINT_STEPS[this.painted];
    if (paint) {
      paint[1](this);
      if (++this.painted === PAINT_STEPS.length) markTiming('court painted');
    }
    if (this.stage === 'rest-next') {
      this.stage = 'rest';
      this.download(REST_ASSETS, 'keepers and ball', 'prepare');
    } else if (this.stage === 'prepare') {
      const step = PREPARE_STEPS[this.step++];
      if (step) {
        step[1](this);
        return;
      }
      if (this.painted < PAINT_STEPS.length) return; // painting first
      markTiming('match prepared');
      this.scene.stop();
    }
  }
}
