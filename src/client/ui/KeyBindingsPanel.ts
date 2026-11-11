import type Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import type { Controls } from '../systems/Controls';
import {
  actionForKey,
  DEFAULT_KEYS,
  isBindableKey,
  KEY_ACTIONS,
  keyCode,
  keyLabel,
  saveKeyBindings,
  type KeyAction,
  type KeyBindings,
} from '../systems/keyBindings';
import { PAL, PX } from './palette';
import { pixelText } from './pixelFont';
import { TextButton } from './TextButton';

const LABELS: Record<KeyAction, string> = {
  forward: 'MOVE FORWARD',
  left: 'MOVE LEFT',
  right: 'MOVE RIGHT',
  backward: 'MOVE BACKWARD',
  sprint: 'SPRINT',
  chip: 'CHIP SHOT',
  shotLeft: 'LEFT CURL SHOT',
  shotRight: 'RIGHT CURL SHOT',
  power: 'POWER SHOT / SWITCH',
  pass: 'PASS / TACKLE',
  lob: 'AIR PASS',
  passLeft: 'LEFT CURL PASS',
  passRight: 'RIGHT CURL PASS',
  pause: 'PAUSE',
  info: 'MATCH INFO',
  mute: 'MUTE',
};
const PROMPT = 'SELECT AN ACTION, THEN PRESS A KEY';

export class KeyBindingsPanel {
  readonly layer: Phaser.GameObjects.Container;
  private readonly status: Phaser.GameObjects.BitmapText;
  private readonly buttons = new Map<KeyAction, TextButton>();
  private selected: KeyAction | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly controls: Controls,
    onBack: () => void
  ) {
    const cx = VIEW.width / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      scene.add
        .rectangle(0, 0, VIEW.width, VIEW.height, PAL.black, 0.7)
        .setOrigin(0)
        .setInteractive(),
      scene.add.rectangle(cx, 360, 1160, 650, PAL.ink),
      pixelText(scene, cx, 84, 'KEY BINDINGS', PX, PAL.yellow).setOrigin(0.5),
    ];
    this.status = pixelText(
      scene,
      cx,
      125,
      PROMPT,
      PX / 2,
      PAL.white
    ).setOrigin(0.5);
    items.push(this.status);

    KEY_ACTIONS.forEach((action, i) => {
      const x = i < 9 ? 124 : 695;
      const y = 172 + (i < 9 ? i : i - 9) * 49;
      items.push(
        pixelText(scene, x, y, LABELS[action], PX / 2).setOrigin(0, 0.5)
      );
      const button = new TextButton(
        scene,
        x + 350,
        y,
        '',
        () => {
          this.selected = this.selected === action ? null : action;
          this.status.setText(
            this.selected ? `PRESS A KEY FOR ${LABELS[action]}` : PROMPT
          );
          this.refresh();
        },
        { width: 164, height: 40, textSize: PX / 2, fill: PAL.blue }
      );
      this.buttons.set(action, button);
      items.push(button);
    });
    items.push(
      pixelText(scene, 695, 494, 'TACTICS - TOP NUMBER ROW', 2, PAL.yellow),
      pixelText(scene, 695, 518, '8  DEFEND: DROP THE TEAM BACK', 2, PAL.white),
      pixelText(
        scene,
        695,
        542,
        '9  NORMAL: DEFAULT POSITIONING',
        2,
        PAL.white
      ),
      pixelText(
        scene,
        695,
        566,
        '0  ATTACK: BACK LINE TO HALFWAY',
        2,
        PAL.white
      ),
      pixelText(
        scene,
        695,
        590,
        'FIXED SHORTCUTS; NOT THE NUMPAD',
        2,
        PAL.lightGray
      )
    );
    items.push(
      new TextButton(
        scene,
        cx - 180,
        635,
        'RESET DEFAULTS',
        () => {
          this.apply(DEFAULT_KEYS, 'DEFAULTS RESTORED');
        },
        { width: 340, height: 56, textSize: PX * 0.75, fill: PAL.orange }
      ),
      new TextButton(scene, cx + 175, 635, 'BACK', onBack, {
        width: 220,
        height: 56,
        textSize: PX * 0.75,
        fill: PAL.darkGray,
      })
    );
    this.layer = scene.add
      .container(0, 0, items)
      .setDepth(10)
      .setVisible(false);
    this.refresh();
  }

  setVisible(visible: boolean) {
    this.selected = null;
    this.status.setText(PROMPT);
    this.refresh();
    this.layer.setVisible(visible);
  }

  capture(code: string) {
    const action = this.selected;
    if (!this.layer.visible || !action) return false;
    const key = keyCode(code);
    if (['Digit8', 'Digit9', 'Digit0'].includes(key)) {
      this.status.setText('TOP ROW 8 / 9 / 0 ARE RESERVED FOR TACTICS');
      return true;
    }
    if (!isBindableKey(key)) {
      this.status.setText('CHOOSE A LETTER, NUMBER, ARROW OR GAME KEY');
      return true;
    }
    const conflict = actionForKey(this.controls.keyBindings, key);
    if (conflict && conflict !== action) {
      this.status.setText(`${keyLabel(key)} IS USED FOR ${LABELS[conflict]}`);
      return true;
    }
    this.apply(
      { ...this.controls.keyBindings, [action]: key },
      'SAVED ON THIS BROWSER'
    );
    return true;
  }

  private apply(bindings: Readonly<KeyBindings>, message: string) {
    this.selected = null;
    this.controls.setKeyBindings(bindings);
    const saved = saveKeyBindings(bindings);
    this.status.setText(
      saved ? message : 'APPLIED FOR THIS MATCH. BROWSER COULD NOT SAVE.'
    );
    this.refresh();
  }

  private refresh() {
    for (const [action, button] of this.buttons) {
      const selected = this.selected === action;
      button.setLabel(
        selected ? 'PRESS KEY' : keyLabel(this.controls.keyBindings[action])
      );
      button.setFill(selected ? PAL.orange : PAL.blue);
    }
  }
}
