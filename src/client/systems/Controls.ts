import type Phaser from 'phaser';
import { STICK } from '../../shared/tuning';

// Stick direction as a unit vector plus how far it is pushed (0..1 of the radius).
export type StickInput = { x: number; y: number; r: number };

// The two context buttons (1 = pass / tackle, 2 = shoot / switch).
export type ButtonId = 1 | 2;

// An action button's swipe from where the thumb pressed, each axis -1..1
// (screen axes, y down; full at SHOOT.swipeFullPx). Diagonals mix effects.
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

  // Keep each button's last swipe after release for the simulation.
  private readonly swipes: Record<ButtonId, SwipeVec> = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: 0 },
  };

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

  // WASD/arrows move; left Shift sprints. N is pass/tackle, K is
  // power shot/switch; I/J/L shoot with chip/left curl/right curl.
  bindKeyboard(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const add = (...codes: string[]) => codes.map((code) => kb.addKey(code));
    this.keys = {
      up: add('W', 'UP'),
      down: add('S', 'DOWN'),
      left: add('A', 'LEFT'),
      right: add('D', 'RIGHT'),
      sprint: add('SHIFT'),
      b1: add('N'),
      b2: add('K'),
      chip: add('I'),
      power: add('K'),
      curlLeft: add('J'),
      curlRight: add('L'),
    };
  }

  press(id: ButtonId) {
    const b = this.buttons[id];
    b.held = true;
    b.pressedAt = now();
    b.heldSince = b.pressedAt;
    this.setSwipe(id, 0, 0);
  }

  setSwipe(id: ButtonId, x: number, y: number) {
    this.swipes[id] = { x, y };
  }

  swipeFor(id: ButtonId): SwipeVec {
    return this.swipes[id];
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

    // N/K use the context buttons; shot keys also supply the shot effect.
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
        if (id === 2 && keySwipe) this.setSwipe(id, keySwipe.x, keySwipe.y);
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
    const sprint =
      k?.sprint.some((key) => key.isDown && key.location === 1) ?? false;
    // Without Shift the keyboard walks at full walk speed (just inside the sprint ring).
    this.move =
      len > 0
        ? { x: x / len, y: y / len, r: sprint ? 1 : STICK.sprintAt }
        : { x: 0, y: 0, r: 0 };
    this.sprint = len > 0 && sprint;
  }
}
