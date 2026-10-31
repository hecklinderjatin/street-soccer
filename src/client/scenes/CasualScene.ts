import { journeyAppReady } from '../journeys';
import Phaser from 'phaser';
import { context, exitExpandedMode } from '@devvit/web/client';
import {
  CASUAL_OPTIONS,
  CASUAL_STORAGE_KEY,
  casualConfig,
  cycleOption,
  setCasualJersey,
} from '../../shared/casual';
import { formatClock } from '../../shared/matchConfig';
import { DIFFICULTY_LABEL } from '../../shared/types';
import { casualButton, casualScreen } from '../ui/casualScreen';
import { pixelLabel } from '../ui/pixelLabel';
import { css } from '../ui/menuCard';
import { JERSEY_SWATCH } from '../ui/palette';

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
      /* The session registry still works when storage is disabled. */
    }
    const screen = casualScreen(
      'CASUAL MATCH',
      'Pick your colours. Set your shape. Play.',
      true
    );
    const rows = document.createElement('div');
    rows.className = 'casual-settings';
    screen.panel.append(rows);
    const renderers: (() => void)[] = [];
    const remember = () => {
      this.registry.set('casualConfig', config);
      try {
        localStorage.setItem(CASUAL_STORAGE_KEY, JSON.stringify(config));
      } catch {
        /* Session-only preferences. */
      }
    };
    const selector = <T>(
      parent: HTMLElement,
      label: string,
      caption: string,
      choices: readonly T[],
      get: () => T,
      set: (value: T) => void,
      format: (value: T) => string,
      colour = false
    ) => {
      const row = document.createElement('div');
      row.className = 'casual-setting';
      const name = document.createElement('h2');
      name.textContent = caption;
      const controls = document.createElement('div');
      controls.className = 'casual-selector';
      const value = document.createElement('output');
      value.setAttribute('aria-live', 'polite');
      value.setAttribute('aria-label', label);
      if (colour) value.className = 'casual-colour-value';
      const draw = () => pixelLabel(value, format(get()));
      renderers.push(draw);
      const arrow = (by: number) => {
        const button = casualButton(
          by < 0 ? '<' : '>',
          () => {
            set(cycleOption(choices, get(), by));
            remember();
            renderers.forEach((render) => render());
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
      parent.append(row);
    };
    for (const side of ['home', 'away'] as const) {
      const team = document.createElement('div');
      team.className = `casual-team-card ${side}`;
      team.setAttribute('role', 'group');
      team.setAttribute(
        'aria-label',
        side === 'home' ? 'Your team' : 'Opponent team'
      );
      rows.append(team);
      renderers.push(() =>
        team.style.setProperty(
          '--team-colour',
          css(JERSEY_SWATCH[config[side].jersey])
        )
      );
      selector(
        team,
        side === 'home' ? 'Your colour' : 'Opponent colour',
        side === 'home' ? 'YOUR KIT' : 'CPU KIT',
        CASUAL_OPTIONS.jerseys,
        () => config[side].jersey,
        (jersey) => {
          config = setCasualJersey(config, side, jersey);
        },
        (value) => value.toUpperCase(),
        true
      );
      selector(
        team,
        side === 'home' ? 'Your formation' : 'Opponent formation',
        side === 'home' ? 'YOUR SHAPE' : 'CPU SHAPE',
        CASUAL_OPTIONS.formations,
        () => config[side].formation,
        (formation) => {
          config = { ...config, [side]: { ...config[side], formation } };
        },
        (value) => value
      );
    }
    selector(
      rows,
      'Difficulty',
      'AI LEVEL',
      CASUAL_OPTIONS.difficulties,
      () => config.difficulty,
      (difficulty) => {
        config = { ...config, difficulty };
      },
      (value) => DIFFICULTY_LABEL[value]
    );
    selector(
      rows,
      'Match time',
      'TIME',
      CASUAL_OPTIONS.durations,
      () => config.durationSec,
      (durationSec) => {
        config = { ...config, durationSec };
      },
      formatClock
    );
    renderers.forEach((render) => render());
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
    journeyAppReady();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => screen.destroy());
  }
}
