const STORAGE_KEY = 'street-soccer:keyboard:v1';

export const KEY_ACTIONS = [
  'forward',
  'left',
  'right',
  'backward',
  'sprint',
  'chip',
  'shotLeft',
  'shotRight',
  'power',
  'pass',
  'lob',
  'passLeft',
  'passRight',
  'pause',
  'info',
  'mute',
] as const;

export type KeyAction = (typeof KEY_ACTIONS)[number];
export type KeyBindings = Record<KeyAction, string>;

export const DEFAULT_KEYS: Readonly<KeyBindings> = {
  forward: 'KeyW',
  left: 'KeyA',
  right: 'KeyD',
  backward: 'KeyS',
  sprint: 'Shift',
  chip: 'KeyI',
  shotLeft: 'KeyJ',
  shotRight: 'KeyL',
  power: 'KeyK',
  pass: 'KeyN',
  lob: 'KeyB',
  passLeft: 'KeyV',
  passRight: 'KeyM',
  pause: 'Escape',
  info: 'Tab',
  mute: 'Space',
};

export const keyCode = (code: string) =>
  code === 'ShiftLeft' || code === 'ShiftRight' ? 'Shift' : code;

export const keyLabel = (code: string) => {
  if (code === 'Shift') return 'SHIFT L/R';
  if (code === 'Escape') return 'ESC';
  return code
    .replace(/^(Key|Digit|Arrow)/, '')
    .replace(/^Numpad/, 'NUM ')
    .toUpperCase();
};

export function isBindableKey(code: unknown): code is string {
  return (
    typeof code === 'string' &&
    !['Digit8', 'Digit9', 'Digit0'].includes(code) &&
    /^(Key[A-Z]|(?:Digit|Numpad)[0-9]|Arrow(?:Up|Down|Left|Right)|Shift|Space|Tab|Escape|Enter|Backspace)$/.test(
      code
    )
  );
}

export function actionForKey(bindings: Readonly<KeyBindings>, code: string) {
  return KEY_ACTIONS.find((action) => bindings[action] === keyCode(code));
}

export function loadKeyBindings(): KeyBindings {
  const bindings = { ...DEFAULT_KEYS };
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null'
    );
    if (typeof raw !== 'object' || !raw) return bindings;
    const used = new Set<string>();
    for (const action of KEY_ACTIONS) {
      const saved: unknown = Reflect.get(raw, action);
      // An action added after the layout was saved takes its default key
      // (if that key is still free), keeping the player's other choices.
      const code = saved === undefined ? DEFAULT_KEYS[action] : saved;
      if (!isBindableKey(code) || used.has(code)) return { ...DEFAULT_KEYS };
      used.add(code);
      bindings[action] = code;
    }
  } catch {
    return { ...DEFAULT_KEYS };
  }
  return bindings;
}

export function saveKeyBindings(bindings: Readonly<KeyBindings>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
    return true;
  } catch {
    return false;
  }
}
