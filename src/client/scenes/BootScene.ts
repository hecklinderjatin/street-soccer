import Phaser from 'phaser';
import { createPixelFont } from '../ui/pixelFont';

// Builds shared assets before the menu. All art is generated in code for now
// (pixel font, backdrops); texture atlases get loaded here once they exist.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    createPixelFont(this);
    this.scene.start('Menu');
  }
}
