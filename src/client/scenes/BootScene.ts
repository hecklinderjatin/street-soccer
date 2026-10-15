import Phaser from 'phaser';
import { createPixelFont } from '../ui/pixelFont';
import { markTiming } from '../ui/timing';
import {
  AUTHORED_BALL_TEXTURE,
  AUTHORED_SHOT_BALL_TEXTURE,
} from '../art/ballArt';
import { queuePlayerAtlases } from '../art/playerArt';

// Loads the small essentials, opens the menu straight away, then stays
// running in the background (it draws nothing) to download the player
// atlases while the menu is up; it stops itself when they are in. The match
// waits only for whatever has not arrived yet.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image(AUTHORED_SHOT_BALL_TEXTURE, '/art/ball-shot-authored.webp');
    this.load.image(AUTHORED_BALL_TEXTURE, '/art/ball-authored.webp');
  }

  create() {
    createPixelFont(this);
    markTiming('boot');
    document.getElementById('boot-loading')?.remove();
    this.scene.launch('Menu');
    if (!queuePlayerAtlases(this)) {
      this.scene.stop();
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      markTiming('player art');
      this.scene.stop();
    });
    this.load.start();
  }
}
