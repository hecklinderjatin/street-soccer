import { STICK } from '../../shared/tuning';
import { DEFAULT_KEYS, type KeyAction, type KeyBindings } from './keyBindings';

// Stick direction as a unit vector plus how far it is pushed (0..1 of the radius).
export type StickInput = { x: number; y: number; r: number };

// The two context buttons (1 = pass / tackle, 2 = shoot / switch).
export type ButtonId = 1 | 2;

// An action button's swipe from where the thumb pressed, each axis -1..1
// (screen axes, y down; full at SHOOT.swipeFullPx). Diagonals mix effects.
export type SwipeVec = { x: number; y: number };

type ButtonState = {
  touchHeld: boolean;
  keyboardHeld: boolean;
  pressedAt: number; // real seconds of the latest unconsumed press, or -Infinity
  heldSince: number; // real seconds the current hold started
};

const now = () => performance.now() / 1000;

const KEY_STRIKES: Partial<
  Record<KeyAction, { id: ButtonId; x: number; y: number }>
> = {
  pass: { id: 1, x: 0, y: 0 },
  lob: { id: 1, x: 0, y: -1 },
  passLeft: { id: 1, x: -1, y: 0 },
  passRight: { id: 1, x: 1, y: 0 },
  chip: { id: 2, x: 0, y: -1 },
  shotLeft: { id: 2, x: -1, y: 0 },
  shotRight: { id: 2, x: 1, y: 0 },
  power: { id: 2, x: 0, y: 1 },
};

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
    1: {
      touchHeld: false,
      keyboardHeld: false,
      pressedAt: -Infinity,
      heldSince: 0,
    },
    2: {
      touchHeld: false,
      keyboardHeld: false,
      pressedAt: -Infinity,
      heldSince: 0,
    },
  };
  private readonly keys = new Map<string, KeyAction>();
  private bindings: Readonly<KeyBindings> = DEFAULT_KEYS;

  get keyBindings() {
    return this.bindings;
  }

  setKeyBindings(bindings: Readonly<KeyBindings>) {
    this.clearKeyboard();
    this.bindings = bindings;
  }

  keyDown(code: string, action: KeyAction) {
    if (this.keys.has(code)) return;
    this.keys.set(code, action);
    const strike = KEY_STRIKES[action];
    if (!strike) return;
    const { id, x, y } = strike;
    if (!this.isHeld(id)) this.beginPress(id, x, y);
    this.buttons[id].keyboardHeld = true;
  }

  keyUp(code: string) {
    const action = this.keys.get(code);
    if (!action) return;
    this.keys.delete(code);
    const strike = KEY_STRIKES[action];
    if (!strike) return;
    const { id } = strike;
    this.buttons[id].keyboardHeld = [...this.keys.values()].some(
      (held) => KEY_STRIKES[held]?.id === id
    );
  }

  clearKeyboard() {
    this.keys.clear();
    for (const id of [1, 2] as const) {
      this.buttons[id].keyboardHeld = false;
      this.consume(id);
    }
  }

  press(id: ButtonId) {
    this.buttons[id].touchHeld = true;
    this.beginPress(id, 0, 0);
  }

  private beginPress(id: ButtonId, x: number, y: number) {
    const b = this.buttons[id];
    b.pressedAt = now();
    b.heldSince = b.pressedAt;
    this.setSwipe(id, x, y);
  }

  setSwipe(id: ButtonId, x: number, y: number) {
    this.swipes[id] = { x, y };
  }

  swipeFor(id: ButtonId): SwipeVec {
    return this.swipes[id];
  }

  release(id: ButtonId) {
    this.buttons[id].touchHeld = false;
  }

  isHeld(id: ButtonId) {
    const b = this.buttons[id];
    return b.touchHeld || b.keyboardHeld;
  }

  heldFor(id: ButtonId) {
    return this.isHeld(id) ? now() - this.buttons[id].heldSince : 0;
  }

  // Seconds since an unconsumed press (Infinity if none).
  pressAge(id: ButtonId) {
    return now() - this.buttons[id].pressedAt;
  }

  consume(id: ButtonId) {
    this.buttons[id].pressedAt = -Infinity;
  }

  sample() {
    if (this.touchStick) {
      this.move = this.touchStick;
      this.sprint = this.touchStick.r > STICK.sprintAt;
      return;
    }
    const down = (action: KeyAction) => {
      const code = this.bindings[action];
      return code === 'Shift'
        ? this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
        : this.keys.has(code);
    };
    const x = Number(down('right')) - Number(down('left'));
    const y = Number(down('backward')) - Number(down('forward'));
    const len = Math.hypot(x, y);
    const sprint = down('sprint');
    // Without Shift the keyboard walks at full walk speed (just inside the sprint ring).
    this.move =
      len > 0
        ? { x: x / len, y: y / len, r: sprint ? 1 : STICK.sprintAt }
        : { x: 0, y: 0, r: 0 };
    this.sprint = len > 0 && sprint;
  }
}
