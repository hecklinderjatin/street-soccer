import {
  endlessFreeKick,
  infinitySkill,
  type FreeKickChallengeConfig,
} from '../../shared/freeKickChallenge';
import { FREE_KICK as FK } from '../../shared/tuning';

// The exact post kicks Practice can load (user request, 2026-11-11): every
// Challenge round, or Infinity's kick after N goals at points through its
// climb and deep into Pro+. `round` is the 0-based round / goals scored.
export type PracticePick = { round: number; label: string };

export function practicePicks(config: FreeKickChallengeConfig): PracticePick[] {
  if (config.mode === 'custom') return [];
  if (endlessFreeKick(config))
    return FK.infinityPracticeGoals.map((goals) => ({
      round: goals,
      label: `INFINITY GOAL ${goals + 1} (${infinitySkill(goals)})`,
    }));
  return Array.from({ length: config.goals }, (_, round) => ({
    round,
    label: `CHALLENGE ROUND ${round + 1}`,
  }));
}

// What the on-screen button that moves Practice on is called.
export const practiceNextLabel = (
  config: FreeKickChallengeConfig,
  round: number | null
) =>
  round === null
    ? 'NEW SPOT'
    : endlessFreeKick(config)
      ? 'NEXT GOAL'
      : 'NEXT ROUND';
