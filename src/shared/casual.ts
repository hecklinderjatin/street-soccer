import {
  DEFAULT_MATCH_CONFIG,
  DURATION_CHOICES,
  parseMatchConfig,
} from './matchConfig';
import { DIFFICULTIES, FORMATION_NAMES, type MatchConfig } from './types';

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
    home: { ...DEFAULT_MATCH_CONFIG.home, formation: base.home.formation },
    away: { ...DEFAULT_MATCH_CONFIG.away, formation: base.away.formation },
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
};
