import Phaser from 'phaser';
import { STAMINA } from '../../shared/tuning';
import type { Team } from '../../shared/types';
import { newProjected, type Projector } from '../render/Projector';
import { PAL, PX } from '../ui/palette';
import {
  MARKER_ARROW,
  MARKER_TARGET,
  PLAYER_H,
  playerTexture,
  runAnim,
  type Kit,
} from '../art/playerArt';

export type Role = 'outfield' | 'keeper';

const DEPTH_OVERLAY = 2_000_000; // above the fence
const BAR_W = 14; // stamina bar width in art pixels
const feet = newProjected();
const head = newProjected();

// A player in the 2.5D world: ground position (x, y) plus height z.
// Simulation state is plain fields (stepped at a fixed rate); render()
// draws an interpolated frame through the perspective Projector, as a
// camera-facing sprite scaled by distance and depth-sorted by ground y.
export class Player {
  x: number;
  y: number;
  z = 0;
  prevX: number;
  prevY: number;
  heading = 0; // radians, direction of travel (and facing when standing)
  speed = 0; // px/s along heading
  stamina: number = STAMINA.max;
  sprinting = false;
  sprintLocked = false;
  sinceSprint = Infinity; // seconds since the last sprint tick
  controlled = false; // the human's player
  renderX: number; // interpolated ground position for this render frame
  renderY: number;

  // Possession and actions (sim time in seconds).
  lockUntil = 0; // can't touch the ball before this (after losing or releasing it)
  touchTimer = 0; // seconds since the last dribble touch
  dribbleAngle = 0; // where the ball sits around the carrier (radians) ...
  dribbleDist = 0; // ... and how far from the feet
  receiving = false; // the intended receiver of the pass in flight
  holdTimer = 0; // keeper: how long the ball has been held
  holding = false; // keeper: has the ball in its hands (only possible inside its box)
  diveUntil = 0; // keeper: diving until this sim time ...
  recoverUntil = 0; // ... then down until this one
  diveDir = 0; // keeper: dive direction (radians)
  lying = false; // keeper: diving or down after a dive (drawn on its side)
  reactAt = -1; // CPU keeper: sim time it reacts to the shot it has seen (-1 = none)
  passTarget = false; // drawn with the blue ring: where a pass would go now

  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly targetRing: Phaser.GameObjects.Image;
  private readonly arrow: Phaser.GameObjects.Image;
  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly kit: Kit;

  constructor(
    scene: Phaser.Scene,
    readonly team: Team,
    readonly role: Role,
    x: number,
    y: number
  ) {
    this.x = this.prevX = this.renderX = x;
    this.y = this.prevY = this.renderY = y;
    this.heading = team === 'home' ? 0 : Math.PI;
    this.kit =
      role === 'keeper'
        ? team === 'home'
          ? 'homeKeeper'
          : 'awayKeeper'
        : team;

    this.targetRing = scene.add.image(0, 0, MARKER_TARGET);
    this.sprite = scene.add
      .sprite(0, 0, playerTexture(this.kit), 'idle')
      .setOrigin(0.5, 1);
    this.arrow = scene.add
      .image(0, 0, MARKER_ARROW)
      .setScale(PX)
      .setDepth(DEPTH_OVERLAY);
    this.barBg = scene.add
      .rectangle(0, 0, (BAR_W + 2) * PX, 3 * PX, PAL.black)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_OVERLAY);
    this.barFill = scene.add
      .rectangle(0, 0, BAR_W * PX, PX, PAL.green)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_OVERLAY);
  }

  get vx() {
    return Math.cos(this.heading) * this.speed;
  }

  get vy() {
    return Math.sin(this.heading) * this.speed;
  }

  // Puts the player on a spot, standing, facing the way their team attacks.
  placeAt(x: number, y: number) {
    this.x = this.prevX = this.renderX = x;
    this.y = this.prevY = this.renderY = y;
    this.speed = 0;
    this.heading = this.team === 'home' ? 0 : Math.PI;
    this.receiving = false;
    this.lockUntil = 0;
    this.touchTimer = 0;
    this.holdTimer = 0;
    this.holding = false;
    this.diveUntil = 0;
    this.recoverUntil = 0;
    this.lying = false;
    this.reactAt = -1;
  }

  // Call at the start of every simulation step.
  savePrevious() {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  // Sets renderX/renderY for this frame; call before the camera update.
  interpolate(alpha: number) {
    this.renderX = this.prevX + (this.x - this.prevX) * alpha;
    this.renderY = this.prevY + (this.y - this.prevY) * alpha;
  }

  render(projector: Projector, timeSec: number) {
    const x = this.renderX;
    const y = this.renderY;
    projector.project(x, y, this.z, feet);
    projector.project(x, y, this.z + PLAYER_H * PX, head);

    this.sprite
      .setPosition(feet.x, feet.y)
      .setScale(PX * feet.scale)
      .setDepth(y);
    this.sprite.setAngle(
      this.lying ? (Math.cos(this.diveDir) < 0 ? -80 : 80) : 0
    );
    if (this.speed > 10) {
      this.sprite.play(runAnim(this.kit), true);
      // Leg cycle speeds up with running speed (sprint ~1.5x).
      this.sprite.anims.timeScale = this.speed / 220;
    } else if (this.sprite.anims.isPlaying) {
      this.sprite.stop().setFrame('idle');
    }
    const cos = Math.cos(this.heading);
    if (Math.abs(cos) > 0.2) this.sprite.setFlipX(cos < 0);

    // The pass-target ring (a perspective-squashed circle) and overhead
    // markers, which keep a fixed screen size and sit just above the sprite.
    // The controlled player is marked by the arrow overhead and the facing
    // arrow on the ground (drawn by the Match scene).
    const top = feet.y - PLAYER_H * PX * feet.scale;
    const squash = projector.groundSquash(x, y);
    projector.project(x, y, 0, feet);
    const ringScale = PX * feet.scale;
    const pulse = 1 + 0.15 * Math.sin(timeSec * 10);
    this.targetRing
      .setVisible(this.passTarget && !this.controlled)
      .setPosition(feet.x, feet.y)
      .setScale(ringScale * pulse, ringScale * squash * pulse)
      .setDepth(y - 1);
    this.arrow.setVisible(this.controlled).setPosition(head.x, top - 8 * PX);

    // Stamina bar over the controlled player's head; flashes red while locked.
    const show = this.controlled;
    const frac = this.stamina / STAMINA.max;
    const color = this.sprintLocked
      ? PAL.red
      : frac > 0.6
        ? PAL.green
        : frac > 0.3
          ? PAL.yellow
          : PAL.orange;
    const left = head.x - ((BAR_W + 2) * PX) / 2;
    const barY = top - 3 * PX;
    this.barBg.setVisible(show).setPosition(left, barY);
    this.barFill
      .setVisible(
        show &&
          (!this.sprintLocked || Math.floor((timeSec * 1000) / 150) % 2 === 0)
      )
      .setPosition(left + PX, barY)
      .setSize(Math.max(1, Math.round(frac * BAR_W)) * PX, PX)
      .setFillStyle(color);
  }
}
