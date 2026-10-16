import { MATCH } from '../../shared/tuning';
import type { Team } from '../../shared/types';

export type MatchPhase = 'kickoff' | 'live' | 'goal' | 'break' | 'fulltime';

// The match state machine:
// kickoff (players frozen for a moment) -> live, first waiting for the
// kickoff pass (user request: nothing starts, neither the AI nor the
// clock, until the kicker passes: you press PASS, or the CPU kicker passes
// after MATCH.cpuKickoffSec; kickedOff()) -> goal (hit-stop, slow-motion
// celebration, then back to kickoff with the conceding team kicking off)
// ... -> fulltime. Level at full time -> golden goal (user request): the
// game pauses (break, GOLDEN GOAL banner), then restarts from a kickoff
// (the other team from the last kickoff) with a fresh 30 s clock; the next
// goal wins; still level -> draw.
// A custom match sets the regular time and the score at kickoff (e.g. the
// AI a goal up: a comeback challenge).
export class MatchFlow {
  phase: MatchPhase = 'kickoff';
  phaseTime = 0; // real seconds in the current phase
  clock: number; // seconds left
  clockRunning = false;
  awaitingKickoff = false; // live, but waiting for the kickoff pass
  goldenGoal = false;
  score: Record<Team, number>;
  kickoffTeam: Team = 'home';
  lastScorer: Team | null = null;
  finished = false; // full-time pause done: show the result

  constructor(
    durationSec: number = MATCH.durationSec,
    startScore: Readonly<Record<Team, number>> = { home: 0, away: 0 }
  ) {
    this.clock = durationSec;
    this.score = { ...startScore };
  }

  // Players hold their spots during the kickoff freeze, until the kickoff
  // pass, during the celebration and the golden-goal break.
  get playersFrozen() {
    return (
      (this.phase === 'kickoff' && this.phaseTime < MATCH.kickoffFreezeSec) ||
      (this.phase === 'live' && this.awaitingKickoff) ||
      this.phase === 'goal' ||
      this.phase === 'break' ||
      this.phase === 'fulltime'
    );
  }

  // Simulation speed: 0 during the hit-stop and the golden-goal break (the
  // game is paused), slow motion early in the celebration, otherwise normal.
  get timeScale() {
    if (this.phase === 'break') return 0;
    if (this.phase !== 'goal') return 1;
    if (this.phaseTime < MATCH.goalHitStopSec) return 0;
    if (this.phaseTime < MATCH.goalHitStopSec + MATCH.slowMoSec)
      return MATCH.slowMoScale;
    return 1;
  }

  get banner() {
    if (this.phase === 'kickoff')
      return this.phaseTime < MATCH.kickoffFreezeSec ? 'READY' : '';
    if (this.phase === 'live' && this.awaitingKickoff)
      return this.kickoffTeam === 'home' ? 'PASS TO START' : '';
    if (this.phase === 'live' && this.goLeft > 0) return 'GO!';
    if (this.phase === 'goal') return 'GOAL!';
    if (this.phase === 'break') return 'GOLDEN GOAL';
    if (this.phase === 'fulltime') return 'FULL TIME';
    if (this.flashLeft > 0) return this.flashText;
    return '';
  }

  private flashText = '';
  private flashLeft = 0;
  private goLeft = 0; // GO! banner time left after the kickoff pass
  private resetRequested = false;

  // Advances phase timers with real time; returns true once when the scene
  // should reset players and ball for a kickoff.
  update(realDt: number): boolean {
    this.phaseTime += realDt;
    this.flashLeft = Math.max(0, this.flashLeft - realDt);
    this.goLeft = Math.max(0, this.goLeft - realDt);

    if (this.phase === 'kickoff' && this.phaseTime >= MATCH.kickoffFreezeSec) {
      this.enter('live');
      this.awaitingKickoff = true;
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
      this.phase === 'break' &&
      this.phaseTime >= MATCH.goldenBreakSec
    ) {
      // Golden goal restarts from a kickoff (players and ball reset).
      this.enter('kickoff');
      this.resetRequested = true;
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
      // Level: pause, then golden goal from a kickoff with a fresh clock,
      // kicked off by the side that didn't take the last kickoff.
      this.goldenGoal = true;
      this.clock = MATCH.goldenGoalSec;
      this.kickoffTeam = this.kickoffTeam === 'home' ? 'away' : 'home';
      this.enter('break');
    }
  }

  // A short banner during live play (e.g. OVER THE BAR).
  flash(text: string, sec: number) {
    this.flashText = text;
    this.flashLeft = sec;
  }

  // A touch of the ball in live play keeps the clock running (it starts
  // with the kickoff pass, kickedOff).
  onTouch() {
    if (this.phase === 'live' && !this.awaitingKickoff)
      this.clockRunning = true;
  }

  // The kickoff pass has been struck: play (AI, clock) starts.
  kickedOff() {
    if (this.phase !== 'live' || !this.awaitingKickoff) return;
    this.awaitingKickoff = false;
    this.clockRunning = true;
    this.goLeft = MATCH.goBannerSec;
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
    this.awaitingKickoff = false;
    this.goLeft = 0;
    if (phase === 'kickoff') this.clockRunning = false;
  }
}
