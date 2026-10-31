// Ids are stored in posts' saved matches and score lines, so 'easy' /
// 'normal' / 'hard' keep their old ids; players see DIFFICULTY_LABEL.
export type Difficulty = 'noob' | 'easy' | 'normal' | 'hard' | 'pro';

// Easiest first.
export const DIFFICULTIES: readonly Difficulty[] = [
  'noob',
  'easy',
  'normal',
  'hard',
  'pro',
];

export const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  noob: 'NOOB',
  easy: 'EASY',
  normal: 'NORMAL',
  hard: 'HARD',
  pro: 'PRO',
};

// Home is the human's team (attacks right, toward x = width); away is the CPU.
export type Team = 'home' | 'away';

// Outfield shirt colours a team can wear (keepers always wear green / gold,
// so neither is offered). Each one is a baked kit atlas.
export type JerseyColor =
  'pink' | 'blue' | 'red' | 'white' | 'black' | 'purple' | 'orange' | 'teal';
export const JERSEY_COLORS: readonly JerseyColor[] = [
  'pink',
  'blue',
  'red',
  'white',
  'black',
  'purple',
  'orange',
  'teal',
];

// Outfield shapes (back-mid-forward) for the 4 outfielders; spots in
// tuning.ts FORMATIONS.
export type FormationName = '2-1-1' | '1-2-1' | '2-2' | '1-1-2' | '3-1' | '1-3';
export const FORMATION_NAMES: readonly FormationName[] = [
  '2-1-1',
  '1-2-1',
  '2-2',
  '1-1-2',
  '3-1',
  '1-3',
];

export type TeamSetup = {
  name: string; // scoreboard label: A-Z, 0-9 and spaces (the pixel font)
  jersey: JerseyColor;
  formation: FormationName;
};

export type DailyMode = 'comeback' | 'hold-lead' | 'survival';

export type MatchConfig = {
  survivalGoals?: number; // defaults to five for existing Survival posts
  survivalConceded?: number; // defaults to three
  dailyMode?: DailyMode; // explicit new Daily templates; absent on legacy/Classic/Casual
  startGoalsFor?: number; // Shield head start; legacy defaults to zero
  mode?: 'competitive' | 'casual'; // omitted by legacy posts: competitive
  difficulty: Difficulty;
  durationSec: number; // regular time
  startGoalsAgainst: number; // the AI's score at kickoff (a comeback challenge)
  home: TeamSetup; // the player's team
  away: TeamSetup; // the AI's team
  locked: boolean; // set by a moderator for this post: players can't change it
};

export type MatchResult = {
  elapsedSec?: number; // live match clock elapsed; excludes pauses/celebrations
  fastestGoalKmh?: number; // fastest qualifying home goal this match
  newSpeedBest?: boolean; // beat the device record during this match
  config: MatchConfig; // replayed as is by PLAY AGAIN
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  passes: number;
  tacklesWon: number;
};
