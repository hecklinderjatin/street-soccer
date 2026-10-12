import { MATCH } from '../../shared/tuning';
import type { Team } from '../../shared/types';

export type MatchPhase = 'kickoff' | 'live' | 'goal' | 'fulltime';

// The match state machine:
// kickoff (players frozen for a moment) -> live (the clock starts at the
// first touch) -> goal (hit-stop, slow-motion celebration, then back to
// kickoff with the conceding team kicking off) ... -> fulltime.
// Level at full time -> 30 s golden goal; still level -> draw.
export class MatchFlow {
  phase: MatchPhase = 'kickoff';
  phaseTime = 0; // real seconds in the current phase
  clock: number = MATCH.durationSec; // seconds left
  clockRunning = false;
  goldenGoal = false;
  goldenBannerLeft = 0;
  score: Record<Team, number> = { home: 0, away: 0 };
  kickoffTeam: Team = 'home';
  lastScorer: Team | null = null;
  finished = false; // full-time pause done: show the result

  // Players hold their spots during the kickoff freeze and the celebration.
  get playersFrozen() {
    return (
      (this.phase === 'kickoff' && this.phaseTime < MATCH.kickoffFreezeSec) ||
      this.phase === 'goal' ||
      this.phase === 'fulltime'
    );
  }

  // Simulation speed: 0 during the hit-stop, slow motion early in the
  // celebration, otherwise normal.
  get timeScale() {
    if (this.phase !== 'goal') return 1;
    if (this.phaseTime < MATCH.goalHitStopSec) return 0;
    if (this.phaseTime < MATCH.goalHitStopSec + MATCH.slowMoSec)
      return MATCH.slowMoScale;
    return 1;
  }

  get banner() {
    if (this.phase === 'kickoff')
      return this.phaseTime < MATCH.kickoffFreezeSec ? 'READY' : '';
    if (
      this.phase === 'live' &&
      this.phaseTime < MATCH.goBannerSec &&
      this.lastWasKickoff
    )
      return 'GO!';
    if (this.phase === 'goal') return 'GOAL!';
    if (this.phase === 'fulltime') return 'FULL TIME';
    if (this.goldenBannerLeft > 0) return 'GOLDEN GOAL';
    if (this.flashLeft > 0) return this.flashText;
    return '';
  }

  private flashText = '';
  private flashLeft = 0;
  private lastWasKickoff = false;
  private resetRequested = false;

  // Advances phase timers with real time; returns true once when the scene
  // should reset players and ball for a kickoff.
  update(realDt: number): boolean {
    this.phaseTime += realDt;
    this.goldenBannerLeft = Math.max(0, this.goldenBannerLeft - realDt);
    this.flashLeft = Math.max(0, this.flashLeft - realDt);

    if (this.phase === 'kickoff' && this.phaseTime >= MATCH.kickoffFreezeSec) {
      this.enter('live');
      this.lastWasKickoff = true;
    } else if (
      this.phase === 'goal' &&
      this.phaseTime >= MATCH.goalHitStopSec + MATCH.celebrationSec
    ) {
      if (this.goldenGoal) {
        this.enter('fulltime');
      } else {
        this.enter('kickoff');
        this.resetRequested = true;
      }
    } else if (
      this.phase === 'fulltime' &&
      this.phaseTime >= MATCH.fullTimePauseSec
    ) {
      this.finished = true;
    }

    const reset = this.resetRequested;
    this.resetRequested = false;
    return reset;
  }

  // Simulation time: runs the match clock while live.
  tickClock(dt: number) {
    if (this.phase !== 'live' || !this.clockRunning) return;
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 0;
    if (this.goldenGoal || this.score.home !== this.score.away) {
      this.enter('fulltime');
    } else {
      this.goldenGoal = true;
      this.goldenBannerLeft = MATCH.goldenBannerSec;
      this.clock = MATCH.goldenGoalSec;
    }
  }

  // A short banner during live play (e.g. OVER THE BAR).
  flash(text: string, sec: number) {
    this.flashText = text;
    this.flashLeft = sec;
  }

  // The first touch after a kickoff starts the clock.
  onTouch() {
    if (this.phase === 'live') this.clockRunning = true;
  }

  onGoal(scorer: Team) {
    if (this.phase !== 'live') return;
    this.score[scorer] += 1;
    this.lastScorer = scorer;
    this.kickoffTeam = scorer === 'home' ? 'away' : 'home';
    this.enter('goal');
  }

  private enter(phase: MatchPhase) {
    this.phase = phase;
    this.phaseTime = 0;
    this.lastWasKickoff = false;
    if (phase === 'kickoff') this.clockRunning = false;
  }
}
