import Phaser from 'phaser';
import { CHAOS, VIEW } from '../../shared/tuning';
import type { ChaosRules } from '../../shared/chaos';
import type { Player } from '../entities/Player';
import { newProjected, type Projector } from './Projector';
import { PAL } from '../ui/palette';

// One reusable Graphics buffer. No textures, emitters, timers or random numbers
// from the gameplay RNG. A fixed budget keeps mobile previews inexpensive.
export class ChaosWeather {
  private readonly graphics: Phaser.GameObjects.Graphics | null;
  private readonly reduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  private readonly point = newProjected();
  constructor(scene: Phaser.Scene, rules: ChaosRules) {
    this.graphics =
      rules.effect === 'slippery'
        ? scene.add.graphics().setDepth(1_500_000)
        : null;
  }
  update(projector: Projector, players: readonly Player[], time: number) {
    const g = this.graphics;
    if (!g) return;
    g.clear();
    if (this.reduced.matches) return;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
    const count = mobile ? Math.floor(CHAOS.rainDrops / 2) : CHAOS.rainDrops;
    g.lineStyle(1.5, 0xa5cced, 0.3);
    for (let i = 0; i < count; i++) {
      const x = (i * 197 + time * 90) % VIEW.width;
      const y = (i * 137 + time * 520) % VIEW.height;
      g.lineBetween(x, y, x - 3, y + 12);
    }
    let splashes = 0;
    for (const [i, player] of players.entries()) {
      if (splashes >= CHAOS.splashes) break;
      if (player.speed < 100 || (time * 6 + i) % 1 > 0.18) continue;
      projector.project(player.renderX, player.renderY, 0, this.point);
      g.lineStyle(1, PAL.lightGray, 0.3).strokeEllipse(
        this.point.x,
        this.point.y,
        9,
        3
      );
      splashes++;
    }
  }
}
