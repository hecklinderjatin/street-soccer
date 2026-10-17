import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import { VIEW } from '../../shared/tuning';
import { STICK_BASE, STICK_KNOB, createButtonTexture } from '../art/playerArt';
import { ACTION_COLORS } from './ActionButtons';
import { PAL, PX } from './palette';
import { pixelText } from './pixelFont';
import { TextButton } from './TextButton';

// The "how to play" panel behind the HUD's i button: every control, each
// shown with the game's own icons (the joystick ring, the coloured button
// discs with their labels, the shot swipe arrows) and a line or two on what
// it does, plus the keyboard keys. Built hidden; HudScene shows it (and
// pauses the match) and hides it again.

const DISC_ART = 18; // button disc texture radius (art px), drawn at x2: crisp
const DISC_SCALE = 2;
const DISC_R = DISC_ART * DISC_SCALE; // 36 screen px
const SMALL_ART = 13; // THROW / KICK side by side
const BODY = 0.5 * PX; // body text: 2 screen px per font pixel (crisp)
const HEAD = 0.75 * PX;
const LINE = 11 * BODY; // body line height (9 px cell + 2 px line spacing)
const ROW = 2 * DISC_R + 10; // a row with an icon
const HEAD_ROW = 40;
const TEXT_DX = 2 * DISC_R + 24; // text starts this far right of the column

type Item = Phaser.GameObjects.GameObject;

export function buildHelpLayer(
  scene: Phaser.Scene,
  onClose: () => void
): Phaser.GameObjects.Container {
  const items: Item[] = [];
  const cx = VIEW.width / 2;

  // Dim the match and swallow taps behind the panel.
  items.push(
    scene.add
      .rectangle(0, 0, VIEW.width, VIEW.height, PAL.black, 0.7)
      .setOrigin(0)
      .setInteractive()
  );
  const panel = scene.add.graphics();
  panel.fillStyle(PAL.black, 1).fillRect(36, 20, VIEW.width - 72, 688);
  panel.fillStyle(PAL.ink, 0.97).fillRect(40, 24, VIEW.width - 80, 680);
  panel.fillStyle(PAL.white, 0.12).fillRect(40, 24, VIEW.width - 80, PX);
  items.push(panel);
  items.push(
    pixelText(scene, cx, 62, 'HOW TO PLAY', PX, PAL.yellow).setOrigin(0.5)
  );

  // --- Left column: moving, the ball, keyboard ---
  const left = 80;
  let y = 104;
  y = header(scene, items, left, y, 'MOVE');
  joystickIcon(scene, items, left + DISC_R, y + DISC_R);
  y = rowText(scene, items, left, y, [
    'DRAG ON THE LEFT HALF',
    'PUSH TO THE EDGE: SPRINT',
  ]);
  y = header(scene, items, left, y, 'WITH THE BALL');
  disc(scene, items, left + DISC_R, y + DISC_R, 'PASS');
  y = rowText(scene, items, left, y, [
    'TAP: PASS TO THE RINGED MATE',
    'HOLD: WEIGHTED PASS',
  ]);
  disc(scene, items, left + DISC_R, y + DISC_R + 8, 'SHOOT');
  swipeArrows(scene, items, left + DISC_R, y + DISC_R + 8);
  y = rowText(
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
    ROW + 24
  );
  y = header(scene, items, left, y, 'KEYBOARD');
  for (const line of [
    'WASD / ARROWS: MOVE  SHIFT: SPRINT',
    'J: LEFT BUTTON  K: RIGHT BUTTON',
    'T G F H: SHOOT + SWIPE',
    'ESC: PAUSE  I: THIS HELP',
  ]) {
    items.push(pixelText(scene, left, y, line, BODY, PAL.lightGray));
    y += LINE;
  }

  // --- Right column: without the ball, the goalkeeper ---
  const right = cx + 40;
  y = 104;
  y = header(scene, items, right, y, 'WITHOUT THE BALL');
  disc(scene, items, right + DISC_R, y + DISC_R, 'TACKLE');
  y = rowText(scene, items, right, y, [
    'LUNGE AT THE BALL CARRIER',
    'CUT SHARPLY TO DODGE ONE',
  ]);
  disc(scene, items, right + DISC_R, y + DISC_R, 'SWITCH');
  y = rowText(scene, items, right, y, [
    'TAP: CHANGE PLAYER',
    'HOLD: JUMP TO YOUR KEEPER',
  ]);
  y = header(scene, items, right, y, 'GOALKEEPER');
  disc(scene, items, right + DISC_R, y + DISC_R, 'DIVE');
  y = rowText(scene, items, right, y, [
    'WITH THE STICK: DIVE THAT WAY',
    'STICK CENTRED: SAVE OR JUMP',
  ]);
  const small = SMALL_ART * DISC_SCALE;
  disc(scene, items, right + small, y + DISC_R, 'THROW', SMALL_ART, 0.3 * PX);
  disc(
    scene,
    items,
    right + 3 * small + 4,
    y + DISC_R,
    'KICK',
    SMALL_ART,
    0.3 * PX
  );
  // (the text starts after both discs)
  rowText(scene, items, right + 4 * small + 20 - TEXT_DX, y, [
    'BALL IN HANDS:',
    'THROW TO THE RINGED MATE',
    'KICK: HOLD + SLIDE AS SHOOT',
  ]);

  // Devvit Rules: players need a way to report problems with the app.
  const where = context?.subredditName
    ? `MESSAGE THE MODS OF R/${context.subredditName}`
    : 'MESSAGE THE MODS OF THIS SUBREDDIT';
  items.push(
    pixelText(
      scene,
      cx,
      600,
      `REPORT A PROBLEM: ${where}`,
      BODY,
      PAL.lightGray
    ).setOrigin(0.5)
  );

  items.push(
    new TextButton(scene, cx, 650, 'GOT IT', onClose, {
      width: 280,
      height: 64,
      fill: PAL.green,
    })
  );
  return scene.add.container(0, 0, items).setDepth(10);
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
  labelSize: number = 0.4 * PX
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
  const r = DISC_R + 3 * PX;
  const s = 1.5 * PX;
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
