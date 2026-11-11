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
  'chaos',
  'freekick-challenge',
  'freekick-practice',
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
  level?: number;
  goalTarget?: number;
  lives?: number;
};
export type JourneyResult = {
  mode?: 'freekick-challenge' | 'freekick-practice';
  points?: number;
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
          : config.dailyMode === 'chaos'
            ? 'chaos'
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
    (!mode.startsWith('freekick-') && durationSec < 30) ||
    typeof rematch !== 'boolean'
  )
    return null;
  if (mode === 'freekick-challenge' || mode === 'freekick-practice') {
    const level: unknown = Reflect.get(body, 'level'),
      goalTarget: unknown = Reflect.get(body, 'goalTarget'),
      lives: unknown = Reflect.get(body, 'lives');
    if (
      difficulty === 'rising' ||
      durationSec !== 0 ||
      typeof level !== 'number' ||
      !integer(level, 10) ||
      level < 1 ||
      typeof goalTarget !== 'number' ||
      !integer(goalTarget, 20) ||
      typeof lives !== 'number' ||
      !integer(lives, 10) ||
      (mode === 'freekick-challenge'
        ? goalTarget < 1 || lives < 1
        : goalTarget !== 0 || lives !== 0)
    )
      return null;
    return { mode, difficulty, durationSec, rematch, level, goalTarget, lives };
  }
  return { mode, difficulty, durationSec, rematch };
}
export function readJourneyResult(body: unknown): JourneyResult | null {
  if (!body || typeof body !== 'object') return null;
  const mode: unknown = Reflect.get(body, 'mode');
  const freeKick =
    mode === 'freekick-challenge' || mode === 'freekick-practice';
  if (mode !== undefined && !freeKick) return null;
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
    !integer(goalsFor, freeKick ? 100_000 : 99) ||
    !integer(goalsAgainst, freeKick ? 100_000 : 99) ||
    !integer(elapsedSec, freeKick ? 86_400 : 330)
  )
    return null;
  if (mode === 'freekick-challenge' || mode === 'freekick-practice') {
    const points: unknown = Reflect.get(body, 'points');
    if (
      typeof points !== 'number' ||
      !integer(points, 60_000_000) ||
      (mode === 'freekick-practice'
        ? outcome !== 'quit'
        : !['cleared', 'failed', 'quit'].includes(outcome))
    )
      return null;
    return { mode, points, outcome, goalsFor, goalsAgainst, elapsedSec };
  }
  return { outcome, goalsFor, goalsAgainst, elapsedSec };
}
export const readJourneyId = (value: unknown) =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,256}$/.test(value)
    ? value
    : null;
