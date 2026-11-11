import {
  endlessFreeKick,
  type FreeKickChallengeConfig,
} from './freeKickChallenge';
import type { JourneySettings, JourneyResult } from './journeys';

export function freeKickJourneySettings(
  config: FreeKickChallengeConfig,
  practice: boolean,
  level: number,
  rematch: boolean
): JourneySettings {
  return {
    mode: practice
      ? 'freekick-practice'
      : endlessFreeKick(config) // (Playground posts report as Infinity runs)
        ? 'freekick-infinity'
        : 'freekick-challenge',
    difficulty: config.difficulty,
    durationSec: 0,
    rematch,
    level,
    goalTarget: practice ? 0 : config.goals,
    lives: practice ? 0 : config.lives,
  };
}
export function freeKickJourneyResult(
  practice: boolean,
  won: boolean,
  goals: number,
  shots: number,
  points: number,
  elapsed: number,
  quit: boolean,
  infinity = false
): JourneyResult {
  return {
    mode: practice
      ? 'freekick-practice'
      : infinity
        ? 'freekick-infinity'
        : 'freekick-challenge',
    outcome:
      quit || practice
        ? 'quit'
        : infinity
          ? 'completed'
          : won
            ? 'cleared'
            : 'failed',
    goalsFor: goals,
    goalsAgainst: Math.max(0, shots - goals),
    points,
    elapsedSec: Math.ceil(Math.max(0, elapsed)),
  };
}
