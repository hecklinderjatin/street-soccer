import { GOAL_FEEDBACK } from './tuning';
import type { Team } from './types';

export type GoalStrike = {
  human: boolean; // the controlled player struck it, not an autonomous teammate
  team: Team;
  kmh: number;
  style: 'CHIP' | 'CURL' | 'STRIKE';
};

// Arcade display calibration, not a claim of a real-world pitch scale.
// Measure launch velocity in all three dimensions, before drag/collisions.
export function launchSpeedKmh(vx: number, vy: number, vz: number) {
  return Math.round(Math.hypot(vx, vy, vz) * GOAL_FEEDBACK.kmhPerUnit);
}

export function qualifyingGoal(strike: GoalStrike | null, scoring: Team) {
  return strike?.team === scoring &&
    Number.isInteger(strike.kmh) &&
    strike.kmh > 0 &&
    strike.kmh <= GOAL_FEEDBACK.maxKmh
    ? strike
    : null;
}

export function goalStyle(strike: GoalStrike) {
  return strike.style !== 'STRIKE'
    ? strike.style
    : strike.kmh >= GOAL_FEEDBACK.rocketKmh
      ? 'ROCKET'
      : 'GREAT FINISH';
}
