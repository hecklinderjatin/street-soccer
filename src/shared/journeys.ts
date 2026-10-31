import type { MatchConfig } from './types';
import { DIFFICULTIES } from './types';
import type { PostType } from './postType';
import { challengeCleared, survivalLimits } from './dailyMode';

// Defined identically in client/server builds. Reddit still gates ingestion.
declare const __JOURNEYS_ENABLED__: boolean;
export const journeysEnabled =
  typeof __JOURNEYS_ENABLED__ !== 'undefined' && __JOURNEYS_ENABLED__;
export const JOURNEY_MODES = [
  'classic',
  'daily',
  'casual',
  'comeback',
  'shield',
  'rampage',
] as const;
export const JOURNEY_OUTCOMES = [
  'win',
  'loss',
  'draw',
  'cleared',
  'failed',
  'quit',
] as const;
export type JourneySettings = {
  mode: (typeof JOURNEY_MODES)[number];
  difficulty: MatchConfig['difficulty'] | 'rising';
  durationSec: number;
  rematch: boolean;
};
export type JourneyResult = {
  outcome: (typeof JOURNEY_OUTCOMES)[number];
  goalsFor: number;
  goalsAgainst: number;
  elapsedSec: number;
};
export function journeySettings(
  config: MatchConfig,
  post: PostType,
  rematch: boolean
): JourneySettings {
  const mode =
    config.mode === 'casual'
      ? 'casual'
      : config.dailyMode === 'hold-lead'
        ? 'shield'
        : config.dailyMode === 'survival'
          ? 'rampage'
          : config.dailyMode === 'comeback'
            ? 'comeback'
            : post === 'daily'
              ? 'daily'
              : 'classic';
  return {
    mode,
    difficulty: mode === 'rampage' ? 'rising' : config.difficulty,
    durationSec: config.durationSec,
    rematch,
  };
}
export function journeyResult(
  config: MatchConfig,
  home: number,
  away: number,
  elapsed: number,
  quit = false
): JourneyResult {
  const limits = survivalLimits(config);
  const outcome = quit
    ? 'quit'
    : config.dailyMode
      ? challengeCleared(
          config.dailyMode,
          home,
          away,
          limits.goals,
          limits.conceded
        )
        ? 'cleared'
        : 'failed'
      : home > away
        ? 'win'
        : home < away
          ? 'loss'
          : 'draw';
  return {
    outcome,
    goalsFor: home,
    goalsAgainst: away,
    elapsedSec: Math.ceil(elapsed),
  };
}
const integer = (value: unknown, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max;
// Rebuild an allowlisted DTO. Never forward client JSON, team names or free text.
export function readJourneySettings(body: unknown): JourneySettings | null {
  if (!body || typeof body !== 'object') return null;
  const mode = JOURNEY_MODES.find((v) => v === Reflect.get(body, 'mode'));
  const difficulty = [...DIFFICULTIES, 'rising' as const].find(
    (v) => v === Reflect.get(body, 'difficulty')
  );
  const durationSec: unknown = Reflect.get(body, 'durationSec');
  const rematch: unknown = Reflect.get(body, 'rematch');
  if (
    !mode ||
    !difficulty ||
    !integer(durationSec, 300) ||
    typeof durationSec !== 'number' ||
    durationSec < 30 ||
    typeof rematch !== 'boolean'
  )
    return null;
  return { mode, difficulty, durationSec, rematch };
}
export function readJourneyResult(body: unknown): JourneyResult | null {
  if (!body || typeof body !== 'object') return null;
  const outcome = JOURNEY_OUTCOMES.find(
    (v) => v === Reflect.get(body, 'outcome')
  );
  const goalsFor: unknown = Reflect.get(body, 'goalsFor'),
    goalsAgainst: unknown = Reflect.get(body, 'goalsAgainst'),
    elapsedSec: unknown = Reflect.get(body, 'elapsedSec');
  if (
    !outcome ||
    typeof goalsFor !== 'number' ||
    typeof goalsAgainst !== 'number' ||
    typeof elapsedSec !== 'number' ||
    !integer(goalsFor, 99) ||
    !integer(goalsAgainst, 99) ||
    !integer(elapsedSec, 330)
  )
    return null;
  return { outcome, goalsFor, goalsAgainst, elapsedSec };
}
export const readJourneyId = (value: unknown) =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,256}$/.test(value)
    ? value
    : null;
