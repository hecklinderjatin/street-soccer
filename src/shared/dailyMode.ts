import { chaosLabel } from './chaos';
import type { DailyMode, MatchConfig } from './types';
import { DIFFICULTIES } from './types';
import { DAILY, TACTICS } from './tuning';
import type { MatchStats, DailyLeadersResponse } from './api';

export const DAILY_MODES: readonly DailyMode[] = [
  'comeback',
  'hold-lead',
  'survival',
  'chaos',
];
export const DAILY_LABEL: Record<DailyMode, string> = {
  comeback: 'COMEBACK',
  'hold-lead': 'SHIELD',
  survival: 'RAMPAGE',
  chaos: 'CHAOS',
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
  away: number,
  goals: number = DAILY.survivalGoals,
  conceded: number = DAILY.survivalConceded
) => (mode === 'survival' ? home >= goals && away < conceded : home > away);
export const survivalDifficulty = (goals: number) =>
  DIFFICULTIES[
    Math.min(DIFFICULTIES.length - 1, Math.max(0, Math.floor(goals)))
  ] ?? 'noob';
export const survivalLimits = (
  config: Pick<MatchConfig, 'survivalGoals' | 'survivalConceded'>
) => ({
  goals: config.survivalGoals ?? DAILY.survivalGoals,
  conceded: config.survivalConceded ?? DAILY.survivalConceded,
});
export const survivalReceiptMinimum = (config: MatchConfig) =>
  Math.min(
    DAILY.earlyFinishMinSec,
    Math.min(survivalLimits(config).goals, survivalLimits(config).conceded) *
      DAILY.minSecPerTerminalGoal
  );
export function survivalRange(config: Pick<MatchConfig, 'survivalGoals'>) {
  const last = survivalDifficulty(
    survivalLimits(config).goals - 1
  ).toUpperCase();
  return last === 'NOOB' ? 'NOOB' : `NOOB-${last}`;
}
// Explain the actual opponent tiers for this target, not a fixed skill label.
export function survivalProgression(
  config: Pick<MatchConfig, 'survivalGoals'>
) {
  const count = Math.min(survivalLimits(config).goals, DIFFICULTIES.length);
  return DIFFICULTIES.slice(0, count)
    .map((level) => level.toUpperCase())
    .join(' > ');
}
export function dailyObjective(config: MatchConfig) {
  if (config.dailyMode === 'chaos')
    return `${chaosLabel(config)}. Both teams. Win in regulation.`;
  if (config.dailyMode === 'survival')
    return `Score ${survivalLimits(config).goals} to win. Concede ${survivalLimits(config).conceded} and the run ends.`;
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
    !mode || mode === 'survival' || mode === 'chaos'
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
    return stats.cleared
      ? 1e9 +
          (1000 - (stats.elapsedSec ?? 1000)) * 1000 +
          (99 - stats.goalsAgainst)
      : 0;
  const regular =
    (stats.goalsFor - stats.goalsAgainst + 1000) * 1000 + stats.goalsFor;
  return regular + (stats.dailyMode && stats.cleared ? 1e9 : 0);
}

export function resultLabel(stats: MatchStats) {
  if (stats.dailyMode === 'survival') {
    const sec = stats.elapsedSec ?? 0;
    const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    return stats.cleared
      ? time
      : `${stats.goalsFor}/${stats.survivalGoals ?? DAILY.survivalGoals} ${time}`;
  }
  return `${stats.goalsFor}–${stats.goalsAgainst}`;
}

export function withoutDailyMode(config: MatchConfig): MatchConfig {
  const copy = { ...config };
  delete copy.survivalGoals;
  delete copy.survivalConceded;
  delete copy.chaosEffect;
  delete copy.chaosStrength;
  delete copy.dailyMode;
  delete copy.startGoalsFor;
  return copy;
}

// Recompute from stored stats so older concede-first ZSET scores cannot
// override the new time-first order. Failed runs are excluded entirely.
export function rankSurvivalFinishers(
  rows: readonly { username: string; stats: MatchStats }[],
  day: string,
  username: string | null,
  limit = 3
): DailyLeadersResponse {
  const best = new Map<string, MatchStats>();
  for (const row of rows) {
    if (row.stats.dailyMode !== 'survival' || !row.stats.cleared) continue;
    const previous = best.get(row.username);
    if (!previous || resultRankScore(row.stats) > resultRankScore(previous))
      best.set(row.username, row.stats);
  }
  const ranked = [...best]
    .sort(
      ([a, x], [b, y]) =>
        resultRankScore(y) - resultRankScore(x) || a.localeCompare(b)
    )
    .map(([name, stats], i) => ({ ...stats, username: name, rank: i + 1 }));
  return {
    day,
    top: ranked.slice(0, limit),
    me: ranked.find((row) => row.username === username) ?? null,
  };
}
