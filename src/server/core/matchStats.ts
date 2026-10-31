import { withoutDailyMode } from '../../shared/dailyMode';
import {
  challengeCleared,
  parseDailyMode,
  survivalLimits,
} from '../../shared/dailyMode';
import { postType } from '../../shared/postType';
import type { MatchStats } from '../../shared/api';
import { parseMatchConfig } from '../../shared/matchConfig';
import { GOAL_FEEDBACK, MATCH, DAILY, CUSTOM_MATCH } from '../../shared/tuning';
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
  (config?.durationSec ?? MATCH.durationSec) +
  (config?.dailyMode ? 0 : MATCH.goldenGoalSec);

// The post's locked match, if it has one (its postData).
export function postConfig(postData: unknown): MatchConfig | null {
  if (typeof postData !== 'object' || postData === null) return null;
  const config = parseMatchConfig(Reflect.get(postData, 'match'));
  if (typeof config === 'string' || !config.locked) return null;
  return postType(postData) === 'daily' ? config : withoutDailyMode(config);
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
  config: MatchConfig | null,
  trustedSaved = false
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
  if (
    config &&
    (goalsAgainst < config.startGoalsAgainst ||
      goalsFor < (config.startGoalsFor ?? 0))
  )
    return 'Invalid result';
  const maxGoals = trustedSaved
    ? MAX_GOALS
    : Math.ceil(matchLengthSec(config) / MIN_SEC_PER_GOAL);
  if (
    goalsFor > maxGoals + (config?.startGoalsFor ?? 0) ||
    goalsAgainst > maxGoals + (config?.startGoalsAgainst ?? 0)
  )
    return 'Invalid result';
  const dailyMode =
    config?.dailyMode ??
    (trustedSaved ? parseDailyMode(Reflect.get(body, 'dailyMode')) : undefined);
  const goals = config
    ? survivalLimits(config).goals
    : count(
        Reflect.get(body, 'survivalGoals') ?? DAILY.survivalGoals,
        DAILY.maxSurvivalGoals
      );
  const conceded = config
    ? survivalLimits(config).conceded
    : count(
        Reflect.get(body, 'survivalConceded') ?? DAILY.survivalConceded,
        DAILY.maxSurvivalConceded
      );
  if (
    dailyMode === 'survival' &&
    (goals === null || goals < 1 || conceded === null || conceded < 1)
  )
    return 'Invalid Rampage limits';
  const goalLimit = goals ?? DAILY.survivalGoals,
    concedeLimit = conceded ?? DAILY.survivalConceded;
  const elapsedSec = dailyMode
    ? count(
        Reflect.get(body, 'elapsedSec'),
        config?.durationSec ?? CUSTOM_MATCH.maxDurationSec
      )
    : undefined;
  if (
    dailyMode &&
    (elapsedSec === null || elapsedSec === undefined || elapsedSec < 1)
  )
    return 'Invalid challenge time';
  if (dailyMode === 'survival') {
    if (
      goalsFor > goalLimit ||
      goalsAgainst > concedeLimit ||
      (goalsFor === goalLimit && goalsAgainst === concedeLimit)
    )
      return 'Invalid Rampage result';
    if (
      config &&
      goalsFor < goalLimit &&
      goalsAgainst < concedeLimit &&
      (elapsedSec ?? 0) < config.durationSec - 1
    )
      return 'Rampage must finish at a goal limit or the whistle';
  } else if (dailyMode && config && (elapsedSec ?? 0) < config.durationSec - 1)
    return 'Challenge must reach the whistle';
  const rawSpeed = Reflect.get(body, 'fastestGoalKmh');
  const fastestGoalKmh =
    rawSpeed === undefined ? undefined : count(rawSpeed, GOAL_FEEDBACK.maxKmh);
  if (
    fastestGoalKmh === null ||
    (fastestGoalKmh &&
      (goalsFor - (config?.startGoalsFor ?? 0) < 1 || shots < 1))
  )
    return 'Invalid goal speed';
  const difficulty = config ? config.difficulty : asked;
  return {
    ...(dailyMode === 'survival'
      ? { survivalGoals: goalLimit, survivalConceded: concedeLimit }
      : {}),
    ...(dailyMode
      ? {
          dailyMode,
          elapsedSec: elapsedSec ?? 0,
          cleared: challengeCleared(
            dailyMode,
            goalsFor,
            goalsAgainst,
            goalLimit,
            concedeLimit
          ),
        }
      : {}),
    difficulty,
    goalsFor,
    goalsAgainst,
    shots,
    passes,
    tacklesWon,
    ...(fastestGoalKmh === undefined ? {} : { fastestGoalKmh }),
  };
}
