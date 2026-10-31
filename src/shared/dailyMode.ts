import type { DailyMode, MatchConfig } from './types';
import { DIFFICULTIES } from './types';
import { DAILY, TACTICS } from './tuning';
import type { MatchStats } from './api';

export const DAILY_MODES: readonly DailyMode[] = [
  'comeback',
  'hold-lead',
  'survival',
];
export const DAILY_LABEL: Record<DailyMode, string> = {
  comeback: 'COMEBACK',
  'hold-lead': 'HOLD THE LEAD',
  survival: 'SURVIVAL',
};
export const parseDailyMode = (value: unknown) =>
  DAILY_MODES.find((mode) => mode === value);
export const startScore = (config: MatchConfig) => ({
  home: config.startGoalsFor ?? 0,
  away: config.startGoalsAgainst,
});
export const challengeCleared = (
  mode: DailyMode,
  home: number,
  away: number
) =>
  mode === 'survival'
    ? home >= DAILY.survivalGoals && away < DAILY.survivalConceded
    : home > away;
export const survivalDifficulty = (goals: number) =>
  DIFFICULTIES[
    Math.min(DIFFICULTIES.length - 1, Math.max(0, Math.floor(goals)))
  ] ?? 'noob';
export function dailyObjective(config: MatchConfig) {
  if (config.dailyMode === 'survival')
    return 'Score 5 to win. Concede 3 and the run ends.';
  if (config.dailyMode === 'hold-lead')
    return `Protect a ${config.startGoalsFor ?? 0}-0 lead. Finish ahead. No extra time.`;
  if (config.dailyMode === 'comeback')
    return `Win from 0-${config.startGoalsAgainst}. No extra time.`;
  return '';
}

// Plans change risk and positioning, never movement speed or shot physics.
export function dailyPlans(
  config: MatchConfig,
  score: { home: number; away: number },
  clock: number
) {
  const mode = config.mode === 'casual' ? undefined : config.dailyMode;
  const chasing = score.away < score.home;
  const late = clock <= config.durationSec * DAILY.lateShare;
  const away =
    !mode || mode === 'survival'
      ? 'balanced'
      : score.away > score.home
        ? 'defensive'
        : chasing
          ? late && mode === 'hold-lead'
            ? 'allOut'
            : 'attacking'
          : 'balanced';
  const home =
    mode === 'hold-lead' && score.home > score.away ? 'defensive' : 'attacking';
  return {
    home: TACTICS[home],
    away: TACTICS[away],
    difficulty:
      mode === 'survival' ? survivalDifficulty(score.home) : config.difficulty,
    key: `${home}:${away}:${mode === 'survival' ? survivalDifficulty(score.home) : config.difficulty}`,
  };
}

// The server uses this for both saved ordering and the returned board.
export function resultRankScore(stats: MatchStats) {
  if (stats.dailyMode === 'survival')
    return (
      (stats.cleared ? 1e9 : 0) +
      stats.goalsFor * 1e6 +
      (99 - stats.goalsAgainst) * 1000 +
      (1000 - (stats.elapsedSec ?? 1000))
    );
  const regular =
    (stats.goalsFor - stats.goalsAgainst + 1000) * 1000 + stats.goalsFor;
  return regular + (stats.dailyMode && stats.cleared ? 1e9 : 0);
}

export function resultLabel(stats: MatchStats) {
  if (stats.dailyMode === 'survival') {
    const sec = stats.elapsedSec ?? 0;
    return `${stats.cleared ? 'CLEAR' : `${stats.goalsFor}/5`} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  return `${stats.goalsFor}–${stats.goalsAgainst}`;
}

export function withoutDailyMode(config: MatchConfig): MatchConfig {
  const copy = { ...config };
  delete copy.dailyMode;
  delete copy.startGoalsFor;
  return copy;
}
