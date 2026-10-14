import Phaser from 'phaser';
import { createPixelFont } from '../ui/pixelFont';
import {
  AUTHORED_BALL_TEXTURE,
  AUTHORED_SHOT_BALL_TEXTURE,
} from '../art/ballArt';
import {
  AUTHORED_IDLE_TEXTURE,
  AUTHORED_RUN_TEXTURE,
  AUTHORED_SHOOT_TEXTURE,
  AUTHORED_RUN_UP_TEXTURE,
  AUTHORED_RUN_DOWN_TEXTURE,
  AUTHORED_RUN_UP_DIAGONAL_TEXTURE,
  AUTHORED_RUN_DOWN_DIAGONAL_TEXTURE,
  AUTHORED_TACKLE_TEXTURE,
  AUTHORED_DIVE_TEXTURE,
  AUTHORED_HOLD_TEXTURE,
  AUTHORED_HURT_TEXTURE,
  AUTHORED_CARRY_TEXTURE,
  CELEBRATIONS,
} from '../art/playerArt';

// Load authored character art and build shared assets before the menu.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image(AUTHORED_SHOT_BALL_TEXTURE, '/art/ball-shot-authored.webp');
    this.load.image(AUTHORED_BALL_TEXTURE, '/art/ball-authored.webp');
    this.load.image(AUTHORED_CARRY_TEXTURE, '/art/player-carry-authored.webp');
    for (const c of CELEBRATIONS) this.load.image(c.key, `/art/${c.file}`);
    this.load.image(AUTHORED_HURT_TEXTURE, '/art/player-hurt-authored.webp');
    this.load.image(AUTHORED_HOLD_TEXTURE, '/art/player-hold-authored.webp');
    this.load.image(AUTHORED_DIVE_TEXTURE, '/art/player-dive-authored.webp');
    this.load.image(
      AUTHORED_TACKLE_TEXTURE,
      '/art/player-tackle-authored.webp'
    );
    this.load.image(
      AUTHORED_RUN_DOWN_DIAGONAL_TEXTURE,
      '/art/player-run-down-diagonal-authored.webp'
    );
    this.load.image(
      AUTHORED_RUN_UP_DIAGONAL_TEXTURE,
      '/art/player-run-up-diagonal-authored.webp'
    );
    this.load.image(AUTHORED_IDLE_TEXTURE, '/art/player-idle-authored.webp');
    this.load.image(AUTHORED_RUN_TEXTURE, '/art/player-run-authored.webp');
    this.load.image(AUTHORED_SHOOT_TEXTURE, '/art/player-shoot-authored.webp');
    this.load.image(
      AUTHORED_RUN_UP_TEXTURE,
      '/art/player-run-up-authored.webp'
    );
    this.load.image(
      AUTHORED_RUN_DOWN_TEXTURE,
      '/art/player-run-down-authored.webp'
    );
  }

  create() {
    createPixelFont(this);
    this.scene.start('Menu');
  }
}
