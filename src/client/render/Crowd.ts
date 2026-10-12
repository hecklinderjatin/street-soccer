import Phaser from 'phaser';
import { CROWD } from '../../shared/tuning';
import { FAN_VARIANTS, fanKey } from '../art/sceneryArt';
import { seededRandom } from '../ui/backdrop';
import { PX } from '../ui/palette';
import { newProjected, type Projector } from './Projector';

type Fan = {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  phase: number;
  rate: number; // arm-raise cycles per second
  cheering: boolean;
};

const tmp = newProjected();
const CHEER_ABOVE = 0.82; // fraction of each cycle's peak spent cheering
const HOP = 10; // world px a fan jumps at the top of a cheer

// Spectators standing in rows along the touchline: billboards like the props,
// each idling and now and then throwing their arms up with a little hop, out
// of sync so the crowd looks alive.
export class Crowd {
  private readonly fans: Fan[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly depthBase: number,
    x0: number,
    x1: number,
    rowsY: readonly number[]
  ) {
    const rand = seededRandom(41);
    for (const rowY of rowsY) {
      for (
        let x = x0 + rand() * CROWD.extraGap;
        x < x1;
        x += CROWD.minGap + rand() * CROWD.extraGap
      ) {
        const sprite = scene.add
          .image(0, 0, fanKey(Math.floor(rand() * FAN_VARIANTS)), 'idle')
          .setOrigin(0.5, 1)
          .setFlipX(rand() < 0.5);
        this.fans.push({
          sprite,
          x,
          y: rowY + (rand() - 0.5) * 24,
          phase: rand() * Math.PI * 2,
          rate: 0.15 + rand() * 0.25,
          cheering: false,
        });
      }
    }
  }

  update(projector: Projector, timeSec: number) {
    for (const fan of this.fans) {
      const wave = Math.sin(timeSec * fan.rate * Math.PI * 2 + fan.phase);
      const cheering = wave > CHEER_ABOVE;
      if (cheering !== fan.cheering) {
        fan.cheering = cheering;
        fan.sprite.setFrame(cheering ? 'cheer' : 'idle');
      }
      const hop = cheering
        ? ((wave - CHEER_ABOVE) / (1 - CHEER_ABOVE)) * HOP
        : 0;
      projector.project(fan.x, fan.y, hop, tmp);
      fan.sprite
        .setPosition(tmp.x, tmp.y)
        .setScale(PX * tmp.scale)
        .setDepth(this.depthBase + fan.y);
    }
  }
}
