export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

// Home is the human's team (attacks right, toward x = width); away is the CPU.
export type Team = 'home' | 'away';

export type MatchConfig = {
  difficulty: Difficulty;
};

export type MatchResult = {
  difficulty: Difficulty;
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  passes: number;
  tacklesWon: number;
};
