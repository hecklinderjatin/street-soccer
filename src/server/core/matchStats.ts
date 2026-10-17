import type { MatchStats } from '../../shared/api';
import { parseMatchConfig } from '../../shared/matchConfig';
import { MATCH } from '../../shared/tuning';
import { DIFFICULTIES, type MatchConfig } from '../../shared/types';

// Checking a match result a client reports (pure: no Redis, so the logic
// checks can run it).

const MAX_GOALS = 99; // more than any real match; anything over is rejected
const MAX_COUNT = 999; // shots / passes / tackles
// A goal takes at least this much match clock (kickoff, build-up, shot):
// more goals than the match length allows are rejected as made up.
const MIN_SEC_PER_GOAL = 4;

// The longest a match on this post can run (regular time plus golden goal).
export const matchLengthSec = (config: MatchConfig | null) =>
  (config?.durationSec ?? MATCH.durationSec) + MATCH.goldenGoalSec;

// The post's locked match, if it has one (its postData).
export function postConfig(postData: unknown): MatchConfig | null {
  if (typeof postData !== 'object' || postData === null) return null;
  const config = parseMatchConfig(Reflect.get(postData, 'match'));
  return typeof config === 'string' || !config.locked ? null : config;
}

const count = (value: unknown, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max
    ? value
    : null;

// A reported match, checked: whole numbers in range, and on a locked post
// the post's difficulty and at least its head-start goals against.
export function readStats(
  body: unknown,
  config: MatchConfig | null
): MatchStats | string {
  if (typeof body !== 'object' || body === null) return 'Invalid result';
  const goalsFor = count(Reflect.get(body, 'goalsFor'), MAX_GOALS);
  const goalsAgainst = count(Reflect.get(body, 'goalsAgainst'), MAX_GOALS);
  const shots = count(Reflect.get(body, 'shots'), MAX_COUNT);
  const passes = count(Reflect.get(body, 'passes'), MAX_COUNT);
  const tacklesWon = count(Reflect.get(body, 'tacklesWon'), MAX_COUNT);
  const asked = DIFFICULTIES.find((d) => d === Reflect.get(body, 'difficulty'));
  if (
    goalsFor === null ||
    goalsAgainst === null ||
    shots === null ||
    passes === null ||
    tacklesWon === null ||
    !asked
  )
    return 'Invalid result';
  if (config && goalsAgainst < config.startGoalsAgainst)
    return 'Invalid result';
  const maxGoals = Math.ceil(matchLengthSec(config) / MIN_SEC_PER_GOAL);
  if (
    goalsFor > maxGoals ||
    goalsAgainst > maxGoals + (config?.startGoalsAgainst ?? 0)
  )
    return 'Invalid result';
  const difficulty = config ? config.difficulty : asked;
  return { difficulty, goalsFor, goalsAgainst, shots, passes, tacklesWon };
}
