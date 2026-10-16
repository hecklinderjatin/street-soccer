export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

// Home is the human's team (attacks right, toward x = width); away is the CPU.
export type Team = 'home' | 'away';

// Outfield shirt colours a team can wear (keepers always wear green / gold,
// so neither is offered). Each one is a baked kit atlas.
export type JerseyColor =
  'pink' | 'blue' | 'red' | 'white' | 'black' | 'purple';
export const JERSEY_COLORS: readonly JerseyColor[] = [
  'pink',
  'blue',
  'red',
  'white',
  'black',
  'purple',
];

// Outfield shapes (back-mid-forward) for the 4 outfielders; spots in
// tuning.ts FORMATIONS.
export type FormationName = '2-1-1' | '1-2-1' | '2-2' | '1-1-2' | '3-1';
export const FORMATION_NAMES: readonly FormationName[] = [
  '2-1-1',
  '1-2-1',
  '2-2',
  '1-1-2',
  '3-1',
];

export type TeamSetup = {
  name: string; // scoreboard label: A-Z, 0-9 and spaces (the pixel font)
  jersey: JerseyColor;
  formation: FormationName;
};

export type MatchConfig = {
  difficulty: Difficulty;
  durationSec: number; // regular time
  startGoalsAgainst: number; // the AI's score at kickoff (a comeback challenge)
  home: TeamSetup; // the player's team
  away: TeamSetup; // the AI's team
  locked: boolean; // set by a moderator for this post: players can't change it
};

export type MatchResult = {
  config: MatchConfig; // replayed as is by PLAY AGAIN
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  passes: number;
  tacklesWon: number;
};
