import Phaser from 'phaser';
import { STICK, VIEW } from '../../shared/tuning';
import {
  STICK_BAND,
  STICK_BASE,
  STICK_KNOB,
  createStickTextures,
} from '../art/playerArt';
import type { Controls } from '../systems/Controls';
import { PAL, PX } from './palette';

const REST_X = 200; // where the faint idle joystick sits, bottom-left thumb zone
const REST_Y = VIEW.height - 190;
const EDGE = 12; // keep the ring this far inside the screen

// Floating joystick: appears wherever the left thumb lands in the left half
// of the screen. Tracks a single pointer id so the other thumb (buttons on
// the right) never interferes. Past 85% of the radius the outer band glows:
// that is sprint.
export class Joystick {
  enabled = true;
  private pointerId: number | null = null;
  private baseX = REST_X;
  private baseY = REST_Y;
  private readonly base: Phaser.GameObjects.Image;
  private readonly band: Phaser.GameObjects.Image;
  private readonly knob: Phaser.GameObjects.Image;
  private readonly radius = STICK.radius;

  constructor(
    scene: Phaser.Scene,
    private readonly controls: Controls
  ) {
    createStickTextures(scene, Math.round(this.radius / PX), STICK.sprintAt);
    this.base = scene.add.image(0, 0, STICK_BASE).setScale(PX);
    this.band = scene.add.image(0, 0, STICK_BAND).setScale(PX);
    this.knob = scene.add.image(0, 0, STICK_KNOB).setScale(PX);
    this.rest();

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  release() {
    this.pointerId = null;
    this.controls.touchStick = null;
    this.rest();
  }

  // Called every frame: band colour reflects the sprint state.
  update() {
    const stick = this.controls.touchStick;
    const pushingSprint = stick !== null && stick.r > STICK.sprintAt;
    this.band.setVisible(pushingSprint);
    this.band.setTint(this.controls.sprintLocked ? PAL.red : PAL.yellow);
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (!this.enabled || this.pointerId !== null || pointer.x >= VIEW.width / 2)
      return;
    this.pointerId = pointer.id;
    this.baseX = Phaser.Math.Clamp(
      pointer.x,
      this.radius + EDGE,
      VIEW.width / 2 - this.radius
    );
    this.baseY = Phaser.Math.Clamp(
      pointer.y,
      this.radius + EDGE,
      VIEW.height - this.radius - EDGE
    );
    this.setAlpha(1);
    this.onMove(pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.baseX;
    const dy = pointer.y - this.baseY;
    const dist = Math.hypot(dx, dy);
    const r = Math.min(1, dist / this.radius);
    this.controls.touchStick =
      dist > 0 ? { x: dx / dist, y: dy / dist, r } : { x: 0, y: 0, r: 0 };
    const reach = Math.min(dist, this.radius);
    const kx = dist > 0 ? this.baseX + (dx / dist) * reach : this.baseX;
    const ky = dist > 0 ? this.baseY + (dy / dist) * reach : this.baseY;
    this.place(kx, ky);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.pointerId) return;
    this.release();
  }

  // Idle: a faint stick in the thumb zone shows where to touch.
  private rest() {
    this.baseX = REST_X;
    this.baseY = REST_Y;
    this.place(REST_X, REST_Y);
    this.band.setVisible(false);
    this.setAlpha(0.35);
  }

  private place(knobX: number, knobY: number) {
    this.base.setPosition(this.baseX, this.baseY);
    this.band.setPosition(this.baseX, this.baseY);
    this.knob.setPosition(knobX, knobY);
  }

  private setAlpha(alpha: number) {
    this.base.setAlpha(alpha);
    this.knob.setAlpha(alpha);
  }
}
