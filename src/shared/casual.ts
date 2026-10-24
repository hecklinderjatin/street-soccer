import {
  DEFAULT_MATCH_CONFIG,
  DURATION_CHOICES,
  parseMatchConfig,
} from './matchConfig';
import {
  DIFFICULTIES,
  FORMATION_NAMES,
  JERSEY_COLORS,
  type MatchConfig,
  type JerseyColor,
} from './types';

export const CASUAL_STORAGE_KEY = 'street-soccer:casual:v1';

export function casualConfig(value?: unknown): MatchConfig {
  const parsed = parseMatchConfig(value);
  const base = typeof parsed === 'string' ? DEFAULT_MATCH_CONFIG : parsed;
  return {
    ...DEFAULT_MATCH_CONFIG,
    mode: 'casual',
    locked: false,
    startGoalsAgainst: 0,
    difficulty: base.difficulty,
    durationSec: DURATION_CHOICES.includes(base.durationSec)
      ? base.durationSec
      : DEFAULT_MATCH_CONFIG.durationSec,
    home: {
      ...DEFAULT_MATCH_CONFIG.home,
      formation: base.home.formation,
      jersey: base.home.jersey,
    },
    away: {
      ...DEFAULT_MATCH_CONFIG.away,
      formation: base.away.formation,
      jersey: base.away.jersey,
    },
  };
}

export function cycleOption<T>(
  choices: readonly T[],
  current: T,
  by: number
): T {
  return (
    choices[
      (Math.max(0, choices.indexOf(current)) + by + choices.length) %
        choices.length
    ] ?? current
  );
}

export const CASUAL_OPTIONS = {
  formations: FORMATION_NAMES,
  difficulties: DIFFICULTIES,
  durations: DURATION_CHOICES,
  jerseys: JERSEY_COLORS,
};

// Keep both kits distinct. If one side takes the other colour, swap kits
// so a single arrow press always produces a playable, readable pairing.
export function setCasualJersey(
  config: MatchConfig,
  side: 'home' | 'away',
  jersey: JerseyColor
): MatchConfig {
  const other = side === 'home' ? 'away' : 'home';
  return {
    ...config,
    [side]: { ...config[side], jersey },
    [other]: {
      ...config[other],
      jersey:
        config[other].jersey === jersey
          ? config[side].jersey
          : config[other].jersey,
    },
  };
}
