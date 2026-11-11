import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import { VIEW } from '../../shared/tuning';
import { STICK_BASE, STICK_KNOB, createButtonTexture } from '../art/playerArt';
import {
  keyLabel,
  type KeyAction,
  type KeyBindings,
} from '../systems/keyBindings';
import { ACTION_COLORS } from './ActionButtons';
import { CARD, fit, infoFrame, tile } from './infoCard';
import { PAL, PX } from './palette';
import { CELL_W, pixelText } from './pixelFont';
import { TextButton } from './TextButton';

// The "how to play" panel behind the HUD's i button. Touch devices see
// every on-screen control with the game's own icons (the joystick ring, the
// coloured button discs, the shot swipe arrows); desktop sees only the
// keyboard, as key caps showing the current bindings. Built hidden;
// HudScene shows it (and pauses the match) and hides it again.

// Every text size is a whole number of screen pixels per font pixel (2 or
// 3): fractional sizes garble the pixel letters.
const DISC_ART = 22; // button disc texture radius (art px), drawn at x2: crisp
const DISC_SCALE = 2;
const DISC_R = DISC_ART * DISC_SCALE; // 44 screen px: room for a 2x label
const BODY = 0.5 * PX; // body text: 2 screen px per font pixel (crisp)
const HEAD = 0.75 * PX;
const LINE = 11 * BODY; // body line height (9 px cell + 2 px line spacing)
const ROW = 2 * DISC_R + 4; // a row with an icon
const SHOOT_ROW = ROW + 22; // room for the slide arrows round SHOOT
const HEAD_ROW = 34;
const TOP = 92; // first section header
const TEXT_DX = 2 * DISC_R + 24; // text starts this far right of the column

type Item = Phaser.GameObjects.GameObject;

export function buildHelpLayer(
  scene: Phaser.Scene,
  onClose: () => void,
  options: { label?: string; back?: () => void; desktop?: boolean } = {}
) {
  const items: Item[] = [];
  const cx = VIEW.width / 2;

  // The results-card frame (infoCard) with the two columns on tiles.
  infoFrame(scene, items, {
    accent: PAL.orange,
    tag: options.desktop ? 'KEYBOARD' : 'TOUCH CONTROLS',
    tagColor: PAL.blue,
    page: options.back ? 'MATCH INFO  2 / 2' : '',
  });
  items.push(
    pixelText(scene, cx, 62, 'HOW TO PLAY', PX, PAL.yellow).setOrigin(0.5)
  );
  tile(scene, items, 60, TOP - 8, 560, 504);
  tile(scene, items, cx + 20, TOP - 8, 560, 504);

  // Desktop shows only the keyboard; touch devices only the on-screen
  // controls (user request).
  const caps = options.desktop
    ? keyboardColumns(scene, items, 80, cx + 40)
    : (touchColumns(scene, items, 80, cx + 40), []);
  // Devvit Rules: players need a way to report problems with the app.
  const where = context?.subredditName
    ? `MESSAGE THE MODS OF R/${context.subredditName}`
    : 'MESSAGE THE MODS OF THIS SUBREDDIT';
  items.push(
    pixelText(
      scene,
      cx,
      700,
      'DELETE SAVED SCORES: SUBREDDIT MENU > DELETE MY STREET SOCCER DATA',
      1,
      CARD.soft
    ).setOrigin(0.5),
    pixelText(
      scene,
      cx,
      710,
      `REPORT A PROBLEM: ${where}`,
      BODY,
      CARD.soft
    ).setOrigin(0.5)
  );

  // A dedicated strip, rather than tactics buried in the footer copy.
  tile(scene, items, 60, 592, 1160, 44);
  for (const [i, [name, detail]] of [
    ['DEFEND', 'DROP THE TEAM BACK'],
    ['NORMAL', 'DEFAULT POSITIONING'],
    ['ATTACK', 'BACK LINE TO HALFWAY'],
  ].entries()) {
    const x = 80 + i * 380;
    const control = options.desktop
      ? `${8 + i > 9 ? 0 : 8 + i}: ${name}`
      : name;
    items.push(
      pixelText(scene, x, 595, `TACTICS / ${control}`, 2, PAL.yellow),
      pixelText(scene, x, 615, detail ?? '', 2, CARD.soft)
    );
  }

  // Results-card buttons: the primary in orange, BACK in navy.
  items.push(
    new TextButton(
      scene,
      options.back ? cx + 160 : cx,
      664,
      options.label ?? 'GOT IT',
      onClose,
      {
        width: options.back ? 340 : 280,
        height: 56,
        fill: PAL.orange,
      }
    )
  );
  if (options.back)
    items.push(
      new TextButton(scene, cx - 210, 664, 'BACK', options.back, {
        width: 220,
        height: 56,
        fill: CARD.secondary,
      })
    );
  return {
    layer: scene.add.container(0, 0, items).setDepth(10),
    // Desktop key caps show the player's current bindings.
    refreshKeys(bindings: Readonly<KeyBindings>) {
      for (const cap of caps) cap.refresh(bindings);
    },
  };
}

// --- Touch: the game's own joystick and button discs ---
function touchColumns(
  scene: Phaser.Scene,
  items: Item[],
  left: number,
  right: number
) {
  let y = TOP;
  y = header(scene, items, left, y, 'MOVE');
  joystickIcon(scene, items, left + DISC_R, y + DISC_R);
  y = rowText(scene, items, left, y, [
    'DRAG ON THE LEFT HALF',
    'PUSH TO THE EDGE: SPRINT',
  ]);
  y = header(scene, items, left, y, 'WITH THE BALL');
  const passRow = 5 * LINE + 8;
  // PASS slides like SHOOT (up air, down ground, left/right curl): same arrows.
  disc(scene, items, left + DISC_R, y + passRow / 2, 'PASS');
  swipeArrows(scene, items, left + DISC_R, y + passRow / 2);
  y = rowText(
    scene,
    items,
    left,
    y,
    [
      'TAP: PASS   HOLD: SET PACE',
      'SLIDE UP: AIR PASS',
      'SLIDE DOWN: GROUND PASS',
      'SLIDE LEFT / RIGHT: CURL',
      'CURL + HOLD HARD: IN THE AIR',
    ],
    passRow
  );
  disc(scene, items, left + DISC_R, y + SHOOT_ROW / 2, 'SHOOT');
  swipeArrows(scene, items, left + DISC_R, y + SHOOT_ROW / 2);
  rowText(
    scene,
    items,
    left,
    y,
    [
      'HOLD TO CHARGE, LET GO',
      'IN THE GREEN: PERFECT SHOT',
      'SLIDE UP: CHIP  DOWN: POWER',
      'SLIDE LEFT / RIGHT: CURL',
    ],
    SHOOT_ROW
  );

  y = TOP;
  y = header(scene, items, right, y, 'WITHOUT THE BALL');
  disc(scene, items, right + DISC_R, y + DISC_R, 'TACKLE');
  y = rowText(scene, items, right, y, [
    'CLOSE: POKE  FURTHER: SLIDE',
    'CUT SHARPLY TO DODGE ONE',
  ]);
  disc(scene, items, right + DISC_R, y + DISC_R, 'SWITCH');
  y = rowText(scene, items, right, y, [
    'TAP: CHANGE OUTFIELD PLAYER',
    'TAP AGAIN: CYCLE TEAMMATES',
  ]);
  y = header(scene, items, right, y, 'GOALKEEPER');
  disc(scene, items, right + DISC_R, y + DISC_R, 'DIVE');
  y = rowText(scene, items, right, y, [
    'WITH THE STICK: DIVE THAT WAY',
    'STICK CENTRED: SAVE OR JUMP',
  ]);
  // THROW and KICK side by side; the text starts after both discs.
  const second = 2 * DISC_R + 4;
  disc(scene, items, right + DISC_R, y + DISC_R, 'THROW');
  disc(scene, items, right + DISC_R + second, y + DISC_R, 'KICK');
  rowText(scene, items, right + second, y, [
    'BALL IN HANDS:',
    'THROW TO RINGED MATE',
    'KICK: SAME AS SHOOT',
  ]);
}

// --- Desktop: key caps (current bindings) with what each key does ---
type Entry =
  { head: string } | { keys: KeyAction[]; text: string } | { note: string };

const LEFT_KEYS: Entry[] = [
  { head: 'MOVE' },
  { keys: ['forward', 'left', 'backward', 'right'], text: 'MOVE' },
  { keys: ['sprint'], text: 'HOLD TO SPRINT' },
  { head: 'PASS' },
  { keys: ['pass'], text: 'GROUND PASS (HOLD: PACE)' },
  { keys: ['lob'], text: 'AIR PASS: OVER DEFENDERS' },
  { keys: ['passLeft', 'passRight'], text: 'CURL PASS LEFT / RIGHT' },
  { note: 'TAP: CURL ON THE GROUND' },
  { note: 'HOLD PAST HALF: AIR CURL' },
  { head: 'SHOOT (HOLD + RELEASE)' },
  { keys: ['chip'], text: 'CHIP SHOT' },
  { keys: ['shotLeft', 'shotRight'], text: 'CURL SHOT LEFT / RIGHT' },
  { keys: ['power'], text: 'POWER SHOT' },
  { note: 'GREEN ON RELEASE: PERFECT' },
];
const RIGHT_KEYS: Entry[] = [
  { head: 'WITHOUT THE BALL' },
  { keys: ['pass'], text: 'TACKLE: POKE OR SLIDE' },
  { keys: ['power'], text: 'SWITCH PLAYER' },
  { head: 'GOALKEEPER' },
  { keys: ['pass'], text: 'DIVE: AIM WITH MOVE KEYS' },
  { keys: ['pass'], text: 'BALL IN HANDS: THROW' },
  { keys: ['power'], text: 'BALL IN HANDS: KICK' },
  { note: 'SHOT KEYS SHAPE THE KICK' },
  { head: 'MATCH' },
  { keys: ['pause'], text: 'PAUSE' },
  { keys: ['info'], text: 'MATCH INFO' },
  { keys: ['mute'], text: 'SOUND ON / OFF' },
  { note: 'REMAP KEYS: CONTROLS, PAGE 1' },
];

const KEY_ROW = 32; // a row with a key cap (at least)
const NOTE_ROW = 24; // a muted note under a row
const CAP_H = 26;
const COL_W = 520;
const COL_BOTTOM = TOP - 8 + 504 - 14; // inside the column tile

type KeyCap = { refresh: (bindings: Readonly<KeyBindings>) => void };

function keyboardColumns(
  scene: Phaser.Scene,
  items: Item[],
  left: number,
  right: number
): KeyCap[] {
  return [
    keyColumn(scene, items, left, LEFT_KEYS),
    keyColumn(scene, items, right, RIGHT_KEYS),
  ];
}

// One column of sections. Spare height goes to the gaps between sections
// first, then to the rows, so the column fills its tile. Descriptions and
// notes line up just past the column's widest key cap (refresh).
function keyColumn(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  entries: Entry[]
): KeyCap {
  const heads = entries.filter((e) => 'head' in e).length;
  const rows = entries.filter((e) => 'keys' in e).length;
  const notes = entries.length - heads - rows;
  const spare = Math.max(
    0,
    COL_BOTTOM - TOP - heads * HEAD_ROW - rows * KEY_ROW - notes * NOTE_ROW
  );
  const headGap = heads > 1 ? Math.min(30, (spare * 0.6) / (heads - 1)) : 0;
  const rowPad = rows
    ? Math.min(10, (spare - headGap * (heads - 1)) / rows)
    : 0;

  const caps: {
    keys: KeyAction[];
    cap: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }[] = [];
  const texts: Phaser.GameObjects.BitmapText[] = [];
  let y = TOP;
  entries.forEach((e, i) => {
    if ('head' in e) {
      if (i > 0) y += headGap;
      y = header(scene, items, x, y, e.head);
    } else if ('keys' in e) {
      const mid = Math.round(y + (KEY_ROW + rowPad) / 2 - 2);
      const cap = scene.add
        .rectangle(x, mid, 40, CAP_H, CARD.secondary)
        .setOrigin(0, 0.5)
        .setStrokeStyle(2, 0x58718c);
      const label = pixelText(scene, x + 8, mid + 1, '', BODY, PAL.yellow);
      const desc = pixelText(scene, x, mid + 1, e.text, BODY, PAL.white);
      label.setOrigin(0, 0.5);
      desc.setOrigin(0, 0.5);
      items.push(cap, label, desc);
      caps.push({ keys: e.keys, cap, label });
      texts.push(desc);
      y += KEY_ROW + rowPad;
    } else {
      const note = pixelText(scene, x, y + 2, e.note, BODY, CARD.soft);
      items.push(note);
      texts.push(note);
      y += NOTE_ROW;
    }
  });
  return {
    refresh(bindings) {
      let widest = 0;
      for (const { keys, cap, label } of caps) {
        label.setText(keys.map((k) => keyLabel(bindings[k])).join(' '));
        const w = Math.round(label.displayWidth + 14);
        cap.setSize(w, CAP_H);
        widest = Math.max(widest, w);
      }
      const textX = x + widest + 18;
      for (const text of texts) {
        text.setX(textX).setFontSize(CELL_W * BODY);
        fit(text, x + COL_W - textX);
      }
    },
  };
}

// A section title with a faint underline; returns the next free y.
function header(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  y: number,
  text: string
) {
  items.push(pixelText(scene, x, y, text, HEAD, PAL.orange));
  items.push(
    scene.add
      .rectangle(x, y + 9 * HEAD + 2, 520, PX / 2, PAL.white, 0.15)
      .setOrigin(0)
  );
  return y + HEAD_ROW;
}

// The lines beside a row's icon, centred on it; returns the next free y.
function rowText(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  y: number,
  lines: string[],
  height: number = ROW
) {
  const top = y + height / 2 - 6 - (lines.length * LINE) / 2 + BODY;
  lines.forEach((line, i) =>
    items.push(
      pixelText(scene, x + TEXT_DX, top + i * LINE, line, BODY, PAL.white)
    )
  );
  return y + height;
}

// A button disc as in the HUD: its action's colour and label.
function disc(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  y: number,
  action: string,
  art: number = DISC_ART,
  labelSize: number = BODY
) {
  const key = createButtonTexture(scene, art);
  items.push(
    scene.add
      .image(x, y, key)
      .setScale(DISC_SCALE)
      .setTint(ACTION_COLORS[action] ?? PAL.darkGray)
  );
  items.push(
    pixelText(scene, x, y, action, labelSize, PAL.white).setOrigin(0.5)
  );
}

// The joystick: its ring with the knob pushed right, and an arrow.
function joystickIcon(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  y: number
) {
  const base = scene.add.image(x, y, STICK_BASE);
  base.setScale((DISC_R - 4) / (base.width / 2));
  const knob = scene.add.image(x + 12, y, STICK_KNOB);
  knob.setScale((DISC_R * 0.45) / (knob.width / 2));
  const g = scene.add.graphics().fillStyle(PAL.yellow, 1);
  g.fillTriangle(
    x + DISC_R + 2,
    y - 6,
    x + DISC_R + 2,
    y + 6,
    x + DISC_R + 10,
    y
  );
  items.push(base, knob, g);
}

// The four slide arrows round the SHOOT disc (up, down, left, right).
function swipeArrows(scene: Phaser.Scene, items: Item[], x: number, y: number) {
  const g = scene.add.graphics().fillStyle(PAL.yellow, 0.9);
  const r = DISC_R + 2 * PX;
  const s = 1.25 * PX;
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    const ax = x + dx * r;
    const ay = y + dy * r;
    const px = -dy;
    const py = dx;
    g.fillTriangle(
      ax + dx * s,
      ay + dy * s,
      ax - dx * s + px * s,
      ay - dy * s + py * s,
      ax - dx * s - px * s,
      ay - dy * s - py * s
    );
  }
  items.push(g);
}
