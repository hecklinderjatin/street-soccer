import Phaser from 'phaser';
import {
  BALL_KEY,
  BALL_SHADOW_KEY,
  BALL_W,
  BALL_TEXTURE_W,
  BALL_FRAMES,
  BALL_SHOT_FRAMES,
} from '../art/ballArt';
import { newProjected, type Projector } from '../render/Projector';
import { SHOOT } from '../../shared/tuning';
import { PAL, PX } from '../ui/palette';
import type { Player } from './Player';
import { PLAYER_HEIGHT } from '../art/playerArt';

const at = newProjected();
const TRAIL_LENGTH = 14; // render frames of trail

// The ball: 3D position (x, y on the ground plane, z height) and velocity.
// Collisions happen in 2D on the ground plane (see systems/ballPhysics.ts).
// While a player owns it, systems/possession.ts steers it in dribble touches
// instead of free physics; it is never simply glued to the feet.
export class Ball {
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  spin = 0; // rad/s the velocity turns while fast (curve)
  dip = 0; // topspin: extra gravity (fraction) until the ball first lands
  prevX = 0;
  prevY = 0;
  prevZ = 0;
  renderX = 0;
  renderY = 0;
  renderZ = 0;

  owner: Player | null = null;
  lastTouch: Player | null = null; // for stats and future rules
  priority: Player | null = null; // only this player may take the loose ball ...
  priorityUntil = 0; // ... until this sim time (a won tackle)
  inNet: -1 | 0 | 1 = 0; // which net the ball is in (-1 left, 1 right)
  out: -1 | 0 | 1 = 0; // went out over the bar / end wall behind this goal (until the restart)
  private rolled = 0; // signed distance rolled, drives the spinning frames
  private rollDir = 1; // +1 rolling right (frames forward), -1 left (reversed)
  shotAnimationAge = Infinity; // seconds since strike; brief squash/stretch effect

  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  // Fading trail behind a fast free ball (world positions, oldest first),
  // so curl, dip and loft read clearly.
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly trailPoints: { x: number; y: number; z: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.trail = scene.add.graphics();
    this.shadow = scene.add.image(0, 0, BALL_SHADOW_KEY);
    this.sprite = scene.add.image(0, 0, BALL_KEY, 'a').setOrigin(0.5, 1);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  // Dead ball on a spot (kickoff).
  placeAt(x: number, y: number) {
    this.x = this.prevX = this.renderX = x;
    this.y = this.prevY = this.renderY = y;
    this.z = this.prevZ = this.renderZ = 0;
    this.vx = this.vy = this.vz = this.spin = this.dip = 0;
    this.owner = null;
    this.lastTouch = null;
    this.priority = null;
    this.priorityUntil = 0;
    this.inNet = 0;
    this.out = 0;
    this.trailPoints.length = 0;
    this.shotAnimationAge = Infinity;
  }

  savePrevious() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevZ = this.z;
  }

  interpolate(alpha: number) {
    this.renderX = this.prevX + (this.x - this.prevX) * alpha;
    this.renderY = this.prevY + (this.y - this.prevY) * alpha;
    this.renderZ = this.prevZ + (this.z - this.prevZ) * alpha;
  }

  render(projector: Projector, dtSec: number) {
    if (this.owner || this.inNet !== 0 || this.out !== 0)
      this.shotAnimationAge = Infinity;
    const hands = this.owner?.heldBallScreen;
    if (this.owner?.holding && hands?.visible) {
      this.shadow.setVisible(false);
      this.sprite
        .setOrigin(0.5, 0.5)
        .setFrame('a')
        .setPosition(hands.x, hands.y)
        .setScale(((PLAYER_HEIGHT * 0.14) / BALL_TEXTURE_W) * hands.scale)
        .setDepth(this.owner.renderY + (hands.behindHands ? -0.1 : 0.5));
      this.renderTrail(projector);
      return;
    }
    this.shadow.setVisible(true);
    this.sprite.setOrigin(0.5, 1);
    // Shadow on the ground under the ball: smaller and fainter the higher it is.
    projector.project(this.renderX, this.renderY, 0, at);
    const high = Math.min(1, this.renderZ / 200);
    this.shadow
      .setPosition(at.x, at.y)
      .setScale(PX * at.scale * (1 - 0.4 * high))
      .setAlpha(0.45 * (1 - 0.6 * high))
      .setDepth(this.renderY + 0.4);

    projector.project(this.renderX, this.renderY, this.renderZ, at);
    // Height also reads from a slight scale-up as the ball rises.
    const lift = 1 + this.renderZ / 400;
    // Rolling left plays the frames backwards; a straight up / down roll
    // keeps the last direction.
    if (Math.abs(this.vx) > 1) this.rollDir = this.vx < 0 ? -1 : 1;
    this.rolled += this.speed * dtSec * this.rollDir;
    const n = BALL_FRAMES.length;
    const rollFrame = ((Math.floor(this.rolled / 14) % n) + n) % n;
    const shotFrame = Math.floor(this.shotAnimationAge * 18);
    const shotVisual = shotFrame < BALL_SHOT_FRAMES.length;
    this.shotAnimationAge += dtSec;
    this.sprite
      .setOrigin(0.5, shotVisual ? 0.5 : 1)
      .setFrame(
        shotVisual
          ? (BALL_SHOT_FRAMES[shotFrame] ?? 'shot1')
          : (BALL_FRAMES[rollFrame] ?? 'a')
      )
      .setPosition(
        at.x,
        at.y - (shotVisual ? ((BALL_W * PX) / 2) * at.scale * lift : 0)
      )
      .setScale(((BALL_W * PX) / BALL_TEXTURE_W) * at.scale * lift)
      .setDepth(this.renderY + 0.5);

    this.renderTrail(projector);
  }

  private renderTrail(projector: Projector) {
    const pts = this.trailPoints;
    if (!this.owner && this.speed > SHOOT.trailMinSpeed && this.inNet === 0)
      pts.push({ x: this.renderX, y: this.renderY, z: this.renderZ });
    else pts.shift(); // fades out once the ball slows or is controlled
    while (pts.length > TRAIL_LENGTH) pts.shift();

    const g = this.trail.clear().setDepth(this.renderY + 0.45);
    pts.forEach((p, i) => {
      const f = (i + 1) / (pts.length + 1); // older points fainter and smaller
      projector.project(p.x, p.y, p.z, at);
      g.fillStyle(PAL.white, 0.45 * f).fillCircle(
        at.x,
        at.y - (BALL_W / 2) * PX * at.scale, // sprite is drawn from its bottom
        Math.max(1, 2.5 * PX * at.scale * f)
      );
    });
  }
}
