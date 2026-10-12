import {
  AI,
  BALL,
  FORMATION,
  PITCH,
  PLAYER,
  POSSESSION,
  STAMINA,
  TACKLE,
} from '../../shared/tuning';
import type { Team } from '../../shared/types';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import type { StickInput } from './Controls';
import { DEG, angleDiff, clamp, distToSegment } from './geometry';
import { canTackle } from './tackle';

// Shared outfield AI (Phase 3), the same for both teams. A TeamBrain hands
// out roles a few times a second (think); every fixed step each AI player
// steers toward its role's target (steer), and the normal movement code
// moves it: same speeds, turning and stamina as the human, no teleports.
//
// Roles:
// - chase: the one player per team quickest to a loose ball runs to where
//   it can meet it (the intended receiver of a pass, if it's ours).
// - press: with the opponent on the ball, one player closes the carrier
//   down, jockeys goal-side of it and goes in for tackles (wantsTackle).
// - mark: goal-side of an opponent, leaning toward the ball (cuts lanes).
// - cover: a formation spot, dropped back and shifted with the ball.
// - support: a formation spot pushed upfield and moved into open space.
// - run: the furthest-forward supporter runs into space ahead of the ball.
// - carry: has the ball. It scores shoot / pass / dribble / clear
//   (decideCarry) with about 10% random variation and either dribbles
//   (steer) or hands MatchScene a pass or shot to make (takeAction).
// The human's player is never steered; it still counts: our player near
// the carrier is our presser, and our player quickest to a loose ball is
// our chaser.
export type AiRole =
  'chase' | 'press' | 'mark' | 'cover' | 'support' | 'run' | 'carry';

export type AiOrder = {
  role: AiRole;
  mark: Player | null; // the opponent marked (role 'mark')
  x: number; // target for cover / support / run / carry (set when thinking)
  y: number;
  sprint: boolean; // carry: sprint with the ball
};

// What an AI carrier does with the ball.
export type CarryAction =
  | { kind: 'dribble'; x: number; y: number; sprint: boolean }
  | { kind: 'pass'; to: Player }
  | { kind: 'shoot'; x: number; y: number; charge: number }
  | { kind: 'clear'; x: number; y: number }; // a lofted kick upfield

// How sharp a team's AI is: a row of LEVELS (the CPU by difficulty; our
// teammates at normal).
export type BrainSkill = {
  thinkSec: number; // how often it re-thinks (reaction)
  tackleChance: number; // chance to go in per think while in range
  shotChargeNoise: number; // shot charge spread around AI.shotCharge
  decisionNoise: number; // carrier option scores x (1 +- this)
  passErrorScale: number; // x the pass aim error
  aimSpread: number; // shot placement spread toward the centre (px)
  markGapScale: number; // x AI.markGap
};

export type TeamView = {
  mates: readonly Player[]; // outfield players, in FORMATION order
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
  private readonly dir: number; // +1 attacking toward x = PITCH.width
  private readonly goalX: number; // own goal line

  constructor(
    readonly team: Team,
    readonly skill: BrainSkill
  ) {
    this.dir = team === 'home' ? 1 : -1;
    this.goalX = team === 'home' ? 0 : PITCH.width;
  }

  // Think again on the next step (control changed, kickoff, ...).
  wake() {
    this.nextThinkAt = 0;
  }

  think(view: TeamView, time: number) {
    if (time < this.nextThinkAt) return;
    this.nextThinkAt = time + this.skill.thinkSec;
    const { mates, human, ball } = view;
    const owner = ball.owner;
    if (owner !== this.lastOwner) {
      this.lastOwner = owner;
      this.ownerSince = time;
    }
    const ai = mates.filter((p) => p !== human && p !== owner);
    const prev = new Map(this.orders);
    this.orders.clear();
    if (this.action && this.action.p !== owner) this.action = null;
    // Our AI carrier (a keeper with the ball at its feet too) decides.
    if (owner && owner.team === this.team && owner !== human && !owner.holding)
      this.carry(view, owner, time);

    const phase: 'attack' | 'defend' | 'loose' = !owner
      ? 'loose'
      : owner.team === this.team
        ? 'attack'
        : 'defend';

    if (phase === 'attack') {
      this.assignSupport(view, ai);
      return;
    }

    let free = ai;
    if (phase === 'loose') {
      const chaser = this.pickChaser(view, prev);
      if (chaser) {
        this.set(chaser, 'chase');
        free = free.filter((p) => p !== chaser);
      }
    } else if (owner && !owner.holding) {
      const presser = this.pickPresser(view, free, owner, prev);
      if (presser) {
        this.set(presser, 'press');
        free = free.filter((p) => p !== presser);
        const dir = view.canTackle
          ? this.wantsTackle(presser, owner, view, time)
          : null;
        if (dir !== null) this.tackles.push({ p: presser, dir });
      }
    }
    if (phase === 'defend') this.assignMarks(view, free);
    else
      for (const p of free) {
        const spot = this.spot(view, p, 'loose');
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
    let urgent = false;
    if (order.role === 'chase') {
      const meet = interceptPoint(p, ball);
      tx = meet.x;
      ty = meet.y;
      urgent = true;
    } else if (order.role === 'press') {
      const c = ball.owner;
      if (!c) return STAND;
      const toGoal = unit(this.goalX - c.x, PITCH.height / 2 - c.y);
      // Closer to a slow carrier (no shielding forever), jockeying back
      // at the carrier's pace.
      const gap =
        AI.pressGapClose +
        (AI.pressGap - AI.pressGapClose) *
          clamp(c.speed / PLAYER.walkWithBallSpeed, 0, 1);
      tx = c.x + c.vx * AI.pressLeadSec + toGoal.x * gap;
      ty = c.y + c.vy * AI.pressLeadSec + toGoal.y * gap;
      urgent = true;
    } else if (order.role === 'mark' && order.mark) {
      const at = this.markPoint(order.mark, ball);
      tx = at.x;
      ty = at.y;
    }
    if (!urgent) {
      // Spread out: teammates too close push the target away.
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
    return arrive(p, tx, ty, urgent);
  }

  // A formation spot, slid with the ball and pushed up or dropped back.
  private spot(
    view: TeamView,
    p: Player,
    phase: 'attack' | 'defend' | 'loose'
  ) {
    const i = view.mates.indexOf(p);
    const base = FORMATION.outfield[i] ?? FORMATION.outfield[0];
    const bx = this.team === 'home' ? base.x : PITCH.width - base.x;
    const push =
      phase === 'attack'
        ? AI.attackPush
        : phase === 'defend'
          ? -AI.defendDrop
          : 0;
    const ball = view.ball;
    return {
      x: clamp(
        bx + (ball.x - PITCH.width / 2) * AI.shiftX + push * this.dir,
        AI.edgeMargin,
        PITCH.width - AI.edgeMargin
      ),
      y: clamp(
        base.y + (ball.y - PITCH.height / 2) * AI.shiftY,
        AI.edgeMargin,
        PITCH.height - AI.edgeMargin
      ),
    };
  }

  // Our ball: supporters take pushed-up spots moved into open space, clear
  // of the carrier; the one furthest upfield runs ahead of the ball.
  private assignSupport(view: TeamView, ai: readonly Player[]) {
    const ball = view.ball;
    let runner: Player | null = null;
    for (const p of ai)
      if (!runner || p.x * this.dir > runner.x * this.dir) runner = p;
    for (const p of ai) {
      const spot = this.spot(view, p, 'attack');
      let { x, y } = spot;
      if (p === runner)
        x = clamp(
          ball.x + AI.runAhead * this.dir,
          AI.edgeMargin,
          PITCH.width - AI.edgeMargin
        );
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
      this.set(
        p,
        p === runner ? 'run' : 'support',
        null,
        clamp(x, AI.edgeMargin, PITCH.width - AI.edgeMargin),
        clamp(y, AI.edgeMargin, PITCH.height - AI.edgeMargin)
      );
    }
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

  // Opponent on the ball: the AI player closest to the goal-side contain
  // point presses, unless our human is already close to the carrier.
  private pickPresser(
    view: TeamView,
    ai: readonly Player[],
    carrier: Player,
    prev: Map<Player, AiOrder>
  ) {
    const h = view.human;
    if (h && Math.hypot(h.x - carrier.x, h.y - carrier.y) < AI.humanPressDist)
      return null;
    let best: Player | null = null;
    let bestD = Infinity;
    let current: Player | null = null;
    let currentD = Infinity;
    for (const p of ai) {
      const d = Math.hypot(p.x - carrier.x, p.y - carrier.y);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
      if (prev.get(p)?.role === 'press') {
        current = p;
        currentD = d;
      }
    }
    if (current && currentD < bestD + AI.pressKeep) return current;
    return best;
  }

  // The rest mark the most dangerous opponents (closest to our goal), each
  // taken by the nearest free player; anyone left over covers.
  private assignMarks(view: TeamView, free: readonly Player[]) {
    const ball = view.ball;
    const threats = view.opponents
      .filter((o) => o !== ball.owner)
      .sort((a, b) => Math.abs(a.x - this.goalX) - Math.abs(b.x - this.goalX));
    const left = [...free];
    for (const o of threats) {
      if (left.length === 0) break;
      const at = this.markPoint(o, ball);
      let pick = 0;
      let pickD = Infinity;
      left.forEach((p, i) => {
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        if (d < pickD) {
          pick = i;
          pickD = d;
        }
      });
      const p = left.splice(pick, 1)[0];
      if (p) this.set(p, 'mark', o);
    }
    for (const p of left) {
      const spot = this.spot(view, p, 'defend');
      this.set(p, 'cover', null, spot.x, spot.y);
    }
  }

  // Goal-side of the man, leaning toward the ball (to cut the pass).
  private markPoint(o: Player, ball: Ball) {
    const g = unit(this.goalX - o.x, PITCH.height / 2 - o.y);
    const b = unit(ball.x - o.x, ball.y - o.y);
    const d = unit(g.x * 0.7 + b.x * 0.3, g.y * 0.7 + b.y * 0.3);
    const gap = AI.markGap * this.skill.markGapScale;
    return { x: o.x + d.x * gap, y: o.y + d.y * gap };
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
  // starts) is within lunge reach; a chance per think (reaction and
  // difficulty), much lower from behind the carrier. Returns the lunge
  // direction, or null.
  private wantsTackle(
    p: Player,
    carrier: Player,
    view: TeamView,
    time: number
  ): number | null {
    if (!canTackle(p, time) || time < p.tackleReadyAt) return null;
    const ball = view.ball;
    const lead = TACKLE.windupSec + TACKLE.activeSec / 2;
    const bx = ball.x + ball.vx * lead;
    const by = ball.y + ball.vy * lead;
    const d = Math.hypot(bx - p.x, by - p.y);
    if (d > TACKLE.lungeDist + TACKLE.reach * 0.6) return null;
    const behind =
      Math.abs(
        angleDiff(Math.atan2(p.y - carrier.y, p.x - carrier.x), carrier.heading)
      ) >
      TACKLE.frontArcDeg * DEG;
    const chance =
      this.skill.tackleChance * (behind ? AI.tackleBehindFactor : 1);
    if (view.rand() >= chance) return null;
    p.tackleReadyAt = time + AI.tackleCooldownSec;
    return Math.atan2(by - p.y, bx - p.x);
  }

  // Our AI carrier: score the options, then dribble (an order for steer)
  // or schedule a pass / shot / clearance after the first touch settles.
  private carry(view: TeamView, c: Player, time: number) {
    const act = this.decideCarry(view, c, time);
    if (act.kind === 'dribble') {
      this.orders.set(c, {
        role: 'carry',
        mark: null,
        x: act.x,
        y: act.y,
        sprint: act.sprint,
      });
      return;
    }
    this.set(c, 'carry'); // stand while striking it
    if (!this.action)
      this.action = {
        p: c,
        act,
        at: Math.max(time, this.ownerSince + AI.carrySettleSec),
      };
  }

  // Utility scores for the carrier's options (each x (1 +- decisionNoise)):
  // - shoot: close to goal, a clear line, not from too wide an angle; aims
  //   inside the post away from the keeper;
  // - pass: a teammate further forward, open, with a safe lane, at a sane
  //   distance (more attractive under pressure);
  // - dribble: toward goal round whoever is in the way, worth more with
  //   space ahead and less under pressure;
  // - clear: a lofted kick upfield, the way out under pressure in our half
  //   (a keeper's fallback when no pass is on).
  private decideCarry(view: TeamView, c: Player, time: number): CarryAction {
    const { ball, rand } = view;
    const keeper = c.role === 'keeper';
    const oppGoalX = this.team === 'home' ? PITCH.width : 0;
    const goalY = PITCH.height / 2;
    const others = [...view.opponents, view.oppKeeper];
    // Pressure only from opponents able to act (not staggered by a lost
    // tackle or down after a dive / failed tackle).
    const near = nearest(
      others.filter((o) => time >= o.staggerUntil && !o.lying),
      c.x,
      c.y
    );
    const pressure = near ? Math.hypot(near.x - c.x, near.y - c.y) : Infinity;
    const pressured = pressure < AI.pressureNear;
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

    // Shoot.
    const dGoal = Math.hypot(oppGoalX - c.x, goalY - c.y);
    if (!keeper && dGoal < AI.shootRange) {
      const side = view.oppKeeper.y > goalY ? -1 : 1;
      // Inside the post away from the keeper, pulled toward the centre by
      // up to the level's aim spread (not every shot is a perfect corner).
      const ty =
        goalY +
        side *
          (PITCH.goalMouth / 2 -
            AI.shootInside -
            rand() * this.skill.aimSpread);
      const blocked = view.opponents.some(
        (o) =>
          distToSegment(o.x, o.y, ball.x, ball.y, oppGoalX, ty) < AI.laneBlock
      );
      const wide =
        Math.abs(c.y - goalY) / Math.max(1, Math.abs(oppGoalX - c.x));
      const charge = clamp(
        AI.shotCharge + (rand() * 2 - 1) * this.skill.shotChargeNoise,
        0.2,
        1
      );
      offer(
        1.7 * (1 - dGoal / AI.shootRange) +
          (blocked ? -0.8 : 0.45) -
          0.6 * clamp(wide - 1, 0, 1),
        { kind: 'shoot', x: oppGoalX, y: ty, charge }
      );
    }

    // Pass.
    for (const q of view.mates) {
      if (q === c) continue;
      const dist = Math.hypot(q.x - c.x, q.y - c.y);
      if (dist < AI.passMin || dist > AI.passMax) continue;
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
          0.5 * progress +
          0.3 * open +
          0.3 * safe -
          (dist > 500 ? 0.2 : 0) +
          (pressured ? 0.3 : 0),
        { kind: 'pass', to: q }
      );
    }

    // Dribble (not a keeper): toward goal, round the nearest player in the way.
    if (!keeper) {
      const fwd = unit(oppGoalX - c.x, goalY - c.y);
      let tx = c.x + fwd.x * AI.dribbleLook;
      let ty = c.y + fwd.y * AI.dribbleLook;
      const block = nearestAhead(others, c, fwd, AI.dribbleLook * 1.5);
      const space = block
        ? Math.hypot(block.x - c.x, block.y - c.y)
        : AI.dribbleLook * 1.5;
      if (block && space < AI.dribbleLook) {
        // Sidestep to the side it isn't on (the other way near a wall).
        const px = -fwd.y;
        const py = fwd.x;
        let s = (block.x - c.x) * px + (block.y - c.y) * py > 0 ? -1 : 1;
        const sy = ty + py * s * AI.dribbleDodge;
        if (sy < AI.edgeMargin || sy > PITCH.height - AI.edgeMargin) s = -s;
        tx += px * s * AI.dribbleDodge;
        ty += py * s * AI.dribbleDodge;
      }
      offer(
        0.45 +
          0.5 * clamp(space / (AI.dribbleLook * 1.5), 0, 1) -
          (pressured ? 0.4 : 0),
        {
          kind: 'dribble',
          x: clamp(tx, AI.edgeMargin, PITCH.width - AI.edgeMargin),
          y: clamp(ty, AI.edgeMargin, PITCH.height - AI.edgeMargin),
          sprint:
            space > AI.dribbleSprintSpace &&
            c.stamina > AI.saveStaminaBelow &&
            !c.sprintLocked,
        }
      );
    }

    // Clear.
    const ownHalf = (c.x - PITCH.width / 2) * this.dir < 0;
    offer(keeper ? 0.35 : pressured && ownHalf ? 0.55 : 0.05, {
      kind: 'clear',
      x: oppGoalX,
      y: goalY + (rand() * 2 - 1) * PITCH.height * 0.3,
    });
    return best;
  }

  private set(
    p: Player,
    role: AiRole,
    mark: Player | null = null,
    x = p.x,
    y = p.y
  ) {
    this.orders.set(p, { role, mark, x, y, sprint: false });
  }
}

// Where (and when) `p` can first meet the ball: its roll is predicted in
// small steps (ground drag and friction, kept inside the pitch) and the
// first point the player could reach at a sprint by then is taken. A
// carried ball is met at the carrier.
export function interceptPoint(p: Player, ball: Ball) {
  if (ball.owner) {
    const d = Math.hypot(ball.owner.x - p.x, ball.owner.y - p.y);
    return { x: ball.owner.x, y: ball.owner.y, t: d / PLAYER.sprintSpeed };
  }
  let bx = ball.x;
  let by = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  const keep = Math.pow(BALL.groundDrag, PREDICT_STEP);
  for (let t = 0; t <= AI.interceptMaxSec; t += PREDICT_STEP) {
    const gap = Math.hypot(bx - p.x, by - p.y) - POSSESSION.controlRadius;
    if (gap <= PLAYER.sprintSpeed * t) return { x: bx, y: by, t };
    const speed = Math.hypot(vx, vy);
    if (speed < 1) {
      // It has stopped: run the rest of the way.
      return { x: bx, y: by, t: t + gap / PLAYER.sprintSpeed };
    }
    const next = Math.max(0, speed * keep - BALL.rollFriction * PREDICT_STEP);
    vx *= next / speed;
    vy *= next / speed;
    bx = clamp(bx + vx * PREDICT_STEP, 0, PITCH.width);
    by = clamp(by + vy * PREDICT_STEP, 0, PITCH.height);
  }
  const gap = Math.hypot(bx - p.x, by - p.y);
  return { x: bx, y: by, t: AI.interceptMaxSec + gap / PLAYER.sprintSpeed };
}

// Stick toward a target: stand when there, walk slower when close, sprint
// when far (chasers and pressers sooner), saving stamina when low.
function arrive(p: Player, tx: number, ty: number, urgent: boolean): Steer {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < AI.arriveDist) return STAND;
  const tired = p.stamina < AI.saveStaminaBelow || p.sprintLocked;
  const sprint =
    (urgent && d > AI.sprintChase) ||
    (!tired && d > AI.sprintFar && p.stamina > STAMINA.unlockAt);
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
