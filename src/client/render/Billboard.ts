import Phaser from 'phaser';
import { PX } from '../ui/palette';
import { newProjected, type Projector } from './Projector';

const tmp = newProjected();

// A static upright prop (car, hoop) standing on the ground at (x, y):
// a camera-facing sprite scaled by distance. depthBase lets props outside
// the court sort behind the end walls while still sorting among themselves by y.
export class Billboard {
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    texture: string,
    private readonly x: number,
    private readonly y: number,
    private readonly depthBase: number,
    flipX = false
  ) {
    this.sprite = scene.add
      .image(0, 0, texture)
      .setOrigin(0.5, 1)
      .setFlipX(flipX);
  }

  update(projector: Projector) {
    projector.project(this.x, this.y, 0, tmp);
    this.sprite
      .setPosition(tmp.x, tmp.y)
      .setScale(PX * tmp.scale)
      .setDepth(this.depthBase + this.y);
  }
}
