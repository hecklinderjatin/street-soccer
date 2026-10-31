import { rulesOf } from '../../shared/chaos';
import {
  AI,
  BALL,
  DRIBBLE,
  FORMATIONS,
  KEEPER,
  PITCH,
  PLAYER,
  POSSESSION,
  SHOOT,
  SIM,
  STAMINA,
  TACKLE,
  TACTICS,
  type FormationLine,
  type FormationSpot,
} from '../../shared/tuning';
import type { Team } from '../../shared/types';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import { chipFlight, passTravelTime, throughSpot } from './actions';
import type { StickInput } from './Controls';
import { DEG, angleDiff, clamp, distToSegment, lerp } from './geometry';
import { canTackle } from './tackle';

// Shared outfield AI (Phase 3), the same for both teams. A TeamBrain hands
// out roles a few times a second (think); every fixed step each AI player
// steers toward its role's target (steer), and the normal movement code
// moves it: same speeds, turning and stamina as the human, no teleports.
//
// Roles:
// - chase: the one player per team quickest to a loose ball goes for it
//   (the intended receiver of a pass, if it's ours). Clearly first, it
//   jogs (saves stamina); clearly beaten to it in its own half, it takes a
//   goal-side spot instead of arriving behind the opponent.
// - press: with the opponent on the ball, one player contains the carrier:
//   goal-side of it at a distance (further off deep in the carrier's own
//   half), its spot worked out when thinking (it reacts, it doesn't shadow
//   every step; pressPoint), and goes in for tackles, only from the
//   carrier's front or side (wantsTackle). A carrier standing idle on the
//   ball is attacked: the presser goes to the ball and tackles more, and
//   later a second player closes in from behind.
// - mark: goal-side of an opponent in the danger zone near our goal,
//   leaning toward the ball, sagging off the further he is from the ball.
//   At most AI.maxMarkers, never everyone: zonal defence, not every
//   attacker shadowed all over the pitch.
// - backup: the cover defender, behind the presser (or our human pressing)
//   on the line from the carrier to our goal, so beating the presser
//   doesn't mean a clear run; a presser the carrier gets past hands the
//   job to a goal-side teammate (pickPresser), usually this one.
// Defenders caught upfield of the ball sprint back goal-side (recovery
// runs, LEVELS.recoverSlack). The presser shows the carrier wide: it
// stands on his inside shoulder, pushing him toward the touchline.
// - cover: a formation spot, shifted with the ball; when defending, dropped
//   back and pulled toward the middle (a zone, zoneSpot).
// - support: a formation spot pushed upfield and moved into open space.
// - run: the furthest-forward supporter runs into space ahead of the ball;
//   a player who has just passed may burst forward for a return pass
//   (give-and-go, passAndRun).
// - show: our carrier under pressure, the nearest teammate comes to a free
//   spot close by for a short pass.
// - rest: while we attack, our deepest player stays goal-side of their most
//   advanced one (cover against the counter).
// - carry: has the ball. It scores shoot (at the most open spot of the
//   goal, or a chip over a keeper off its line) / pass (to feet, or a
//   through ball into a runner's path) / dribble (upfield, cutting in
//   later, round opponents; straight at goal on a counter-attack just after
//   winning the ball) / clear (decideCarry) with some random
//   variation, and either dribbles (steer) or hands MatchScene a pass or
//   shot to make (takeAction).
// Every spot is off by a small positioning error per player (LEVELS
// .posError, renewed every few seconds), so the shape is never machine-
// perfect, and looser on easy. Positioning jobs move calmly: their spot
// glides instead of jumping, and a player standing at it only sets off
// again once it is AI.restartDist away (no fidgeting). The shape slides
// only a little with the ball and stretches wide when we have it, so the
// play doesn't all pile up round the ball.
// Each team plays a plan (TeamStyle, a TACTICS row): ours attacking (every
// slot pushes well up with the ball and tracks back without it, the
// forward runs ahead, more one-twos and through balls, pressing high), the
// CPU balanced. A brain sees the opposing carrier late (skill.readSec, via
// Player.seenAgo) when pressing, judging idleness and tackling, so feints
// and sharp turns wrong-foot it.
// The human's player is never steered; it still counts: our player near
// the carrier is our presser, and our player quickest to a loose ball is
// our chaser.
export type AiRole =
  | 'chase'
  | 'press'
  | 'mark'
  | 'backup'
  | 'cover'
  | 'support'
  | 'run'
  | 'show'
  | 'rest'
  | 'carry';

export type AiOrder = {
  role: AiRole;
  mark: Player | null; // the opponent marked (roles 'mark' and 'rest')
  x: number; // target for cover / support / run / show / carry, or chase's goal-side spot (set when thinking)
  y: number;
  sprint: boolean; // carry: dribble at a sprint; any other role: go flat out
  relax: boolean; // chase: clearly first to the ball, so it jogs
  goalSide: boolean; // chase: an opponent gets there first; (x, y) is the goal-side spot to take instead
};

// What an AI carrier does with the ball.
export type CarryAction =
  | { kind: 'dribble'; x: number; y: number; sprint: boolean }
  | { kind: 'pass'; to: Player; through: boolean } // through: into its run (kickThroughPass)
  | { kind: 'shoot'; x: number; y: number; charge: number; chip: number } // chip: swipe-up amount, 0 = driven
  | { kind: 'clear'; x: number; y: number }; // a lofted kick upfield

// How sharp a team's AI is: a row of LEVELS (the CPU by difficulty; our
// teammates at normal).
export type BrainSkill = {
  thinkSec: number; // how often it re-thinks (reaction)
  readSec: number; // reacts to the opposing carrier as it was this long ago (Player.seenAgo): feints fool it
  tackleChance: number; // chance to go in per think while in range
  shotChargeNoise: number; // shot charge spread around AI.shotCharge
  decisionNoise: number; // carrier option scores x (1 +- this)
  passErrorScale: number; // x the pass aim error
  passReactSec: number; // an opponent's pass is only seen this long after it is struck (delay)
  aimSpread: number; // shot placement pulled toward the centre by up to this (px)
  markGapScale: number; // x AI.markGap
  posError: number; // px, each player's positioning error (renewed every AI.posErrorSec)
  recoverSlack: number; // px a defender may be upfield of the ball before it sprints back goal-side
};

// A team's game plan: a TACTICS row (ours attacking, the CPU balanced).
// Pushes and drops are per formation line (defenders, midfielders,
// forwards).
export type TeamStyle = {
  pushAttack: Readonly<Record<FormationLine, number>>; // with the ball: each slot's spot this far upfield
  dropDefend: Readonly<Record<FormationLine, number>>; // without it: this far back
  outletForward: boolean; // defending: the forward stays up instead of tracking back
  runAhead: number; // the forward runs at least this far ahead of the ball
  giveGoChance: number; // after a pass, chance of a give-and-go burst ...
  giveGoFrom: number; // ... from this share of the pitch up
  throughMargin: number; // s a through ball's runner must beat every opponent by
  passProgress: number; // pass score per unit of forward progress
  pressHigh: boolean; // press close even deep in the carrier's own half
  pressGapScale: number; // x the presser's gap
};

export type TeamView = {
  mates: readonly Player[]; // outfield players, in the brain's formation order
  opponents: readonly Player[]; // the other side's outfield players
  human: Player | null; // our player under the human's control, if any
  ball: Ball;
  oppKeeper: Player; // the keeper we shoot at
  canTackle: boolean; // AI tackles allowed (not right after kickoff)
  rand: () => number;
};

export type Steer = { move: StickInput; sprint: boolean };

const STAND: Steer = { move: { x: 0, y: 0, r: 0 }, sprint: false };
const PREDICT_STEP = 0.05; // s, ball prediction step for intercepts

export class TeamBrain {
  readonly orders = new Map<Player, AiOrder>();
  readonly tackles: { p: Player; dir: number }[] = []; // tackles to start (drained by MatchScene)
  private action: { p: Player; act: CarryAction; at: number } | null = null; // pass / shot due
  private lastOwner: Player | null = null;
  private ownerSince = 0; // sim time the current owner gained the ball (as seen when thinking)
  private nextThinkAt = 0;
  // Give-and-go: players of ours who just passed, bursting upfield until `until`.
  private readonly runs = new Map<
    Player,
    { until: number; x: number; y: number }
  >();
  // Each player's positioning error (skill.posError), renewed now and then.
  private readonly errors = new Map<
    Player,
    { x: number; y: number; until: number }
  >();
  // The direction our carrier dribbled at the last think (eased toward the
  // new choice, so it doesn't zig-zag when its mind changes).
  private carryDir: { p: Player; dir: number } | null = null;
  // Where each player in a positioning job is actually heading: its spot,
  // eased (steer).
  private readonly aims = new Map<Player, { x: number; y: number }>();
  // An opposing carrier standing on the ball since `idleSince` (null: moving).
  private idleCarrier: Player | null = null;
  private idleSince: number | null = null;
  private mainPresser: Player | null = null; // keeps the job between thinks (pickPresser)
  // Which side had the ball last (as seen when thinking), and when we last
  // won it from them (counter-attacks).
  private possession: Team | null = null;
  private turnoverAt = -Infinity;
  // x the shot quality the current carrier waits for (random per
  // possession, AI.appetiteMin..Max): some shoot early, some walk it in.
  private appetite = 1;
  private readonly dir: number; // +1 attacking toward x = PITCH.width
  private readonly goalX: number; // own goal line

  constructor(
    readonly team: Team,
    public skill: BrainSkill,
    public style: TeamStyle = TACTICS.balanced,
    readonly formation: readonly FormationSpot[] = FORMATIONS['2-1-1']
  ) {
    this.dir = team === 'home' ? 1 : -1;
    this.goalX = team === 'home' ? 0 : PITCH.width;
  }

  configure(skill: BrainSkill, style: TeamStyle) {
    if (this.skill === skill && this.style === style) return;
    this.skill = skill;
    this.style = style;
    this.reset(); // discard decisions/position errors made under the old plan
  }

  // Think again on the next step (control changed, ...).
  wake() {
    this.nextThinkAt = 0;
  }

  // No new thinking before `time + sec` (MatchScene: the other side has just
  // passed, and this side only reacts after its pass reaction time; until
  // then its players keep their orders, so only those already in the way
  // can cut it out).
  delay(time: number, sec: number) {
    this.nextThinkAt = Math.max(this.nextThinkAt, time + sec);
  }

  // Forget everything (kickoff): orders, queued tackles, a pass or shot
  // still waiting to be made (it must not fire after the restart), runs.
  reset() {
    this.orders.clear();
    this.tackles.length = 0;
    this.action = null;
    this.lastOwner = null;
    this.ownerSince = 0;
    this.nextThinkAt = 0;
    this.runs.clear();
    this.errors.clear();
    this.aims.clear();
    this.carryDir = null;
    this.idleCarrier = null;
    this.idleSince = null;
    this.mainPresser = null;
    this.possession = null;
    this.turnoverAt = -Infinity;
    this.appetite = 1;
  }

  think(view: TeamView, time: number) {
    if (time < this.nextThinkAt) return;
    this.nextThinkAt = time + this.skill.thinkSec;
    const { mates, human, ball } = view;
    const owner = ball.owner;
    if (owner !== this.lastOwner) {
      this.lastOwner = owner;
      this.ownerSince = time;
      // How picky this possession's carrier is about its shot.
      this.appetite = lerp(AI.appetiteMin, AI.appetiteMax, view.rand());
    }
    if (owner && owner.team !== this.possession) {
      if (owner.team === this.team && this.possession !== null)
        this.turnoverAt = time;
      this.possession = owner.team;
    }
    const idleFor = this.carrierIdle(owner, time);
    this.refreshErrors(view, time);
    const ai = mates.filter((p) => p !== human && p !== owner);
    const prev = new Map(this.orders);
    this.orders.clear();
    if (this.action && this.action.p !== owner) this.action = null;
    // Our AI carrier (a keeper with the ball at its feet too) decides; never
    // for a player the human controls (our keeper included).
    if (
      owner &&
      owner.team === this.team &&
      !owner.controlled &&
      !owner.holding
    )
      this.carry(view, owner, time);

    const phase: 'attack' | 'defend' | 'loose' = !owner
      ? 'loose'
      : owner.team === this.team
        ? 'attack'
        : 'defend';

    // Give-and-go runs last while we keep the ball (or it travels between
    // us); they end when the opponent has it.
    if (phase === 'defend') this.runs.clear();
    else this.mainPresser = null;
    if (phase === 'attack') {
      this.assignSupport(view, ai, prev, time);
      return;
    }

    let free = ai;
    // (No chaser while the ball is out behind a goal, waiting for the goal
    // kick.)
    if (phase === 'loose' && ball.out === 0) {
      const chaser = this.pickChaser(view, prev);
      if (chaser) {
        this.orders.set(chaser, this.chaseOrder(view, chaser));
        free = free.filter((p) => p !== chaser);
      }
    } else if (owner && !owner.holding) {
      let doubled = false; // a second presser on an idle carrier (no backup then)
      const presser = this.pickPresser(view, free, owner);
      if (presser) {
        const at = this.pressPoint(owner, idleFor, false);
        this.set(presser, 'press', null, at.x, at.y, true);
        free = free.filter((p) => p !== presser);
        const dir = view.canTackle
          ? this.wantsTackle(presser, owner, view, time, idleFor)
          : null;
        if (dir !== null) this.tackles.push({ p: presser, dir });
        // Still standing on the ball: a second player closes in from behind
        // (the same one as last think if still free).
        const second =
          idleFor >= AI.idleDoubleSec
            ? (free.find((p) => prev.get(p)?.role === 'press') ??
              nearest(free, owner.x, owner.y))
            : null;
        if (second) {
          const behind = this.pressPoint(owner, idleFor, true);
          this.set(second, 'press', null, behind.x, behind.y, true);
          free = free.filter((p) => p !== second);
          doubled = true;
        }
      }
      // The next man: cover behind the presser (or our human pressing).
      if (!doubled) {
        const backup = this.pickBackup(view, free, owner, prev);
        if (backup) free = free.filter((p) => p !== backup);
      }
    }
    if (phase === 'defend') {
      this.assignDefence(view, free, prev);
      return;
    }
    for (const p of this.applyRuns(free, time)) {
      const spot = this.withError(p, this.spot(view, p, 'loose'));
      this.set(p, 'cover', null, spot.x, spot.y);
    }
  }

  // The stick (and sprint) for an AI player this step, from its order.
  steer(p: Player, view: TeamView): Steer {
    const order = this.orders.get(p);
    if (!order) return STAND;
    const ball = view.ball;
    if (order.role === 'carry') {
      if (ball.owner !== p) return STAND;
      const dx = order.x - p.x;
      const dy = order.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < AI.arriveDist) return STAND;
      return {
        move: { x: dx / d, y: dy / d, r: order.sprint ? 1 : 0.8 },
        sprint: order.sprint,
      };
    }
    let tx = order.x;
    let ty = order.y;
    const urgent = order.sprint;
    // Going for the ball or the carrier (chase, press) or flat out: straight
    // there. Positioning jobs (cover, support, run, show, mark, rest) are
    // calm: their spot glides and they don't fidget at it.
    const calm =
      !urgent &&
      order.role !== 'chase' &&
      order.role !== 'press' &&
      order.role !== 'backup';
    if (order.role === 'chase') {
      if (!order.goalSide) {
        const meet = interceptPoint(p, ball);
        tx = meet.x;
        ty = meet.y;
      }
    } else if (order.role === 'press') {
      // To the spot worked out when thinking (pressPoint).
      if (!ball.owner) return STAND;
    } else if ((order.role === 'mark' || order.role === 'rest') && order.mark) {
      const at = this.withError(
        p,
        order.role === 'mark'
          ? this.markPoint(order.mark, ball)
          : this.restPoint(order.mark, ball),
        PLAYER.radius
      );
      tx = at.x;
      ty = at.y;
    } else if (calm) {
      // Spread out (spots only, not a man to mark): teammates too close
      // push the spot away.
      for (const q of view.mates) {
        if (q === p) continue;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < AI.spaceDist) {
          tx += (dx / d) * (AI.spaceDist - d);
          ty += (dy / d) * (AI.spaceDist - d);
        }
      }
    }
    if (calm) {
      // The spot glides to where it should be (no jumps when the shape
      // shifts, the positioning error is renewed or a teammate passes by);
      // a new job far away is taken at once.
      const aim = this.aims.get(p);
      if (!aim || Math.hypot(aim.x - tx, aim.y - ty) > AI.aimSnapDist) {
        this.aims.set(p, { x: tx, y: ty });
      } else {
        const k = Math.min(1, AI.aimEaseRate / SIM.hz);
        aim.x += (tx - aim.x) * k;
        aim.y += (ty - aim.y) * k;
        tx = aim.x;
        ty = aim.y;
      }
    } else {
      this.aims.delete(p);
    }
    // Hard minimum gap (user request: defence got too crowded): whoever
    // goes for the ball (chase, press) runs straight there; every other
    // AI player's target stays at least AI.mateMinGap from each teammate,
    // whatever its job. Already too close, it moves off even when calm.
    const free = order.role === 'chase' || order.role === 'press';
    let crowded = false;
    if (!free) {
      const spaced = this.keepApart(p, view.mates, tx, ty);
      tx = spaced.x;
      ty = spaced.y;
      crowded = view.mates.some(
        (q) => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < AI.mateMinGap
      );
    }
    return arrive(p, tx, ty, urgent, order.relax, calm && !crowded);
  }

  // (tx, ty) pushed out of every teammate's AI.mateMinGap circle (a few
  // passes, since leaving one circle can enter another), kept on the pitch.
  private keepApart(
    p: Player,
    mates: readonly Player[],
    tx: number,
    ty: number
  ) {
    const gap = AI.mateMinGap;
    const margin = PLAYER.radius;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const q of mates) {
        if (q === p) continue;
        let dx = tx - q.x;
        let dy = ty - q.y;
        let d = Math.hypot(dx, dy);
        if (d >= gap) continue;
        if (d < 1) {
          // On top of the teammate: step away on our own side of it.
          dx = p.x - q.x;
          dy = p.y - q.y;
          d = Math.hypot(dx, dy);
          if (d < 1) {
            dx = 0;
            dy = 1;
            d = 1;
          }
        }
        tx = clamp(q.x + (dx / d) * gap, margin, PITCH.width - margin);
        ty = clamp(q.y + (dy / d) * gap, margin, PITCH.height - margin);
        moved = true;
      }
      if (!moved) break;
    }
    return { x: tx, y: ty };
  }

  // A player of ours has just passed (AI or human): sometimes it bursts
  // upfield for a return pass (give-and-go); never in our own quarter, and
  // more likely the further up it is.
  passAndRun(p: Player, time: number, rand: () => number) {
    if (p.role !== 'outfield') return;
    const progress = ((p.x - this.goalX) * this.dir) / PITCH.width;
    const chance =
      this.style.giveGoChance *
      clamp((progress - this.style.giveGoFrom) / AI.giveGoRamp, 0, 1);
    if (rand() >= chance) return;
    this.runs.set(p, {
      until: time + AI.giveGoSec,
      x: clamp(
        p.x + this.dir * AI.giveGoDist,
        AI.edgeMargin,
        PITCH.width - AI.edgeMargin
      ),
      y: clamp(
        p.y + (PITCH.height / 2 - p.y) * AI.giveGoInward,
        AI.edgeMargin,
        PITCH.height - AI.edgeMargin
      ),
    });
    this.wake();
  }

  // Who a SWITCH press should land on (MatchScene): the player the AI has
  // sent for the ball, our presser when they have it or our chaser (a
  // pass's intended receiver included) when it's loose. Null when there is
  // none (e.g. the human's player is already the one going).
  switchTarget(): Player | null {
    for (const [p, o] of this.orders)
      if (o.role === 'press' || o.role === 'chase') return p;
    return null;
  }

  // A formation spot, slid a little with the ball and, by the team's plan
  // and the player's slot, pushed up (and out wide, AI.attackWidth: our
  // ball stretches the play) or dropped back (tracking back).
  private spot(
    view: TeamView,
    p: Player,
    phase: 'attack' | 'defend' | 'loose'
  ) {
    const i = view.mates.indexOf(p);
    const base = this.formation[i] ?? this.formation[0];
    if (!base) return { x: p.x, y: p.y };
    const bx = this.team === 'home' ? base.x : PITCH.width - base.x;
    const push =
      phase === 'attack'
        ? this.style.pushAttack[base.line]
        : phase === 'defend'
          ? -this.style.dropDefend[base.line]
          : 0;
    const gy = PITCH.height / 2;
    const width = phase === 'attack' ? AI.attackWidth : 1;
    const ball = view.ball;
    return {
      x: clamp(
        bx + (ball.x - PITCH.width / 2) * AI.shiftX + push * this.dir,
        AI.edgeMargin,
        PITCH.width - AI.edgeMargin
      ),
      y: clamp(
        gy + (base.y - gy) * width + (ball.y - gy) * AI.shiftY,
        AI.edgeMargin,
        PITCH.height - AI.edgeMargin
      ),
    };
  }

  // A zone to defend: the dropped-back formation spot pulled toward the
  // line from the ball to the middle of our goal (closes the centre and the
  // lanes through it), plus the player's positioning error. In a plan with
  // an outlet forward (the CPU's) the forward stays up instead (not
  // dropped, not pulled in): an outlet for a clearance or a counter, and
  // one body fewer around the ball; otherwise it tracks back too.
  private zoneSpot(view: TeamView, p: Player) {
    if (
      this.style.outletForward &&
      view.mates.indexOf(p) === this.formation.length - 1
    )
      return this.withError(p, this.spot(view, p, 'loose'));
    const s = this.spot(view, p, 'defend');
    const ball = view.ball;
    const gy = PITCH.height / 2;
    const along = clamp((s.x - this.goalX) / (ball.x - this.goalX || 1), 0, 1);
    const lineY = gy + (ball.y - gy) * along;
    return this.withError(p, {
      x: s.x,
      y: lerp(s.y, lineY, AI.zoneCompact),
    });
  }

  // Each player's positioning error, renewed every AI.posErrorSec or so.
  private refreshErrors(view: TeamView, time: number) {
    const e = this.skill.posError;
    for (const p of view.mates) {
      const cur = this.errors.get(p);
      if (cur && time < cur.until) continue;
      this.errors.set(p, {
        x: (view.rand() * 2 - 1) * e,
        y: (view.rand() * 2 - 1) * e,
        until: time + AI.posErrorSec * (0.75 + 0.5 * view.rand()),
      });
    }
  }

  // A target plus the player's positioning error, kept `margin` inside the
  // pitch (formation spots AI.edgeMargin; a man to mark may be anywhere).
  private withError(
    p: Player,
    at: { x: number; y: number },
    margin: number = AI.edgeMargin
  ) {
    const e = this.errors.get(p);
    return {
      x: clamp(at.x + (e?.x ?? 0), margin, PITCH.width - margin),
      y: clamp(at.y + (e?.y ?? 0), margin, PITCH.height - margin),
    };
  }

  // Give-and-go runs still going become 'run' orders (to their fixed
  // spot, flat out); a run ends when its time is up or its runner got the
  // ball or is the human's. Returns the players left to place.
  private applyRuns(players: readonly Player[], time: number) {
    let left = [...players];
    for (const [p, run] of this.runs) {
      if (time >= run.until || !left.includes(p)) {
        this.runs.delete(p);
        continue;
      }
      this.set(p, 'run', null, run.x, run.y, true);
      left = left.filter((q) => q !== p);
    }
    return left;
  }

  // Our ball. In order: give-and-go runners keep running; the deepest
  // player stays back goal-side of their most advanced one (rest defence,
  // when there is someone else to support); with our carrier under
  // pressure, the nearest comes short to a free spot (show); the forward
  // (else the furthest upfield) runs ahead of the ball (unless a
  // give-and-go run is on); the rest take their plan's pushed-up spots in
  // open space, clear of the carrier.
  private assignSupport(
    view: TeamView,
    ai: readonly Player[],
    prev: Map<Player, AiOrder>,
    time: number
  ) {
    const ball = view.ball;
    const carrier = ball.owner;
    let left = this.applyRuns(ai, time);
    const giveGo = this.runs.size > 0;
    const take = (p: Player) => {
      left = left.filter((q) => q !== p);
    };

    const danger = mostAdvanced(view.opponents, this.goalX);
    if (danger && left.length >= 2) {
      let back: Player | null = null;
      for (const p of left)
        if (!back || (p.x - back.x) * this.dir < 0) back = p;
      if (back) {
        this.set(back, 'rest', danger);
        take(back);
      }
    }

    if (
      carrier &&
      !carrier.holding &&
      left.length > 0 &&
      pressureOn(carrier, [...view.opponents, view.oppKeeper], time) >=
        AI.showPress
    ) {
      // The one already showing keeps the job (no swapping).
      const shower =
        left.find((p) => prev.get(p)?.role === 'show') ??
        nearest(left, carrier.x, carrier.y);
      const at = shower
        ? this.showSpot(view, carrier, shower, prev.get(shower))
        : null;
      if (shower && at) {
        this.set(shower, 'show', null, at.x, at.y);
        take(shower);
      }
    }

    // The runner: our forward goes ahead when we have the ball (else the
    // furthest upfield), at least style.runAhead in front of the ball, or
    // at its pushed-up spot if that is further.
    let runner: Player | null = null;
    if (!giveGo) {
      const forward = view.mates[this.formation.length - 1];
      runner = forward && left.includes(forward) ? forward : null;
      if (!runner)
        for (const p of left)
          if (!runner || p.x * this.dir > runner.x * this.dir) runner = p;
    }
    for (const p of left) {
      const spot = this.spot(view, p, 'attack');
      let { x, y } = spot;
      if (p === runner) {
        const ahead = ball.x + this.style.runAhead * this.dir;
        x = clamp(
          (spot.x - ahead) * this.dir > 0 ? spot.x : ahead,
          AI.edgeMargin,
          PITCH.width - AI.edgeMargin
        );
      }
      // Away from the nearest opponent ...
      const near = nearest(view.opponents, x, y);
      if (near) {
        const d = Math.hypot(x - near.x, y - near.y);
        if (d < AI.openDist) {
          const away = unit(x - near.x, y - near.y);
          x += away.x * (AI.openDist - d);
          y += away.y * (AI.openDist - d);
        }
      }
      // ... and not on top of the carrier.
      const dc = Math.hypot(x - ball.x, y - ball.y);
      if (dc < AI.supportMinDist) {
        const away = unit(x - ball.x, y - ball.y);
        x += away.x * (AI.supportMinDist - dc);
        y += away.y * (AI.supportMinDist - dc);
      }
      const at = this.withError(p, { x, y });
      this.set(p, p === runner ? 'run' : 'support', null, at.x, at.y);
    }
  }

  // A free spot to show for the ball: AI.showDist from the carrier, in one
  // of eight directions (those nearest the player first), with no opponent
  // close to it or to the pass line. The previous spot is kept while it is
  // still free and near the carrier. Null when none is free.
  private showSpot(
    view: TeamView,
    c: Player,
    p: Player,
    prev: AiOrder | undefined
  ) {
    const free = (x: number, y: number) =>
      x >= AI.edgeMargin &&
      x <= PITCH.width - AI.edgeMargin &&
      y >= AI.edgeMargin &&
      y <= PITCH.height - AI.edgeMargin &&
      view.opponents.every(
        (o) =>
          Math.hypot(o.x - x, o.y - y) >= AI.showClear &&
          distToSegment(o.x, o.y, c.x, c.y, x, y) >= AI.passLaneSafe / 2
      );
    if (
      prev &&
      prev.role === 'show' &&
      Math.hypot(prev.x - c.x, prev.y - c.y) < AI.showDist * 1.5 &&
      free(prev.x, prev.y)
    )
      return { x: prev.x, y: prev.y };
    const spots: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      spots.push({
        x: c.x + Math.cos(a) * AI.showDist,
        y: c.y + Math.sin(a) * AI.showDist,
      });
    }
    spots.sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)
    );
    for (const s of spots.slice(0, AI.showTries)) if (free(s.x, s.y)) return s;
    return null;
  }

  // Loose ball: whoever of ours reaches it first (the human included: then
  // no AI chases). An intended receiver of ours always goes for it. The
  // current chaser keeps the job unless someone is clearly quicker.
  private pickChaser(view: TeamView, prev: Map<Player, AiOrder>) {
    const { mates, human, ball } = view;
    const receiver = mates.find((p) => p.receiving);
    if (receiver) return receiver === human ? null : receiver;
    let best: Player | null = null;
    let bestT = Infinity;
    let current: Player | null = null;
    let currentT = Infinity;
    for (const p of mates) {
      const t = interceptPoint(p, ball).t;
      if (t < bestT) {
        best = p;
        bestT = t;
      }
      if (prev.get(p)?.role === 'chase') {
        current = p;
        currentT = t;
      }
    }
    if (current && current !== human && currentT < bestT + AI.chaseKeepSec)
      return current;
    return best === human ? null : best;
  }

  // How our chaser goes for the loose ball: flat out; jogging when no
  // opponent (their keeper included) can get there within AI.chaseRelaxSec
  // of it; and when an opponent will clearly get there first, in our half
  // or as the intended receiver of their pass, to a spot goal-side of where
  // they will take it (a defender in front of them instead of a hopeless
  // lunge at the ball or one arriving behind them). A pass's intended
  // receiver always goes for the ball itself.
  private chaseOrder(view: TeamView, p: Player): AiOrder {
    const ball = view.ball;
    const mine = interceptPoint(p, ball).t;
    let theirs = Infinity;
    let theirAt = { x: ball.x, y: ball.y };
    let theirReceiver = false;
    for (const o of [...view.opponents, view.oppKeeper]) {
      const meet = interceptPoint(o, ball);
      if (meet.t < theirs) {
        theirs = meet.t;
        theirAt = meet;
        theirReceiver = o.receiving;
      }
    }
    const order: AiOrder = {
      role: 'chase',
      mark: null,
      x: p.x,
      y: p.y,
      sprint: true,
      relax: false,
      goalSide: false,
    };
    const inOurHalf = Math.abs(theirAt.x - this.goalX) < PITCH.width / 2;
    if (
      !p.receiving &&
      (inOurHalf || theirReceiver) &&
      theirs + AI.chaseLoseSec < mine
    ) {
      const g = unit(this.goalX - theirAt.x, PITCH.height / 2 - theirAt.y);
      order.goalSide = true;
      order.x = theirAt.x + g.x * AI.pressGap;
      order.y = theirAt.y + g.y * AI.pressGap;
    } else if (theirs > mine + AI.chaseRelaxSec) {
      order.relax = true;
      order.sprint = false;
    }
    return order;
  }

  // Opponent on the ball: the AI player closest to the carrier presses,
  // unless our human is already close to it. The current (main) presser
  // keeps the job unless another is AI.pressKeep closer. A player the
  // carrier has got past (upfield of it) counts as AI.beatenPenalty
  // further away, so a goal-side teammate (usually the backup) steps up
  // and the beaten one recovers.
  private pickPresser(view: TeamView, ai: readonly Player[], carrier: Player) {
    const h = view.human;
    if (h && Math.hypot(h.x - carrier.x, h.y - carrier.y) < AI.humanPressDist) {
      this.mainPresser = null;
      return null;
    }
    let best: Player | null = null;
    let bestD = Infinity;
    let current: Player | null = null;
    let currentD = Infinity;
    for (const p of ai) {
      const d =
        Math.hypot(p.x - carrier.x, p.y - carrier.y) +
        ((p.x - carrier.x) * this.dir > AI.beatenMargin ? AI.beatenPenalty : 0);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
      if (p === this.mainPresser) {
        current = p;
        currentD = d;
      }
    }
    this.mainPresser =
      current && currentD < bestD + AI.pressKeep ? current : best;
    return this.mainPresser;
  }

  // How long the opposing carrier has been standing on the ball (0 if it
  // isn't, or it's ours / in a keeper's hands). Standing = slower than
  // AI.idleSpeed; it ends only once it moves off faster than
  // AI.idleBreakSpeed (no flicker on small steps).
  private carrierIdle(owner: Player | null, time: number) {
    if (!owner || owner.team === this.team || owner.holding) {
      this.idleCarrier = null;
      this.idleSince = null;
      return 0;
    }
    if (owner !== this.idleCarrier) {
      this.idleCarrier = owner;
      this.idleSince = null;
    }
    // (judged on how it was moving skill.readSec ago)
    const s = owner.seenAgo(this.skill.readSec);
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > AI.idleBreakSpeed) this.idleSince = null;
    else if (this.idleSince === null && speed < AI.idleSpeed)
      this.idleSince = time;
    return this.idleSince === null ? 0 : time - this.idleSince;
  }

  // Where the presser goes (worked out when thinking, so it reacts rather
  // than mirroring every step), from the carrier as it saw it skill.readSec
  // ago (a feint or a sudden turn isn't followed at once): goal-side of
  // where the carrier will be in AI.pressLeadSec, not following it back
  // when it retreats toward its own goal; pressGapClose off a slow carrier
  // up to pressGap off one on the move (x the plan's pressGapScale), and
  // further off (up to pressGapDeep, unless the plan presses high) the
  // deeper the carrier is in its own half: it contains and leaves room to
  // play out instead of shadowing. A carrier idle on the ball (AI.idleSec)
  // is attacked: the presser goes to the ball in front of it (`second`:
  // from behind).
  private pressPoint(c: Player, idleFor: number, second: boolean) {
    const s = c.seenAgo(this.skill.readSec);
    if (idleFor >= AI.idleSec) {
      const reach = (DRIBBLE.closeLead + AI.idleGap) * (second ? -1 : 1);
      return {
        x: s.x + Math.cos(s.heading) * reach,
        y: s.y + Math.sin(s.heading) * reach,
      };
    }
    const toGoal = unit(this.goalX - s.x, PITCH.height / 2 - s.y);
    const deep = this.style.pressHigh
      ? 0
      : clamp(
          (Math.abs(s.x - this.goalX) - AI.pressDeepFrom) /
            (AI.pressDeepFull - AI.pressDeepFrom),
          0,
          1
        );
    const gap = lerp(
      (AI.pressGapClose +
        (AI.pressGap - AI.pressGapClose) *
          clamp(Math.hypot(s.vx, s.vy) / PLAYER.walkWithBallSpeed, 0, 1)) *
        this.style.pressGapScale,
      AI.pressGapDeep,
      deep
    );
    let lx = s.vx * AI.pressLeadSec;
    let ly = s.vy * AI.pressLeadSec;
    const along = lx * toGoal.x + ly * toGoal.y; // < 0: retreating
    if (along < 0) {
      lx -= toGoal.x * along;
      ly -= toGoal.y * along;
    }
    // Show him wide: on the carrier's inside shoulder (toward the middle),
    // more the wider he is, none in the centre or near our goal (the box:
    // straight goal-side).
    const gy = PITCH.height / 2;
    const wide = clamp(Math.abs(s.y - gy) / AI.showWideFull, 0, 1);
    const far = clamp(
      (Math.abs(s.x - this.goalX) - AI.showWideNear) /
        (AI.showWideFar - AI.showWideNear),
      0,
      1
    );
    const inside = Math.sign(gy - s.y) * gap * AI.showWide * wide * far;
    return {
      x: s.x + lx + toGoal.x * gap,
      y: s.y + ly + toGoal.y * gap + inside,
    };
  }

  // The cover defender: behind the presser's spot on the line from the
  // carrier (as seen skill.readSec ago) to our goal centre, AI.backupGap
  // further back, never closer than AI.backupMinFromGoal to the goal (none
  // when the carrier is right at our goal). The nearest free player takes
  // it (the same one as last think unless another is AI.pressKeep closer),
  // never the plan's outlet forward, and only if someone is left over for
  // the zones. Sets its order; returns it.
  private pickBackup(
    view: TeamView,
    free: readonly Player[],
    carrier: Player,
    prev: Map<Player, AiOrder>
  ) {
    const outlet = this.style.outletForward
      ? view.mates[this.formation.length - 1]
      : undefined;
    const candidates = free.filter((p) => p !== outlet);
    if (candidates.length < 2) return null;
    const s = carrier.seenAgo(this.skill.readSec);
    const gy = PITCH.height / 2;
    const toGoal = Math.hypot(this.goalX - s.x, gy - s.y);
    const dist = Math.min(
      AI.pressGap * this.style.pressGapScale + AI.backupGap,
      toGoal - AI.backupMinFromGoal
    );
    if (dist < AI.backupMinGap) return null;
    const g = unit(this.goalX - s.x, gy - s.y);
    const at = { x: s.x + g.x * dist, y: s.y + g.y * dist };
    let best: Player | null = null;
    let bestD = Infinity;
    let current: Player | null = null;
    let currentD = Infinity;
    for (const p of candidates) {
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
      if (prev.get(p)?.role === 'backup') {
        current = p;
        currentD = d;
      }
    }
    const pick = current && currentD < bestD + AI.pressKeep ? current : best;
    if (!pick) return null;
    const spot = this.withError(pick, at);
    this.set(pick, 'backup', null, spot.x, spot.y, this.recovering(pick, view));
    return pick;
  }

  // Recovery run: caught upfield of the ball (further than the level's
  // recoverSlack) with the opponent on it, a defender sprints back (if it
  // has the stamina), never the plan's outlet forward.
  private recovering(p: Player, view: TeamView) {
    if (
      this.style.outletForward &&
      view.mates.indexOf(p) === this.formation.length - 1
    )
      return false;
    if (p.stamina < AI.saveStaminaBelow || p.sprintLocked) return false;
    return (p.x - view.ball.x) * this.dir > this.skill.recoverSlack;
  }

  // Zonal defence with a few markers. Opponents in the danger zone (within
  // AI.markZone of our goal line; one already marked keeps his marker a
  // little further out), nearest our goal first, get a marker each: at most
  // AI.maxMarkers, and never everyone (at least one player holds a zone).
  // A marker keeps its man between thinks (no swapping); otherwise the
  // nearest free player takes him. Everyone else defends a zone.
  private assignDefence(
    view: TeamView,
    free: readonly Player[],
    prev: Map<Player, AiOrder>
  ) {
    const ball = view.ball;
    const gy = PITCH.height / 2;
    const marked = new Set<Player>();
    for (const o of prev.values())
      if (o.role === 'mark' && o.mark) marked.add(o.mark);
    const threats = view.opponents
      .filter(
        (o) =>
          o !== ball.owner &&
          Math.abs(o.x - this.goalX) <
            AI.markZone + (marked.has(o) ? AI.markZoneKeep : 0)
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.goalX, a.y - gy) -
          Math.hypot(b.x - this.goalX, b.y - gy)
      );
    const left = [...free];
    const marks = Math.min(threats.length, AI.maxMarkers, left.length - 1);
    for (let i = 0; i < marks; i++) {
      const o = threats[i];
      if (!o) break;
      let pick = left.findIndex((p) => {
        const order = prev.get(p);
        return order?.role === 'mark' && order.mark === o;
      });
      if (pick < 0) {
        const at = this.markPoint(o, ball);
        let pickD = Infinity;
        left.forEach((p, j) => {
          const d = Math.hypot(p.x - at.x, p.y - at.y);
          if (d < pickD) {
            pick = j;
            pickD = d;
          }
        });
      }
      if (pick < 0) break;
      const p = left.splice(pick, 1)[0];
      // (a marker caught upfield of the ball sprints back to its man)
      if (p) this.set(p, 'mark', o, p.x, p.y, this.recovering(p, view));
    }
    for (const p of left) {
      const at = this.zoneSpot(view, p);
      if (this.recovering(p, view)) {
        // Recovery run: flat out, at least goal-side of the ball.
        const limit = ball.x - this.dir * AI.recoverGoalSide;
        if ((at.x - limit) * this.dir > 0)
          at.x = clamp(limit, AI.edgeMargin, PITCH.width - AI.edgeMargin);
        this.set(p, 'cover', null, at.x, at.y, true);
      } else {
        this.set(p, 'cover', null, at.x, at.y);
      }
    }
  }

  // Goal-side of the man, leaning toward the ball (to cut the pass), and
  // sagging off the further he is from the ball: tight near the ball, loose
  // away from it.
  private markPoint(o: Player, ball: Ball) {
    const g = unit(this.goalX - o.x, PITCH.height / 2 - o.y);
    const b = unit(ball.x - o.x, ball.y - o.y);
    const d = unit(g.x * 0.7 + b.x * 0.3, g.y * 0.7 + b.y * 0.3);
    const gap = Math.min(
      AI.markGapMax,
      AI.markGap * this.skill.markGapScale +
        AI.markSag * Math.hypot(ball.x - o.x, ball.y - o.y)
    );
    return { x: o.x + d.x * gap, y: o.y + d.y * gap };
  }

  // Rest defence: goal-side of their most advanced player, but never
  // further upfield than a little behind the ball.
  private restPoint(o: Player, ball: Ball) {
    const g = unit(this.goalX - o.x, PITCH.height / 2 - o.y);
    let x = o.x + g.x * AI.restGap;
    const y = o.y + g.y * AI.restGap;
    const limit = ball.x - this.dir * AI.restBehindBall;
    if ((x - limit) * this.dir > 0) x = limit;
    return { x, y };
  }

  // A pass, shot or clearance that is due now, for MatchScene to make (the
  // carrier must still have the ball).
  takeAction(time: number, ball: Ball) {
    const a = this.action;
    if (!a || time < a.at) return null;
    this.action = null;
    return ball.owner === a.p ? a : null;
  }

  // The presser goes in when the ball (where it will be when the lunge
  // starts) is within lunge reach and it is in front of or beside the
  // carrier (from behind it gets goal-side first: tackles from there mostly
  // fail); a chance per think (reaction and difficulty), more against a
  // carrier standing idle on the ball. Returns the lunge direction, or null.
  private wantsTackle(
    p: Player,
    carrier: Player,
    view: TeamView,
    time: number,
    idleFor: number
  ): number | null {
    if (!canTackle(p, time) || time < p.tackleReadyAt) return null;
    // Where it thinks the ball will be when the lunge lands: the carrier as
    // seen skill.readSec ago, the ball in front of it then, carried on at
    // its speed then. A carrier that has cut away since makes it lunge at
    // thin air (a feint works).
    const s = carrier.seenAgo(this.skill.readSec);
    const ball = view.ball;
    const ballGap = Math.hypot(ball.x - carrier.x, ball.y - carrier.y);
    const lead = TACKLE.windupSec + TACKLE.activeSec / 2;
    const bx = s.x + Math.cos(s.heading) * ballGap + s.vx * lead;
    const by = s.y + Math.sin(s.heading) * ballGap + s.vy * lead;
    const d = Math.hypot(bx - p.x, by - p.y);
    if (d > (TACKLE.lungeDist + TACKLE.reach * 0.6) * rulesOf(p).tackle)
      return null;
    const behind =
      Math.abs(angleDiff(Math.atan2(p.y - s.y, p.x - s.x), s.heading)) >
      TACKLE.frontArcDeg * DEG;
    if (behind) return null;
    const chance =
      idleFor >= AI.idleSec
        ? Math.min(0.95, this.skill.tackleChance * AI.idleTackleBoost)
        : this.skill.tackleChance;
    if (view.rand() >= chance) return null;
    p.tackleReadyAt = time + AI.tackleCooldownSec;
    return Math.atan2(by - p.y, bx - p.x);
  }

  // Our AI carrier: score the options, then dribble (an order for steer)
  // or schedule a pass / shot / clearance after the first touch settles.
  private carry(view: TeamView, c: Player, time: number) {
    const act = this.decideCarry(view, c, time);
    if (act.kind === 'dribble') {
      this.carryDir = { p: c, dir: Math.atan2(act.y - c.y, act.x - c.x) };
      this.orders.set(c, {
        role: 'carry',
        mark: null,
        x: act.x,
        y: act.y,
        sprint: act.sprint,
        relax: false,
        goalSide: false,
      });
      return;
    }
    this.carryDir = null;
    this.set(c, 'carry'); // stand while striking it
    if (!this.action)
      this.action = {
        p: c,
        act,
        at: Math.max(time, this.ownerSince + AI.carrySettleSec),
      };
  }

  // Utility scores for the carrier's options (each x (1 +- decisionNoise)).
  // Pressure (pressureOn: how soon an opponent can be on it) makes passing
  // and clearing more attractive and dribbling less.
  // - shoot: when the chance (shotQuality) is as good as the situation asks
  //   for: patient with space, at once when pressed or crowded; at the most
  //   open spot of the goal (shotTarget). A chip when the keeper is well
  //   off its line in the way (chipShot).
  // - pass: to feet (a teammate further forward, open, with a safe lane, at
  //   a sane distance), or a through ball into the path of one running
  //   upfield, when it gets there before any opponent can.
  // - dribble: upfield, cutting in toward goal further up, turned away from
  //   opponents close in front; worth more with space ahead.
  // - clear: a lofted kick upfield, the way out under pressure in our half
  //   (a keeper's fallback when no pass is on).
  private decideCarry(view: TeamView, c: Player, time: number): CarryAction {
    const { ball, rand } = view;
    const keeper = c.role === 'keeper';
    const oppGoalX = this.team === 'home' ? PITCH.width : 0;
    const goalY = PITCH.height / 2;
    const others = [...view.opponents, view.oppKeeper];
    const press = pressureOn(c, others, time);
    const noise = () => 1 + (rand() * 2 - 1) * this.skill.decisionNoise;
    let best: CarryAction = { kind: 'dribble', x: c.x, y: c.y, sprint: false };
    let bestScore = -Infinity;
    const offer = (score: number, act: CarryAction) => {
      const s = score * noise();
      if (s > bestScore) {
        bestScore = s;
        best = act;
      }
    };

    // Shoot: how good the chance is (shotQuality: distance, angle, how open
    // the goal is) against how good it has to be right now (user request:
    // not only from round the box). With time and space the carrier works
    // the ball closer for a cleaner finish; pressed, crowded (AI.crowdDist)
    // or with someone right in its way to goal it shoots at once, from
    // further out too (a keeper rushing out counts as pressure). How picky
    // each carrier is varies per possession (appetite): some shoot from
    // outside the box, some walk it in.
    const dGoal = Math.hypot(oppGoalX - c.x, goalY - c.y);
    if (!keeper && dGoal < AI.shootRange) {
      const aim = this.shotTarget(view, c, oppGoalX);
      // Not every shot is perfectly placed: pulled toward the centre by up
      // to the level's aim spread.
      const pull = Math.min(
        rand() * this.skill.aimSpread,
        Math.abs(aim.y - goalY)
      );
      const ty = aim.y - Math.sign(aim.y - goalY) * pull;
      const blocked = view.opponents.some(
        (o) =>
          distToSegment(o.x, o.y, ball.x, ball.y, oppGoalX, ty) < AI.laneBlock
      );
      const quality = shotQuality(c, oppGoalX, dGoal, aim.clear, blocked);
      let crowd = 0;
      for (const o of others)
        if (
          canTackle(o, time) &&
          !o.lying &&
          Math.hypot(o.x - c.x, o.y - c.y) < AI.crowdDist
        )
          crowd += 1;
      const wayBlocked =
        nearestAhead(
          others,
          c,
          unit(oppGoalX - c.x, goalY - c.y),
          AI.shotWayAhead
        ) !== null;
      const hurry = Math.max(
        press,
        clamp((crowd - 1) / 2, 0, 1),
        wayBlocked ? AI.shotBlockedHurry : 0
      );
      const want = lerp(AI.shotPatience, AI.shotHurry, hurry) * this.appetite;
      const charge = clamp(
        AI.shotCharge + (rand() * 2 - 1) * this.skill.shotChargeNoise,
        0.2,
        1
      );
      offer(AI.shotWeight * Math.min(AI.shotScoreCap, quality / want), {
        kind: 'shoot',
        x: oppGoalX,
        y: ty,
        charge,
        chip: 0,
      });
      const chip = this.chipShot(view, oppGoalX);
      if (chip) offer(chip.score - 0.4 * press, chip.act);
    }

    // Pass.
    for (const q of view.mates) {
      if (q === c) continue;
      const dist = Math.hypot(q.x - c.x, q.y - c.y);
      if (dist >= AI.passMin && dist <= AI.passMax) {
        const progress = clamp(((q.x - c.x) * this.dir) / 600, -1, 1);
        const marker = nearest(others, q.x, q.y);
        const open = marker
          ? clamp(Math.hypot(marker.x - q.x, marker.y - q.y) / 150, 0, 1)
          : 1;
        let lane = Infinity;
        for (const o of view.opponents)
          lane = Math.min(lane, distToSegment(o.x, o.y, c.x, c.y, q.x, q.y));
        const safe = clamp(lane / AI.passLaneSafe, 0, 1);
        offer(
          0.15 +
            this.style.passProgress * progress +
            0.3 * open +
            0.3 * safe -
            (dist > 500 ? 0.2 : 0) +
            0.3 * press,
          { kind: 'pass', to: q, through: false }
        );
      }
      // Through ball: into the run of a teammate going upfield.
      if (q.speed < AI.throughMinRun || q.vx * this.dir < 0.5 * q.speed)
        continue;
      const spot = throughSpot(ball.x, ball.y, q);
      const reach = Math.hypot(spot.x - c.x, spot.y - c.y);
      if (reach < AI.passMin || reach > AI.passMax) continue;
      const ours = Math.max(
        passTravelTime(Math.hypot(spot.x - ball.x, spot.y - ball.y)),
        Math.hypot(spot.x - q.x, spot.y - q.y) /
          (PLAYER.sprintSpeed * rulesOf(q).movement)
      );
      let theirs = Infinity;
      for (const o of others)
        theirs = Math.min(
          theirs,
          Math.max(
            0,
            Math.hypot(spot.x - o.x, spot.y - o.y) - POSSESSION.controlRadius
          ) /
            (PLAYER.sprintSpeed * rulesOf(o).movement)
        );
      const margin = theirs - ours;
      if (margin < this.style.throughMargin) continue;
      let lane = Infinity;
      for (const o of view.opponents)
        lane = Math.min(
          lane,
          distToSegment(o.x, o.y, c.x, c.y, spot.x, spot.y)
        );
      offer(
        0.2 +
          (this.style.passProgress + 0.1) *
            clamp(((spot.x - c.x) * this.dir) / 600, -1, 1) +
          0.3 * clamp(margin / 0.5, 0, 1) +
          0.15 * clamp(lane / AI.passLaneSafe, 0, 1) -
          (reach > 500 ? 0.2 : 0) +
          0.3 * press,
        { kind: 'pass', to: q, through: true }
      );
    }

    // Dribble (not a keeper). Just after winning the ball from them, with
    // space ahead: a counter-attack straight at goal.
    if (!keeper) {
      const counter = time - this.turnoverAt < AI.counterSec;
      let a = this.dribbleHeading(c, oppGoalX, counter);
      a += this.avoidTurn(c, others, a);
      // Eased from last think's direction (same carrier): no zig-zag.
      if (this.carryDir && this.carryDir.p === c)
        a =
          this.carryDir.dir + angleDiff(a, this.carryDir.dir) * AI.dribbleBlend;
      const fwd = { x: Math.cos(a), y: Math.sin(a) };
      const block = nearestAhead(others, c, fwd, AI.dribbleLook * 1.5);
      const space = block
        ? Math.hypot(block.x - c.x, block.y - c.y)
        : AI.dribbleLook * 1.5;
      offer(
        0.45 +
          0.5 * clamp(space / (AI.dribbleLook * 1.5), 0, 1) -
          0.4 * press +
          (counter && space >= AI.counterSpace ? AI.counterBonus : 0),
        {
          kind: 'dribble',
          x: clamp(
            c.x + fwd.x * AI.dribbleLook,
            AI.edgeMargin,
            PITCH.width - AI.edgeMargin
          ),
          y: clamp(
            c.y + fwd.y * AI.dribbleLook,
            AI.edgeMargin,
            PITCH.height - AI.edgeMargin
          ),
          sprint:
            space > AI.dribbleSprintSpace &&
            c.stamina > AI.saveStaminaBelow &&
            !c.sprintLocked,
        }
      );
    }

    // Clear.
    const ownHalf = (c.x - PITCH.width / 2) * this.dir < 0;
    offer(keeper ? 0.35 : ownHalf ? 0.05 + 0.5 * press : 0.05, {
      kind: 'clear',
      x: oppGoalX,
      y: goalY + (rand() * 2 - 1) * PITCH.height * 0.3,
    });
    return best;
  }

  // The most open spot in the goal: of AI.shotPoints spots across the mouth
  // (inside the posts), the one whose line from the carrier is furthest, by
  // angle, from the keeper and any defender in front of the carrier (minus
  // their width), with a little random preference. `clear` is that angle
  // in degrees.
  private shotTarget(view: TeamView, c: Player, oppGoalX: number) {
    const goalY = PITCH.height / 2;
    const spread = rulesOf(c).pitch.goalMouth / 2 - AI.shootInside;
    const blockers = [...view.opponents, view.oppKeeper].filter(
      (o) => Math.abs(oppGoalX - o.x) < Math.abs(oppGoalX - c.x)
    );
    let bestY = goalY;
    let bestClear = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < AI.shotPoints; i++) {
      const y = goalY - spread + (2 * spread * i) / (AI.shotPoints - 1);
      const line = Math.atan2(y - c.y, oppGoalX - c.x);
      let clear: number = AI.shotClearMaxDeg;
      for (const o of blockers) {
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < 1) continue;
        const width =
          Math.atan(
            (o.role === 'keeper' ? KEEPER.reach : PLAYER.bodyRadius) / d
          ) / DEG;
        const off =
          Math.abs(angleDiff(Math.atan2(o.y - c.y, o.x - c.x), line)) / DEG -
          width;
        clear = Math.min(clear, Math.max(0, off));
      }
      const score = clear + view.rand() * AI.shotPickNoiseDeg;
      if (score > bestScore) {
        bestScore = score;
        bestY = y;
        bestClear = clear;
      }
    }
    return { y: bestY, clear: bestClear };
  }

  // A chip over a keeper that has come well off its line and stands in the
  // way: the lowest charge whose lob passes over the keeper's reach and
  // still crosses the goal line under the bar (or lands just short and
  // bounces in), aimed at the middle of the goal. Null when there's no
  // such keeper or no charge does it.
  private chipShot(
    view: TeamView,
    oppGoalX: number
  ): { act: CarryAction; score: number } | null {
    const k = view.oppKeeper;
    const ball = view.ball;
    const kOut = Math.abs(k.x - oppGoalX);
    if (kOut < AI.chipKeeperOut || k.lying) return null;
    const goalY = PITCH.height / 2;
    const lx = oppGoalX - ball.x;
    const ly = goalY - ball.y;
    const len = Math.hypot(lx, ly);
    if (len < 1) return null;
    const ux = lx / len;
    const uy = ly / len;
    // The keeper's distance along the shot line and off it.
    const along = (k.x - ball.x) * ux + (k.y - ball.y) * uy;
    const lateral = Math.abs((k.x - ball.x) * uy - (k.y - ball.y) * ux);
    if (along < AI.chipMinGap || along >= len || lateral > AI.chipLateral)
      return null;
    const over = KEEPER.standReachHeight + AI.chipClearance;
    const under = rulesOf(ball).pitch.goalHeight - AI.chipUnderBar;
    const at = [along - KEEPER.reach, along, along + KEEPER.reach, len];
    for (let i = 0; ; i++) {
      const charge = AI.chipChargeMin + i * AI.chipChargeStep;
      if (charge > SHOOT.sweetSpot + 1e-6) break;
      const flight = chipFlight(charge, at, rulesOf(ball).power);
      const clears = flight.heights.slice(0, 3).every((z) => z > over);
      const atLine = flight.heights[3] ?? 0;
      const goes =
        atLine > 0 ? atLine < under : flight.landing >= len - AI.chipLandShort;
      if (!clears || !goes) continue;
      return {
        act: {
          kind: 'shoot',
          x: oppGoalX,
          y: goalY,
          charge: clamp(
            charge +
              (view.rand() * 2 - 1) * this.skill.shotChargeNoise * AI.chipNoise,
            0,
            SHOOT.sweetSpot
          ),
          chip: 1,
        },
        score: AI.chipScore + 0.4 * clamp((kOut - AI.chipKeeperOut) / 80, 0, 1),
      };
    }
    return null;
  }

  // The way to dribble before avoiding anyone (radians): straight upfield
  // in our part of the pitch, turning toward the goal from AI.cutInFrom of
  // the way up, fully at AI.cutInFull (keeps the width early instead of
  // running into the middle); straight at goal on a counter (`direct`).
  private dribbleHeading(c: Player, oppGoalX: number, direct: boolean) {
    const progress = ((c.x - this.goalX) * this.dir) / PITCH.width;
    const w = direct
      ? 1
      : clamp((progress - AI.cutInFrom) / (AI.cutInFull - AI.cutInFrom), 0, 1);
    const g = unit(oppGoalX - c.x, PITCH.height / 2 - c.y);
    return Math.atan2(lerp(0, g.y, w), lerp(this.dir, g.x, w));
  }

  // How far to turn a dribble heading `a` away from opponents close in
  // front (radians): each one ahead or beside within AI.avoidDist pushes
  // the run toward the side it isn't on, more the nearer and the more
  // ahead it is; at most AI.avoidMaxDeg. The other way if that would run
  // into a side wall.
  private avoidTurn(c: Player, others: readonly Player[], a: number) {
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    let side = 0; // + = turn to the left-hand side (-fy, fx)
    for (const o of others) {
      const ox = o.x - c.x;
      const oy = o.y - c.y;
      const d = Math.hypot(ox, oy);
      if (d < 1 || d >= AI.avoidDist) continue;
      const ahead = (ox * fx + oy * fy) / d; // 1 straight ahead, -1 behind
      if (ahead < -0.2) continue;
      const w =
        ((AI.avoidDist - d) / AI.avoidDist) * clamp((ahead + 0.2) / 1.2, 0, 1);
      const lateral = -ox * fy + oy * fx; // > 0: it is on the left-hand side
      side += (lateral > 0 ? -1 : 1) * w;
    }
    if (side === 0) return 0;
    let turn =
      clamp(side * AI.avoidTurnDeg, -AI.avoidMaxDeg, AI.avoidMaxDeg) * DEG;
    const inside = (y: number) =>
      y >= AI.edgeMargin && y <= PITCH.height - AI.edgeMargin;
    if (
      !inside(c.y + Math.sin(a + turn) * AI.dribbleLook) &&
      inside(c.y + Math.sin(a - turn) * AI.dribbleLook)
    )
      turn = -turn;
    return turn;
  }

  private set(
    p: Player,
    role: AiRole,
    mark: Player | null = null,
    x = p.x,
    y = p.y,
    sprint = false
  ) {
    this.orders.set(p, {
      role,
      mark,
      x,
      y,
      sprint,
      relax: false,
      goalSide: false,
    });
  }
}

// How good a shot from `c` would be, 0..1: about 1 point-blank and open,
// 0.65 at the edge of the box, 0.4 from 450 px, next to nothing from 750+.
// Distance (falling off from AI.shotNearDist to shotFarDist), angle (worse
// from wide) and how open its best spot in the goal is (`clearDeg`); a
// line through a defender is mostly blocked.
function shotQuality(
  c: Player,
  oppGoalX: number,
  dGoal: number,
  clearDeg: number,
  blocked: boolean
) {
  const dist =
    clamp(
      1 - (dGoal - AI.shotNearDist) / (AI.shotFarDist - AI.shotNearDist),
      0,
      1
    ) ** 1.5;
  const wide =
    Math.abs(c.y - PITCH.height / 2) / Math.max(1, Math.abs(oppGoalX - c.x));
  const angle = clamp(1 - (wide - 0.5) / 1.5, 0.15, 1);
  const open =
    (0.35 + 0.65 * clamp(clearDeg / AI.shotClearDeg, 0, 1)) *
    (blocked ? AI.shotBlockedFactor : 1);
  return dist * angle * open;
}

// How hard `c` is pressed, 0..1, from the soonest any opponent able to act
// (not in a tackle, staggered or down) could be on it: its distance (less
// AI.pressureReach) over a closing speed of AI.pressureBaseSpeed plus a
// share of how fast it is already coming (one sprinting in counts as nearer
// than one standing or jockeying). 1 when that is AI.pressureSec or sooner,
// 0 from AI.pressureFarSec. Opponents already in a tackle don't count: the
// answer to a tackle is a juke (passing every time a tackle started made
// tackles useless).
export function pressureOn(
  c: Player,
  opponents: readonly Player[],
  time: number
) {
  let soonest = Infinity;
  for (const o of opponents) {
    if (!canTackle(o, time) || o.lying) continue;
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const d = Math.hypot(dx, dy);
    const ux = d > 0 ? dx / d : 0;
    const uy = d > 0 ? dy / d : 0;
    const closing = (o.vx - c.vx) * ux + (o.vy - c.vy) * uy;
    const speed =
      AI.pressureBaseSpeed + AI.pressureClosing * Math.max(0, closing);
    soonest = Math.min(soonest, Math.max(0, d - AI.pressureReach) / speed);
  }
  return clamp(
    (AI.pressureFarSec - soonest) / (AI.pressureFarSec - AI.pressureSec),
    0,
    1
  );
}

// Where (and when) `p` can first meet the ball: its roll is predicted in
// small steps (ground drag and friction, kept inside the pitch) and the
// first point the player could reach at a sprint by then is taken. A
// carried ball is met at the carrier.
export function interceptPoint(p: Player, ball: Ball) {
  if (ball.owner) {
    const d = Math.hypot(ball.owner.x - p.x, ball.owner.y - p.y);
    return {
      x: ball.owner.x,
      y: ball.owner.y,
      t: d / (PLAYER.sprintSpeed * rulesOf(p).movement),
    };
  }
  let bx = ball.x;
  let by = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  const keep = Math.pow(BALL.groundDrag, PREDICT_STEP);
  for (let t = 0; t <= AI.interceptMaxSec; t += PREDICT_STEP) {
    const gap = Math.hypot(bx - p.x, by - p.y) - POSSESSION.controlRadius;
    if (gap <= PLAYER.sprintSpeed * rulesOf(p).movement * t)
      return { x: bx, y: by, t };
    const speed = Math.hypot(vx, vy);
    if (speed < 1) {
      // It has stopped: run the rest of the way.
      return {
        x: bx,
        y: by,
        t: t + gap / (PLAYER.sprintSpeed * rulesOf(p).movement),
      };
    }
    const next = Math.max(0, speed * keep - BALL.rollFriction * PREDICT_STEP);
    vx *= next / speed;
    vy *= next / speed;
    bx = clamp(bx + vx * PREDICT_STEP, 0, PITCH.width);
    by = clamp(by + vy * PREDICT_STEP, 0, PITCH.height);
  }
  const gap = Math.hypot(bx - p.x, by - p.y);
  return {
    x: bx,
    y: by,
    t: AI.interceptMaxSec + gap / (PLAYER.sprintSpeed * rulesOf(p).movement),
  };
}

// Stick toward a target: stand when there, walk slower when close, sprint
// when far (chasers and pressers sooner, any `urgent` order), saving
// stamina when low; `relaxed` never sprints (a chaser sure to win the race).
// `calm` (positioning jobs): once standing at its spot, a player only sets
// off again when the spot is AI.restartDist away (no fidgeting).
function arrive(
  p: Player,
  tx: number,
  ty: number,
  urgent: boolean,
  relaxed: boolean,
  calm: boolean
): Steer {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < AI.arriveDist) return STAND;
  if (calm && p.speed < AI.settledSpeed && d < AI.restartDist) return STAND;
  const tired = p.stamina < AI.saveStaminaBelow || p.sprintLocked;
  const sprint =
    !relaxed &&
    ((urgent && d > AI.sprintChase) ||
      (!tired && d > AI.sprintFar && p.stamina > STAMINA.unlockAt));
  const r = sprint ? 1 : clamp(d / AI.slowDist, 0.2, 0.8);
  return { move: { x: dx / d, y: dy / d, r }, sprint };
}

function unit(x: number, y: number) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

// The closest player within `look` in front of `c` (within 60 degrees of fwd).
function nearestAhead(
  players: readonly Player[],
  c: Player,
  fwd: { x: number; y: number },
  look: number
) {
  let best: Player | null = null;
  let bestD = look;
  for (const o of players) {
    const ox = o.x - c.x;
    const oy = o.y - c.y;
    const d = Math.hypot(ox, oy);
    if (d < bestD && (ox * fwd.x + oy * fwd.y) / (d || 1) > 0.5) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function nearest(players: readonly Player[], x: number, y: number) {
  let best: Player | null = null;
  let bestD = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

// The player closest to the goal line at `goalX` (their most advanced, seen
// from that goal).
function mostAdvanced(players: readonly Player[], goalX: number) {
  let best: Player | null = null;
  let bestD = Infinity;
  for (const p of players) {
    const d = Math.abs(p.x - goalX);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
