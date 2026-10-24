import type { Difficulty } from './types';

// --- Match results: today's leaderboard per post, and posting a score ---

// One finished match, as the client reports it (the server re-checks it).
export type MatchStats = {
  mode?: 'competitive' | 'casual';
  difficulty: Difficulty;
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  passes: number;
  tacklesWon: number;
};

export type DailyLeader = MatchStats & {
  rank: number; // 1 = best
  username: string;
};

// POST /api/result (body: MatchStats) and GET /api/daily-leaders.
export type DailyLeadersResponse = {
  day: string; // today's UTC date, YYYY-MM-DD (the window's last day)
  top: DailyLeader[]; // the best 3 of the last 7 days, each player's best match
  me: DailyLeader | null; // the caller's best of the last 7 days, if any
};

// POST /api/post-score: a comment on the post, optionally with the stats.
export type PostScoreRequest = {
  comment: string;
  includeStats: boolean;
  result: MatchStats;
};

export type PostScoreResponse = {
  commentId: string;
};
