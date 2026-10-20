import type { MatchStats } from '../../shared/api';
import { DIFFICULTY_LABEL, type MatchConfig } from '../../shared/types';

// The comment a player posts from the result screen (POST MY SCORE): their
// own words, then, if they chose to share it, a line with the score and
// the match stats.

export const COMMENT_MAX = 1000; // characters of the player's own text

const outcome = (s: MatchStats) =>
  s.goalsFor > s.goalsAgainst
    ? 'Won'
    : s.goalsFor < s.goalsAgainst
      ? 'Lost'
      : 'Drew';

const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function statsLine(stats: MatchStats, config: MatchConfig | null) {
  const teams = config ? `${config.home.name} vs ${config.away.name}, ` : '';
  return (
    `⚽ **${outcome(stats)} ${stats.goalsFor}-${stats.goalsAgainst}** ` +
    `(${teams}${capital(DIFFICULTY_LABEL[stats.difficulty])} AI) · ` +
    `Shots ${stats.shots} · Passes ${stats.passes} · Tackles won ${stats.tacklesWon}`
  );
}

// The comment body, or why there is nothing to post. `byline` names the
// player when the app account posts for them.
export function scoreComment(
  comment: string,
  includeStats: boolean,
  stats: MatchStats,
  config: MatchConfig | null,
  byline?: string
): string {
  const parts = [
    byline ? `**u/${byline}:**` : '',
    comment.trim(),
    includeStats ? statsLine(stats, config) : '',
  ].filter((part) => part !== '');
  return parts.join('\n\n');
}
