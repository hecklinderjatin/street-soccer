import Phaser from 'phaser';
import { context, exitExpandedMode } from '@devvit/web/client';
import {
  CASUAL_OPTIONS,
  CASUAL_STORAGE_KEY,
  casualConfig,
  cycleOption,
} from '../../shared/casual';
import { formatClock } from '../../shared/matchConfig';
import { DIFFICULTY_LABEL, type FormationName } from '../../shared/types';
import { FORMATIONS, PITCH } from '../../shared/tuning';
import { casualButton, casualScreen } from '../ui/casualScreen';
import { pixelLabel } from '../ui/pixelLabel';

export class CasualScene extends Phaser.Scene {
  constructor() {
    super('Casual');
  }

  create() {
    let config = casualConfig(this.registry.get('casualConfig'));
    try {
      const saved = localStorage.getItem(CASUAL_STORAGE_KEY);
      if (saved) config = casualConfig(JSON.parse(saved));
    } catch {
      /* Storage may be disabled in the Reddit webview. */
    }
    const screen = casualScreen(
      'CASUAL MATCH',
      'Pick your lineup. Set the pace. Own the street.',
      true
    );
    const rows = document.createElement('div');
    rows.className = 'casual-settings';
    screen.panel.append(rows);
    const remember = () => {
      this.registry.set('casualConfig', config);
      try {
        localStorage.setItem(CASUAL_STORAGE_KEY, JSON.stringify(config));
      } catch {
        /* Session registry is the fallback. */
      }
    };
    const selector = <T>(
      label: string,
      choices: readonly T[],
      get: () => T,
      set: (value: T) => void,
      format: (value: T) => string,
      pitch?: HTMLElement
    ) => {
      const row = document.createElement('div');
      row.className = 'casual-setting';
      const name = document.createElement('h2');
      name.textContent = label;
      const controls = document.createElement('div');
      controls.className = 'casual-selector';
      const value = document.createElement('output');
      value.setAttribute('aria-live', 'polite');
      value.setAttribute('aria-label', label);
      const draw = () => pixelLabel(value, format(get()));
      const arrow = (by: number) => {
        const button = casualButton(
          by < 0 ? '<' : '>',
          () => {
            set(cycleOption(choices, get(), by));
            remember();
            draw();
          },
          true
        );
        button.setAttribute(
          'aria-label',
          `${by < 0 ? 'Previous' : 'Next'} ${label.toLowerCase()}`
        );
        return button;
      };
      controls.append(arrow(-1), value, arrow(1));
      row.append(name, controls);
      if (pitch) row.append(pitch);
      rows.append(row);
      draw();
    };
    for (const side of ['home', 'away'] as const) {
      const pitch = document.createElement('div');
      pitch.className = `casual-pitch ${side}`;
      pitch.setAttribute('role', 'img');
      const drawPitch = (formation: FormationName) => {
        pitch.replaceChildren();
        pitch.setAttribute(
          'aria-label',
          `${side === 'home' ? 'Your' : 'Opponent'} ${formation} formation: four outfield players and a goalkeeper`
        );
        const spots = [
          { x: 170, y: PITCH.height / 2 },
          ...FORMATIONS[formation],
        ];
        for (const spot of spots) {
          const dot = document.createElement('i');
          dot.style.left = `${(spot.x / (PITCH.width / 2)) * 90 + 5}%`;
          dot.style.top = `${(spot.y / PITCH.height) * 100}%`;
          pitch.append(dot);
        }
      };
      drawPitch(config[side].formation);
      selector(
        side === 'home' ? 'Your formation' : 'Opponent formation',
        CASUAL_OPTIONS.formations,
        () => config[side].formation,
        (value) => {
          config = { ...config, [side]: { ...config[side], formation: value } };
          drawPitch(value);
        },
        (value) => value,
        pitch
      );
    }
    selector(
      'Difficulty',
      CASUAL_OPTIONS.difficulties,
      () => config.difficulty,
      (value) => {
        config = { ...config, difficulty: value };
      },
      (value) => DIFFICULTY_LABEL[value]
    );
    selector(
      'Match time',
      CASUAL_OPTIONS.durations,
      () => config.durationSec,
      (value) => {
        config = { ...config, durationSec: value };
      },
      formatClock
    );
    const note = document.createElement('p');
    note.className = 'casual-note';
    note.textContent = '0–0 KICKOFF · UNRANKED · ALL OPTIONS FREE';
    const actions = document.createElement('div');
    actions.className = 'casual-actions';
    actions.append(
      casualButton('START MATCH', () => {
        remember();
        if (this.registry.get('casualHelpShown') !== true) {
          this.registry.set('helpAtStart', true);
          this.registry.set('casualHelpShown', true);
        }
        this.scene.start('Match', config);
      }),
      casualButton(
        'BACK',
        (event) => {
          if (context?.postId) exitExpandedMode(event);
          else this.scene.start('Menu');
        },
        true
      )
    );
    screen.panel.append(note, actions);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => screen.destroy());
  }
}
