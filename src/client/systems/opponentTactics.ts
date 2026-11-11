import { OPPONENT_TACTICS } from '../../shared/tuning';
import type { MatchTactic } from './ai';

// Uses only public match state, never the human's tactic or input.
export class OpponentTactics {
  current: MatchTactic = 'normal';
  private pending: MatchTactic = 'normal';
  private pendingSince = 0;
  private changedAt = -Infinity;

  update(
    home: number,
    away: number,
    remaining: number,
    duration: number,
    time: number
  ): MatchTactic {
    const late =
      remaining <=
      Math.min(
        OPPONENT_TACTICS.lateSeconds,
        duration * OPPONENT_TACTICS.lateFraction
      );
    const desired =
      away < home ? 'attack' : away > home && late ? 'defend' : 'normal';
    if (desired === this.current) {
      this.pending = desired;
      this.pendingSince = time;
      return this.current;
    }
    if (desired !== this.pending) {
      this.pending = desired;
      this.pendingSince = time;
    }
    if (
      time - this.pendingSince >= OPPONENT_TACTICS.reactionSeconds &&
      time - this.changedAt >= OPPONENT_TACTICS.holdSeconds
    ) {
      this.current = desired;
      this.changedAt = time;
    }
    return this.current;
  }
}
