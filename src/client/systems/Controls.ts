import Phaser from 'phaser';
import { STICK } from '../../shared/tuning';

// Stick direction as a unit vector plus how far it is pushed (0..1 of the radius).
export type StickInput = { x: number; y: number; r: number };

// The two context buttons (1 = pass / tackle, 2 = shoot / switch).
export type ButtonId = 1 | 2;

// A swipe on the SHOOT (or keeper KICK) button, analog: how far the thumb
// slid from where it pressed, each axis -1..1 (screen axes, y down; full
// at SHOOT.swipeFullPx). Up = chip, down = power, left / right = curl, and
// the size is how much of that effect the strike gets; diagonals mix.
export type SwipeVec = { x: number; y: number };

type ButtonState = {
  held: boolean;
  pressedAt: number; // real seconds of the latest unconsumed press, or -Infinity
  heldSince: number; // real seconds the current hold started
};

const now = () => performance.now() / 1000;

// The bridge between input and simulation. The on-screen joystick and
// buttons (HUD scene) and the keyboard write here; the simulation reads the
// merged result and consumes button presses.
export class Controls {
  // Written by the on-screen joystick while a thumb is on it.
  touchStick: StickInput | null = null;

  // Merged input, refreshed by sample() once per frame.
  move: StickInput = { x: 0, y: 0, r: 0 };
  sprint = false;

  // Swipe of the latest press of button 2 (kept after release so the
  // simulation can read it when it fires the shot).
  swipe: SwipeVec = { x: 0, y: 0 };

  // Feedback from the simulation for the HUD.
  sprinting = false;
  sprintLocked = false;

  private readonly buttons: Record<ButtonId, ButtonState> = {
    1: { held: false, pressedAt: -Infinity, heldSince: 0 },
    2: { held: false, pressedAt: -Infinity, heldSince: 0 },
  };
  private keys: Record<
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'sprint'
    | 'b1'
    | 'b2'
    | 'chip'
    | 'power'
    | 'curlLeft'
    | 'curlRight',
    Phaser.Input.Keyboard.Key[]
  > | null = null;
  private keyHeld: Record<ButtonId, boolean> = { 1: false, 2: false };

  // Desktop fallback: WASD or arrows to move, Shift to sprint, J and K for
  // the buttons. T / G / F / H act as K with a full swipe up / down / left /
  // right.
  bindKeyboard(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]) => codes.map((code) => kb.addKey(code));
    this.keys = {
      up: add(K.W, K.UP),
      down: add(K.S, K.DOWN),
      left: add(K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
      sprint: add(K.SHIFT),
      b1: add(K.J),
      b2: add(K.K),
      chip: add(K.T),
      power: add(K.G),
      curlLeft: add(K.F),
      curlRight: add(K.H),
    };
  }

  press(id: ButtonId) {
    const b = this.buttons[id];
    b.held = true;
    b.pressedAt = now();
    b.heldSince = b.pressedAt;
    if (id === 2) this.swipe = { x: 0, y: 0 };
  }

  setSwipe(x: number, y: number) {
    this.swipe = { x, y };
  }

  release(id: ButtonId) {
    this.buttons[id].held = false;
  }

  isHeld(id: ButtonId) {
    return this.buttons[id].held;
  }

  heldFor(id: ButtonId) {
    return this.buttons[id].held ? now() - this.buttons[id].heldSince : 0;
  }

  // Seconds since an unconsumed press (Infinity if none).
  pressAge(id: ButtonId) {
    return now() - this.buttons[id].pressedAt;
  }

  consume(id: ButtonId) {
    this.buttons[id].pressedAt = -Infinity;
  }

  sample() {
    const down = (keys: Phaser.Input.Keyboard.Key[] | undefined) =>
      keys?.some((k) => k.isDown) ?? false;
    const k = this.keys;

    // J/K behave exactly like the on-screen buttons.
    const swipeKeys: [SwipeVec, Phaser.Input.Keyboard.Key[] | undefined][] = [
      [{ x: 0, y: -1 }, k?.chip],
      [{ x: 0, y: 1 }, k?.power],
      [{ x: -1, y: 0 }, k?.curlLeft],
      [{ x: 1, y: 0 }, k?.curlRight],
    ];
    const keySwipe = swipeKeys.find(([, keys]) => down(keys))?.[0];
    for (const [id, keys] of [
      [1, k?.b1],
      [2, k?.b2],
    ] as const) {
      const isDown = down(keys) || (id === 2 && keySwipe !== undefined);
      if (isDown && !this.keyHeld[id]) {
        this.press(id);
        if (id === 2 && keySwipe) this.swipe = keySwipe;
      }
      if (!isDown && this.keyHeld[id]) this.release(id);
      this.keyHeld[id] = isDown;
    }

    if (this.touchStick) {
      this.move = this.touchStick;
      this.sprint = this.touchStick.r > STICK.sprintAt;
      return;
    }
    const x = (down(k?.right) ? 1 : 0) - (down(k?.left) ? 1 : 0);
    const y = (down(k?.down) ? 1 : 0) - (down(k?.up) ? 1 : 0);
    const len = Math.hypot(x, y);
    const sprint = down(k?.sprint);
    // Without Shift the keyboard walks at full walk speed (just inside the sprint ring).
    this.move =
      len > 0
        ? { x: x / len, y: y / len, r: sprint ? 1 : STICK.sprintAt }
        : { x: 0, y: 0, r: 0 };
    this.sprint = len > 0 && sprint;
  }
}
