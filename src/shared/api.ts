import type { Difficulty } from './types';

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  snoovatarUrl: string;
  previousTime: string;
};

export type StoredState = {
  username: string;
  level?: number;
  bestScore?: number;
  data?: Record<string, unknown>;
  updatedAt: number;
};

export type StateUpsertRequest = {
  level?: number;
  data?: Record<string, unknown>;
};

export type ScoreSubmitRequest = {
  score: number;
};

export type ScoreSubmitResponse = {
  username: string;
  score: number;
  updatedAt: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
};

export type LeaderboardResponse = {
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  totalPlayers: number;
  generatedAt: number;
};

// --- Match results: today's leaderboard per post, and posting a score ---

// One finished match, as the client reports it (the server re-checks it).
export type MatchStats = {
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
  day: string; // UTC date, YYYY-MM-DD
  top: DailyLeader[]; // the best 3 today, each player's best match
  me: DailyLeader | null; // the caller's best today, if any
};

// POST /api/post-score: a comment on the post, optionally with the stats.
export type PostScoreRequest = {
  comment: string;
  includeStats: boolean;
  result: MatchStats;
};

export type PostScoreResponse = {
  commentId: string;
  asUser: boolean; // false: posted by the app account, naming the player
};
