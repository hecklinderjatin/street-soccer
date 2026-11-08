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
      604,
      'DELETE SAVED SCORES: SUBREDDIT MENU > DELETE MY STREET SOCCER DATA',
      BODY,
      CARD.soft
    ).setOrigin(0.5),
    pixelText(
      scene,
      cx,
      624,
      `REPORT A PROBLEM: ${where}`,
      BODY,
      CARD.soft
    ).setOrigin(0.5)
  );

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
  disc(scene, items, left + DISC_R, y + passRow / 2, 'PASS');
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
    'LUNGE AT THE BALL CARRIER',
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
const KEY_ROW = 30; // a row with a key cap
const NOTE_ROW = 24; // a muted note under a row
const DESC_DX = 150; // descriptions start this far right of the column
const COL_W = 520;

type KeyCap = { refresh: (bindings: Readonly<KeyBindings>) => void };

function keyboardColumns(
  scene: Phaser.Scene,
  items: Item[],
  left: number,
  right: number
) {
  const caps: KeyCap[] = [];
  let x = left;
  let y = TOP;
  const head = (text: string) => (y = header(scene, items, x, y, text));
  const key = (keys: KeyAction[], text: string) => {
    caps.push(keyRow(scene, items, x, y + KEY_ROW / 2 - 2, keys, text));
    y += KEY_ROW;
  };
  const note = (text: string) => {
    items.push(
      fit(
        pixelText(scene, x + DESC_DX, y + 2, text, BODY, CARD.soft),
        COL_W - DESC_DX
      )
    );
    y += NOTE_ROW;
  };

  head('MOVE');
  key(['forward', 'left', 'backward', 'right'], 'MOVE');
  key(['sprint'], 'HOLD TO SPRINT');
  head('PASS');
  key(['pass'], 'GROUND PASS');
  note('HOLD TO SET THE PACE');
  key(['lob'], 'AIR PASS: OVER DEFENDERS');
  key(['passLeft', 'passRight'], 'CURL PASS LEFT / RIGHT');
  note('HOLD PAST HALF: AIR CURL');
  note('TAP: CURL ALONG THE GROUND');
  head('SHOOT (HOLD + RELEASE)');
  key(['chip'], 'CHIP SHOT');
  key(['shotLeft', 'shotRight'], 'CURL SHOT LEFT / RIGHT');
  key(['power'], 'POWER SHOT');
  note('GREEN ON RELEASE: PERFECT');

  x = right;
  y = TOP;
  head('WITHOUT THE BALL');
  key(['pass'], 'TACKLE');
  key(['power'], 'SWITCH PLAYER');
  head('GOALKEEPER');
  key(['pass'], 'DIVE: AIM WITH MOVE KEYS');
  key(['pass'], 'BALL IN HANDS: THROW');
  key(['power'], 'BALL IN HANDS: KICK');
  note('SHOT KEYS SHAPE THE KICK');
  head('MATCH');
  key(['pause'], 'PAUSE');
  key(['info'], 'MATCH INFO');
  key(['mute'], 'SOUND ON / OFF');
  note('REMAP: CONTROLS ON PAGE 1');
  return caps;
}

// One key cap (navy, like a secondary button) and its description, centred
// on y. The cap's label and width follow the current bindings.
function keyRow(
  scene: Phaser.Scene,
  items: Item[],
  x: number,
  y: number,
  keys: KeyAction[],
  text: string
): KeyCap {
  const cap = scene.add
    .rectangle(x, y, 40, 24, CARD.secondary)
    .setOrigin(0, 0.5)
    .setStrokeStyle(2, 0x58718c);
  const label = pixelText(scene, x + 8, y + 1, '', BODY, PAL.yellow).setOrigin(
    0,
    0.5
  );
  const desc = pixelText(scene, x + DESC_DX, y + 1, text, BODY, PAL.white);
  desc.setOrigin(0, 0.5);
  items.push(cap, label, desc);
  return {
    refresh(bindings) {
      label.setText(keys.map((k) => keyLabel(bindings[k])).join(' '));
      const w = label.displayWidth + 14;
      cap.setSize(w, 24);
      // A long remapped label pushes its description along.
      desc.setX(Math.max(x + DESC_DX, x + w + 12)).setFontSize(CELL_W * BODY);
      fit(desc, x + COL_W - desc.x);
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
