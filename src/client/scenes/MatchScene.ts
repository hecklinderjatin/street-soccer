import Phaser from 'phaser';
import {
  BALL,
  FORMATION,
  INPUT,
  KEEPER,
  PASS,
  PITCH,
  SHOOT,
  STICK,
} from '../../shared/tuning';
import type { MatchConfig, MatchResult } from '../../shared/types';
import { createBallTexture } from '../art/ballArt';
import { PLAYER_HEIGHT, createPlayerTextures } from '../art/playerArt';
import { Ball } from '../entities/Ball';
import { Player } from '../entities/Player';
import { Court } from '../render/Court';
import { Projector, newProjected } from '../render/Projector';
import {
  isPerfectCharge,
  shotLabel,
  shotShape,
  choosePassTarget,
  kickPass,
  kickShot,
  shotDirection,
} from '../systems/actions';
import { collideBall, stepFreeBall } from '../systems/ballPhysics';
import { CameraRig } from '../systems/CameraRig';
import { Controls, type StickInput } from '../systems/Controls';
import { FixedStep } from '../systems/FixedStep';
import { clamp } from '../systems/geometry';
import {
  cpuKeeperReact,
  keepInBox,
  startDive,
  stepDummyKeeper,
  stepKeeperBody,
} from '../systems/keeper';
import { separatePlayers } from '../systems/collisions';
import { MatchFlow } from '../systems/MatchFlow';
import { constrainMove, stepPlayer } from '../systems/movement';
import { releaseBall, stepPossession } from '../systems/possession';
import { PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import type { HudData, MatchHudState } from './HudScene';

const NO_MOVE: StickInput = { x: 0, y: 0, r: 0 };
const realNow = () => performance.now() / 1000;
const AIM_AT = newProjected();
const SHOT_TEXT_DEPTH = 3e6; // above players, markers and the stamina bar
// Controlled-player ground marker (ring, pointer and charge gauge).
const RING_RADIUS = 44; // the ground marker ring round the controlled player, world px
const RING_POINTS = 40;
const GAUGE_SEGMENTS = 24; // segments of the charge gauge round the ring
const ARROW_HEAD_BACK = 18; // arrow head strokes run back this far from the tip ...
const ARROW_HEAD_SIDE = 12; // ... and out to the side this far

// A match on the street court, seen through the broadcast camera.
// The simulation runs at a fixed 60 Hz (FixedStep) on the flat ground plane;
// rendering interpolates and projects every frame. Per step, in the plan's
// order: input -> (AI) -> move players -> move ball -> possession ->
// actions (pass, shoot, switch) -> match flow. Per frame: camera, then draw.
//
// Phase 2: the home team (4 outfield, 2-1-1) plus a stand-in keeper in each
// goal. Teammates hold their spots unless receiving a pass; Phase 3 adds the
// away outfield team, AI, tackles and the real goalkeepers.
export class MatchScene extends Phaser.Scene {
  private config!: MatchConfig;
  private readonly fixed = new FixedStep();
  private readonly projector = new Projector();
  private controls!: Controls;
  private court!: Court;
  private ball!: Ball;
  private home: Player[] = []; // outfield players
  private homeKeeper!: Player;
  private awayKeeper!: Player;
  private everyone: Player[] = [];
  private controlled!: Player;
  private flow!: MatchFlow;
  private rig!: CameraRig;
  private hudState!: MatchHudState;
  private aimArrow!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Graphics; // ring + pointer + charge gauge under the controlled player
  private shotText!: Phaser.GameObjects.BitmapText; // the swipe shape, above the shooter

  private simTime = 0;
  private stats = { shots: 0, passes: 0 };
  private followShotUntil = -Infinity; // sim time: until then control follows the player closest to the loose ball (after a shot)
  private pendingPass: { passer: Player; receiver: Player; at: number } | null =
    null;
  private outRestart: { keeper: Player; at: number } | null = null; // goal kick after the ball went out
  private chargeSince: number | null = null; // real time the shot charge started
  private lastSwitchAt = -Infinity;
  private switchCycle: Player[] = [];
  private switchIndex = 0;
  private switchHoldArmed = false; // a SWITCH press that, held on, jumps to the keeper
  private resultShown = false;

  constructor() {
    super('Match');
  }

  // Phaser reuses this scene object on every restart, so reset per-match state here.
  init(data: MatchConfig) {
    this.config = data;
    this.fixed.reset();
    this.home = [];
    this.everyone = [];
    this.simTime = 0;
    this.stats = { shots: 0, passes: 0 };
    this.pendingPass = null;
    this.followShotUntil = -Infinity;
    this.outRestart = null;
    this.chargeSince = null;
    this.lastSwitchAt = -Infinity;
    this.switchCycle = [];
    this.switchIndex = 0;
    this.switchHoldArmed = false;
    this.resultShown = false;
  }

  create() {
    createPlayerTextures(this);
    createBallTexture(this);
    this.court = new Court(this);

    this.home = FORMATION.outfield.map(
      (s) => new Player(this, 'home', 'outfield', s.x, s.y)
    );
    const k = FORMATION.keeper;
    this.homeKeeper = new Player(this, 'home', 'keeper', k.x, k.y);
    this.awayKeeper = new Player(
      this,
      'away',
      'keeper',
      PITCH.width - k.x,
      k.y
    );
    this.everyone = [...this.home, this.homeKeeper, this.awayKeeper];
    this.ball = new Ball(this);
    this.aimArrow = this.add.graphics();
    this.marker = this.add.graphics();
    this.shotText = pixelText(this, 0, 0, '', 0.6 * PX, PAL.white)
      .setOrigin(0.5, 1)
      .setDepth(SHOT_TEXT_DEPTH)
      .setVisible(false);
    this.controlled = this.forward;

    this.flow = new MatchFlow();
    this.controls = new Controls();
    this.controls.bindKeyboard(this);
    this.rig = new CameraRig(this.projector);
    this.resetForKickoff();
    this.rig.snapTo(this.ball.x, this.ball.y);

    this.hudState = {
      home: 0,
      away: 0,
      clock: this.flow.clock,
      goldenGoal: false,
      banner: '',
      buttons: { b1: 'TACKLE', b2: 'SWITCH', charge: -1, sweetSpot: true },
    };
    const hud: HudData = {
      controls: this.controls,
      state: this.hudState,
      debugInfo: () => this.debugInfo(),
    };
    this.scene.launch('Hud', hud);

    // Don't replay the paused time as a burst of steps.
    const onResume = () => this.fixed.reset();
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.scene.stop('Hud');
    });
  }

  override update(time: number, delta: number) {
    const realDt = delta / 1000;
    this.controls.sample();
    if (this.flow.update(realDt)) this.resetForKickoff();
    if (this.flow.finished) {
      this.showResult();
      return;
    }

    const timeScale = this.flow.timeScale;
    const alpha = this.fixed.advance(delta * timeScale, (dt) => this.step(dt));

    for (const p of this.everyone) p.interpolate(alpha);
    this.ball.interpolate(alpha);
    this.updatePassPreview();
    this.updateAimArrow();
    this.updateGroundMarker();

    const b = this.ball;
    this.rig.setBallInAir(
      b.z > BALL.inAirZoomHeight && b.speed > BALL.inAirZoomSpeed
    );
    this.rig.update(realDt, {
      ballX: b.renderX,
      ballY: b.renderY,
      ballVx: b.vx,
      ballVy: b.vy,
      playerX: this.controlled.renderX,
      playerY: this.controlled.renderY,
    });

    const t = time / 1000;
    this.court.update(this.projector, t);
    for (const p of this.everyone) p.render(this.projector, t);
    b.render(this.projector, realDt * timeScale);
    this.updateHud();
  }

  // One fixed simulation step.
  private step(dt: number) {
    this.simTime += dt;
    const t = this.simTime;
    const ball = this.ball;
    for (const p of this.everyone) p.savePrevious();
    ball.savePrevious();

    // Input -> movement. Only the controlled player moves (by the stick);
    // nobody runs toward the ball by themselves (user preference). A pass's
    // receiver keeps a guaranteed first touch while the pass is travelling;
    // once a loose ball has died, that flag is dropped.
    const frozen = this.flow.playersFrozen;
    if (!ball.owner && ball.z === 0 && ball.speed < PASS.receiverStopBelow)
      this.clearReceivers();
    for (const p of this.home) {
      const human = p === this.controlled && !frozen;
      stepPlayer(
        p,
        human ? this.controls.move : NO_MOVE,
        human && this.controls.sprint,
        dt,
        ball.owner === p
      );
    }
    // Keepers: the human steers ours when controlling it; otherwise each
    // takes up its spot between ball and goal centre (keeperPositionStick;
    // the CPU one also dives at shots, cpuKeeperReact).
    for (const k of [this.homeKeeper, this.awayKeeper]) {
      // A keeper the human isn't controlling reacts to shots by diving.
      if (k !== this.controlled && !frozen) cpuKeeperReact(k, ball, t);
      if (stepKeeperBody(k, t, dt)) continue; // diving or down after a dive
      const human = k === this.controlled;
      const move = frozen
        ? NO_MOVE
        : human
          ? this.controls.move
          : this.keeperPositionStick(k);
      stepPlayer(k, move, human && this.controls.sprint, dt, ball.owner === k);
      // Standing still, a keeper keeps its eyes on the ball.
      if (move.r <= STICK.deadZone && k.speed < 5)
        k.heading = Math.atan2(ball.y - k.y, ball.x - k.x);
    }

    // Bodies can't overlap; then everyone back inside their limits.
    separatePlayers(this.everyone);
    for (const p of this.home) [p.x, p.y] = constrainMove(p.prevY, p.x, p.y);
    // Keepers may leave their box (playing with their feet), but not while
    // holding the ball in their hands.
    for (const k of [this.homeKeeper, this.awayKeeper]) {
      if (k.holding) keepInBox(k);
      else [k.x, k.y] = constrainMove(k.prevY, k.x, k.y);
    }

    this.controls.sprinting = this.controlled.sprinting;
    this.controls.sprintLocked = this.controlled.sprintLocked;

    // Ball, then who has it (only while live: not during the kickoff freeze).
    if (!ball.owner) stepFreeBall(ball, dt);
    if (this.outRestart && t >= this.outRestart.at)
      this.restartWithKeeper(this.outRestart.keeper);
    if (this.flow.phase === 'live' && ball.out === 0) {
      // Keepers are included: inside their box possession skips them (hands,
      // see stepDummyKeeper); outside it they play with their feet.
      const events = stepPossession(
        ball,
        [...this.home, this.homeKeeper, this.awayKeeper],
        t,
        dt
      );
      if (events.gained) this.onGained(events.gained);
      if (events.deflected) this.flow.onTouch();
      for (const keeper of [this.homeKeeper, this.awayKeeper]) {
        const teammates = keeper.team === 'home' ? this.home : [];
        const human = keeper === this.controlled;
        const event = stepDummyKeeper(
          keeper,
          ball,
          teammates,
          t,
          dt,
          Math.random,
          human
        );
        if (!event) continue;
        this.flow.onTouch();
        this.clearReceivers();
        // Our keeper catches: the human takes over the keeper.
        if (event === 'caught' && keeper === this.homeKeeper)
          this.setControlled(keeper);
        // Held too long and auto-thrown: control goes back to an outfielder.
        if (event === 'thrown' && human)
          this.setControlled(this.nearestOutfielder(ball.x, ball.y));
      }
    }

    const contact = collideBall(ball);
    if (contact.goal !== 0) {
      if (ball.owner) releaseBall(ball, ball.owner, t);
      this.pendingPass = null;
      this.chargeSince = null;
      this.clearReceivers();
      // Ball in the right net = home scores (home attacks right).
      this.flow.onGoal(contact.goal > 0 ? 'home' : 'away');
    }
    if (contact.out !== 0 && this.flow.phase === 'live') {
      // Over the bar (or over the end wall): the defending keeper restarts.
      if (ball.owner) releaseBall(ball, ball.owner, t);
      this.chargeSince = null;
      this.clearReceivers();
      const overBar = Math.abs(ball.y - PITCH.height / 2) < PITCH.goalMouth / 2;
      this.flow.flash(
        overBar ? 'OVER THE BAR' : 'OUT',
        SHOOT.outRestartSec + 0.4
      );
      this.outRestart = {
        keeper: contact.out < 0 ? this.homeKeeper : this.awayKeeper,
        at: t + SHOOT.outRestartSec,
      };
    }

    if (this.flow.phase === 'live') this.stepActions(t);
    this.flow.tickClock(dt);
  }

  // Context buttons. With the ball: 1 = pass, 2 = shoot (hold to charge).
  // Without: 1 = tackle (Phase 3), 2 = switch player. A press is remembered
  // for 150 ms while the ball is close, so pressing just before gaining the
  // ball still counts as a pass or shot.
  private stepActions(t: number) {
    const ball = this.ball;
    const controls = this.controls;

    // Holding SWITCH (after the switch it triggered) jumps straight to our keeper.
    if (!controls.isHeld(2)) {
      this.switchHoldArmed = false;
    } else if (
      this.switchHoldArmed &&
      controls.heldFor(2) >= INPUT.keeperHoldSec
    ) {
      this.switchHoldArmed = false;
      if (this.controlled !== this.homeKeeper)
        this.setControlled(this.homeKeeper);
    }
    // After a shot, while the ball is loose: control stays with whichever
    // outfielder is closest to the ball (the shooter too, while it still
    // is), re-checked every step as the ball travels. A small margin stops
    // it flickering between two players at nearly the same distance. It
    // ends when someone gains the ball (control follows the ball then, see
    // onGained), when the ball has died (after a last pick), when the
    // player switches by hand, or after SHOOT.followShotMaxSec.
    if (t < this.followShotUntil) {
      if (ball.owner) {
        this.followShotUntil = -Infinity;
      } else {
        const nearest = this.nearestOutfielder(ball.x, ball.y);
        const current = this.controlled;
        const dist = (p: Player) => Math.hypot(p.x - ball.x, p.y - ball.y);
        if (
          nearest !== current &&
          (current.role === 'keeper' ||
            dist(current) - dist(nearest) > SHOOT.followShotMargin)
        )
          this.setControlled(nearest);
        if (ball.z === 0 && ball.speed < PASS.receiverStopBelow)
          this.followShotUntil = -Infinity;
      }
    }
    const c = this.controlled;

    if (this.pendingPass && t >= this.pendingPass.at) {
      const { passer, receiver } = this.pendingPass;
      this.pendingPass = null;
      if (ball.owner === passer) {
        kickPass(ball, passer, receiver, this.opponentsOf(passer), Math.random);
        releaseBall(ball, passer, t);
        this.stats.passes += 1;
        // Control moves to the receiver the moment the pass is released.
        this.setControlled(receiver);
      }
    }

    const hasBall = ball.owner === c;
    const fresh = (id: 1 | 2) => controls.pressAge(id) <= INPUT.bufferSec;

    // Keeper with the ball in hands, or without the ball: keeper actions.
    // With the ball at its feet (outside the box) it passes and shoots
    // like an outfielder (below).
    if (c.role === 'keeper' && (c.holding || ball.owner !== c)) {
      this.stepKeeperActions(t);
      return;
    }
    const ballClose =
      !ball.owner &&
      Math.hypot(ball.x - c.x, ball.y - c.y) < INPUT.bufferNearBall;

    if (fresh(1)) {
      if (hasBall) {
        controls.consume(1);
        const receiver = this.pendingPass
          ? null
          : choosePassTarget(c, this.home, controls.move);
        if (receiver)
          this.pendingPass = { passer: c, receiver, at: t + PASS.windUpSec };
      } else if (!ballClose) {
        controls.consume(1); // TACKLE arrives in Phase 3.
      }
    }

    if (hasBall && !this.pendingPass) {
      if (this.chargeSince === null && fresh(2)) {
        controls.consume(2);
        this.chargeSince = realNow();
      }
      if (this.chargeSince !== null && !controls.isHeld(2)) {
        const held = realNow() - this.chargeSince;
        const charge =
          held <= SHOOT.tapMaxSec ? 0 : clamp(held / SHOOT.chargeSec, 0, 1);
        this.chargeSince = null;
        kickShot(
          ball,
          c,
          controls.move,
          charge,
          this.opponentsOf(c),
          Math.random,
          controls.swipe
        );
        releaseBall(ball, c, t);
        this.stats.shots += 1;
        c.playShoot();
        // From now on control follows the player closest to the ball
        // (see the check at the top).
        this.followShotUntil = t + SHOOT.followShotMaxSec;
      }
    } else {
      if (!hasBall) this.chargeSince = null;
      if (!hasBall && fresh(2) && !ballClose) {
        controls.consume(2);
        this.switchPlayer(t);
        this.switchHoldArmed = true; // keep holding to jump to the keeper
      }
    }
  }

  // The human's keeper holding the ball: 1 = throw to the teammate shown by
  // the target ring (a short arc), 2 = long kick along the stick (or
  // upfield). Control then moves to the receiver / the outfielder nearest
  // where the kick is heading.
  private stepKeeperActions(t: number) {
    const k = this.controlled;
    const ball = this.ball;
    const controls = this.controls;
    const fresh = (id: 1 | 2) => controls.pressAge(id) <= INPUT.bufferSec;

    // Without the ball: 1 = dive (along the stick, or with the stick centred
    // to where the ball will cross the keeper's line), 2 = switch out.
    if (ball.owner !== k) {
      this.chargeSince = null;
      if (fresh(1)) {
        controls.consume(1);
        if (controls.move.r > STICK.deadZone) {
          startDive(k, Math.atan2(controls.move.y, controls.move.x), t);
        } else {
          const target = this.diveTarget(k);
          startDive(k, target.dir, t, target.dist);
        }
      }
      if (fresh(2)) {
        controls.consume(2);
        this.switchPlayer(t);
      }
      return;
    }
    const release = () => {
      ball.owner = null;
      ball.lastTouch = k;
      k.holdTimer = 0;
      k.holding = false;
      k.lockUntil = t + KEEPER.lockAfterSec;
    };

    if (fresh(1)) {
      controls.consume(1);
      const receiver = choosePassTarget(k, this.home, controls.move);
      if (receiver) {
        kickPass(ball, k, receiver, [], Math.random);
        ball.vz = KEEPER.throwLift;
        release();
        this.stats.passes += 1;
        this.setControlled(receiver);
      }
      return;
    }
    // KICK charges like a shot: tap = short, low clearance; full hold = long, lofted.
    if (this.chargeSince === null && fresh(2)) {
      controls.consume(2);
      this.chargeSince = realNow();
    }
    if (this.chargeSince !== null && !controls.isHeld(2)) {
      const charge = clamp(
        (realNow() - this.chargeSince) / SHOOT.chargeSec,
        0,
        1
      );
      this.chargeSince = null;
      const upfield = k.team === 'home' ? 0 : Math.PI;
      const dir =
        controls.move.r > STICK.deadZone
          ? Math.atan2(controls.move.y, controls.move.x)
          : upfield;
      // Analog swipes as on SHOOT: up = high punt, down = driven (fast,
      // flat), left / right = curling kick bending that way; it leaves
      // along the stick (no assist), each effect scaled by the swipe.
      const shape = shotShape(controls.swipe);
      const speedScale =
        1 +
        (KEEPER.puntSpeedScale - 1) * shape.chip +
        (KEEPER.driveSpeedScale - 1) * shape.power;
      const liftScale =
        1 +
        (KEEPER.puntLiftScale - 1) * shape.chip +
        (KEEPER.driveLiftScale - 1) * shape.power;
      const speed =
        (KEEPER.kickMinSpeed +
          (KEEPER.kickSpeed - KEEPER.kickMinSpeed) * charge) *
        speedScale;
      ball.vx = Math.cos(dir) * speed;
      ball.vy = Math.sin(dir) * speed;
      ball.vz =
        (KEEPER.kickMinLift + (KEEPER.kickLift - KEEPER.kickMinLift) * charge) *
        liftScale;
      ball.spin = shape.curl * KEEPER.curlKickSpin;
      k.playShoot();
      ball.dip = 0;
      release();
      const reach = 300 + 500 * charge;
      this.setControlled(
        this.nearestOutfielder(
          ball.x + Math.cos(dir) * reach,
          ball.y + Math.sin(dir) * reach
        )
      );
    }
  }

  // Dive with the stick centred: toward where the ball's path crosses the
  // keeper's line (its x), just far enough to reach it (the dive's own reach
  // covers the last bit); straight at the ball if it isn't coming toward
  // the keeper.
  private diveTarget(k: Player): { dir: number; dist: number } {
    const ball = this.ball;
    const towardBall = {
      dir: Math.atan2(ball.y - k.y, ball.x - k.x),
      dist: Math.hypot(ball.x - k.x, ball.y - k.y) - KEEPER.diveReach / 2,
    };
    if (Math.abs(ball.vx) < 1 || Math.sign(k.x - ball.x) !== Math.sign(ball.vx))
      return towardBall;
    const t = (k.x - ball.x) / ball.vx;
    const offset = ball.y + ball.vy * t - k.y;
    return {
      dir: offset < 0 ? -Math.PI / 2 : Math.PI / 2,
      dist: Math.abs(offset) - KEEPER.diveReach / 2,
    };
  }

  // Stick that walks a keeper to its spot: on the line from its goal centre
  // toward the ball, further off the line the closer the ball (narrowing
  // the angle), kept within the goal mouth's width. It slows as it arrives
  // so it doesn't jitter, and stops once there.
  private keeperPositionStick(k: Player): StickInput {
    const ball = this.ball;
    // Set when a shot is struck: it doesn't walk across with a fast ball
    // (that would stop everything; saving those is for dives, Phase 3).
    if (!ball.owner && ball.speed > KEEPER.setAbove) return NO_MOVE;
    const gx = k.team === 'home' ? 0 : PITCH.width;
    const gy = PITCH.height / 2;
    const bx = ball.x - gx;
    const by = ball.y - gy;
    const d = Math.hypot(bx, by);
    const near = clamp(
      (KEEPER.outFarDist - d) / (KEEPER.outFarDist - KEEPER.outNearDist),
      0,
      1
    );
    const out = KEEPER.lineOut + (KEEPER.maxOut - KEEPER.lineOut) * near;
    const ux = d > 1 ? Math.abs(bx) / d : 1; // always out into the pitch
    const uy = d > 1 ? by / d : 0;
    const halfMouth = PITCH.goalMouth / 2;
    const tx =
      gx + (k.team === 'home' ? 1 : -1) * Math.max(KEEPER.lineOut, ux * out);
    const ty = gy + clamp(uy * out, -halfMouth, halfMouth);
    const dx = tx - k.x;
    const dy = ty - k.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return NO_MOVE;
    return {
      x: dx / dist,
      y: dy / dist,
      r: STICK.sprintAt * Math.min(1, dist / 40),
    };
  }

  // Goal kick after the ball went out behind a goal: the defending keeper,
  // back on its spot, has the ball in hand (ours is then human-controlled).
  private restartWithKeeper(keeper: Player) {
    this.outRestart = null;
    const spotX =
      keeper.team === 'home'
        ? FORMATION.keeper.x
        : PITCH.width - FORMATION.keeper.x;
    keeper.placeAt(spotX, FORMATION.keeper.y);
    this.ball.placeAt(spotX, FORMATION.keeper.y);
    this.ball.owner = keeper;
    this.ball.lastTouch = keeper;
    keeper.holding = true;
    if (keeper === this.homeKeeper) this.setControlled(keeper);
  }

  private nearestOutfielder(x: number, y: number, except?: Player) {
    let best = this.forward;
    let bestDist = Infinity;
    for (const p of this.home) {
      if (p === except) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  // Switch to the teammate nearest the ball (the keeper included); pressing again within
  // a second cycles to the next nearest.
  private switchPlayer(t: number) {
    if (t - this.lastSwitchAt < INPUT.switchCooldownSec) return;
    this.followShotUntil = -Infinity; // the player chose; stop following the shot
    if (
      t - this.lastSwitchAt > INPUT.switchCycleSec ||
      this.switchCycle.length === 0
    ) {
      const ball = this.ball;
      this.switchCycle = [...this.home, this.homeKeeper]
        .filter((p) => p !== this.controlled)
        .sort(
          (a, b) =>
            Math.hypot(a.x - ball.x, a.y - ball.y) -
            Math.hypot(b.x - ball.x, b.y - ball.y)
        );
      // Danger: the ball heading for our goal in our third -> keeper first.
      const threat =
        !ball.owner &&
        ball.vx < -INPUT.keeperThreatSpeed &&
        ball.x < PITCH.width / 3;
      if (threat && this.controlled !== this.homeKeeper) {
        this.switchCycle = [
          this.homeKeeper,
          ...this.switchCycle.filter((p) => p !== this.homeKeeper),
        ];
      }
      this.switchIndex = 0;
    } else {
      this.switchIndex = (this.switchIndex + 1) % this.switchCycle.length;
    }
    const next = this.switchCycle[this.switchIndex];
    if (next) this.setControlled(next);
    this.lastSwitchAt = t;
  }

  private onGained(p: Player) {
    this.flow.onTouch();
    this.clearReceivers();
    // Control follows the ball: when our team gains it, we control the carrier.
    if (p.team === 'home') this.setControlled(p);
  }

  private setControlled(p: Player) {
    this.controlled.controlled = false;
    p.controlled = true;
    this.controlled = p;
    this.chargeSince = null;
  }

  private clearReceivers() {
    for (const p of this.home) p.receiving = false;
  }

  private opponentsOf(p: Player) {
    return p.team === 'home' ? [this.awayKeeper] : [this.homeKeeper];
  }

  private get forward() {
    return this.home[this.home.length - 1] ?? this.home[0] ?? this.homeKeeper;
  }

  // Players to their spots, ball on the centre spot. The kicking team's
  // forward stands next to the ball (the away side has no outfield team
  // until Phase 3, so after a home goal the ball just waits at the centre).
  private resetForKickoff() {
    this.ball.placeAt(PITCH.width / 2, PITCH.height / 2);
    FORMATION.outfield.forEach((s, i) => this.home[i]?.placeAt(s.x, s.y));
    if (this.flow.kickoffTeam === 'home')
      this.forward.placeAt(FORMATION.kickoffSpot.x, FORMATION.kickoffSpot.y);
    this.homeKeeper.placeAt(FORMATION.keeper.x, FORMATION.keeper.y);
    this.awayKeeper.placeAt(
      PITCH.width - FORMATION.keeper.x,
      FORMATION.keeper.y
    );
    this.pendingPass = null;
    this.followShotUntil = -Infinity;
    this.outRestart = null;
    this.chargeSince = null;
    this.setControlled(this.forward);
  }

  // While a shot (or keeper kick) charges: a short arrow on the ground from
  // the ball along the direction it will leave in. It shows the strike
  // direction only (no target, no curve), longer with more charge.
  private updateAimArrow() {
    const g = this.aimArrow;
    g.clear();
    const c = this.controlled;
    const ball = this.ball;
    const charging = this.chargeSince !== null && ball.owner === c;
    // The swipe shape above the shooter's head (the thumb hides the button).
    this.shotText.setVisible(charging);
    if (charging) {
      const label =
        shotLabel(this.controls.swipe, c.holding) ||
        (c.holding ? 'KICK' : 'SHOT');
      if (this.shotText.text !== label) this.shotText.setText(label);
      // Above the overhead arrow (which sits over the sprite).
      this.projector.project(c.renderX, c.renderY, PLAYER_HEIGHT + 48, AIM_AT);
      this.shotText.setPosition(AIM_AT.x, AIM_AT.y);
    }
    if (!SHOOT.aimArrow || !charging) return;
    const charge = this.currentCharge() ?? 0;
    this.drawGroundArrow(
      g,
      ball.renderX,
      ball.renderY,
      this.strikeDirection(c),
      0,
      60 + 160 * charge,
      this.chargeColor(charge, c.holding)
    );
    g.setDepth(ball.renderY + 0.3);
  }

  // How far the shot (or keeper kick) is charged, 0..1, or null when the
  // controlled player isn't charging one.
  private currentCharge() {
    if (this.chargeSince === null || this.ball.owner !== this.controlled)
      return null;
    return clamp((realNow() - this.chargeSince) / SHOOT.chargeSec, 0, 1);
  }

  // Which way the strike will leave: the stick, or the facing with the stick
  // centred; a keeper kick from the hands goes upfield then.
  private strikeDirection(c: Player) {
    if (c.holding && this.controls.move.r <= STICK.deadZone)
      return c.team === 'home' ? 0 : Math.PI;
    return shotDirection(c, this.controls.move);
  }

  // White while building, green in the perfect band, red when over-hit (a
  // keeper kick has no bands).
  private chargeColor(charge: number, hands: boolean) {
    if (hands) return PAL.white;
    if (isPerfectCharge(charge)) return PAL.green;
    return charge > SHOOT.sweetSpot ? PAL.red : PAL.white;
  }

  // The controlled player's ground marker (FIFA-style): a ring round the
  // feet with a pointer on it toward the facing direction. While SHOOT /
  // KICK charges, the pointer follows the strike direction and a segmented
  // gauge fills round the ring, in the aim arrow's colours.
  private updateGroundMarker() {
    const g = this.marker;
    g.clear();
    const c = this.controlled;
    if (this.flow.phase === 'fulltime') return;
    const charge = this.currentCharge();
    const dir = charge === null ? c.heading : this.strikeDirection(c);
    const color =
      charge === null ? PAL.white : this.chargeColor(charge, c.holding);
    const x = c.renderX;
    const y = c.renderY;
    const ground = (angle: number, radius: number) => {
      this.projector.project(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        0,
        AIM_AT
      );
      return { x: AIM_AT.x, y: AIM_AT.y };
    };
    const scale = this.projector.project(x, y, 0, AIM_AT).scale;

    // Disc and ring.
    const ring = Array.from({ length: RING_POINTS }, (_, i) =>
      ground((i / RING_POINTS) * Math.PI * 2, RING_RADIUS)
    );
    g.fillStyle(PAL.black, 0.22).fillPoints(ring, true);
    g.lineStyle(Math.max(2, 3 * scale), color, 0.85).strokePoints(
      ring,
      true,
      true
    );

    // Gauge: segments round the ring from the pointer, clockwise on screen.
    if (charge !== null) {
      const step = (Math.PI * 2) / GAUGE_SEGMENTS;
      const lit = Math.ceil(charge * GAUGE_SEGMENTS);
      for (let i = 0; i < GAUGE_SEGMENTS; i++) {
        const a0 = dir + i * step + step * 0.12;
        const a1 = dir + (i + 1) * step - step * 0.12;
        const inner = RING_RADIUS + 5;
        const outer = RING_RADIUS + 15;
        if (i < lit) g.fillStyle(color, 0.95);
        else g.fillStyle(PAL.black, 0.3);
        g.fillPoints(
          [
            ground(a0, inner),
            ground(a1, inner),
            ground(a1, outer),
            ground(a0, outer),
          ],
          true
        );
      }
    }

    // Pointer: a triangle pointing along the direction, just outside the
    // ring (outside the gauge while that shows).
    const base = RING_RADIUS + (charge === null ? 6 : 19);
    const tip = ground(dir, base + 28);
    const left = ground(dir + 0.28, base);
    const right = ground(dir - 0.28, base);
    g.fillStyle(color, 0.95).fillTriangle(
      tip.x,
      tip.y,
      left.x,
      left.y,
      right.x,
      right.y
    );
    g.setDepth(y - 0.5); // under the player's sprite
  }

  // An arrow lying on the ground from `start` to `end` world px along `dir`
  // from (x, y): a line that fades in toward the tip, plus a two-stroke head.
  private drawGroundArrow(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    dir: number,
    start: number,
    end: number,
    color: number
  ) {
    const at = (along: number, across = 0) => {
      this.projector.project(
        x + Math.cos(dir) * along + Math.cos(dir + Math.PI / 2) * across,
        y + Math.sin(dir) * along + Math.sin(dir + Math.PI / 2) * across,
        0,
        AIM_AT
      );
      return { x: AIM_AT.x, y: AIM_AT.y, s: AIM_AT.scale };
    };
    let prev = at(start);
    [0.25, 0.5, 0.75, 1].forEach((f, i) => {
      const p = at(start + (end - start) * f);
      g.lineStyle(Math.max(3, 4 * p.s), color, 0.5 + 0.15 * i);
      g.lineBetween(prev.x, prev.y, p.x, p.y);
      prev = p;
    });
    // Arrow head: two strokes back from the tip, either side.
    const tip = prev;
    for (const s of [-1, 1]) {
      const wing = at(end - ARROW_HEAD_BACK, ARROW_HEAD_SIDE * s);
      g.lineBetween(tip.x, tip.y, wing.x, wing.y);
    }
  }

  private updatePassPreview() {
    const c = this.controlled;
    const show =
      this.flow.phase === 'live' && this.ball.owner === c && !this.pendingPass;
    const target = show
      ? choosePassTarget(c, this.home, this.controls.move)
      : null;
    for (const p of this.home) p.passTarget = p === target;
  }

  private updateHud() {
    const s = this.hudState;
    const hasBall = this.ball.owner === this.controlled;
    s.home = this.flow.score.home;
    s.away = this.flow.score.away;
    s.clock = this.flow.clock;
    s.goldenGoal = this.flow.goldenGoal;
    s.banner = this.flow.banner;
    const keeper = this.controlled.role === 'keeper';
    const hands = keeper && hasBall && this.controlled.holding;
    // Keeper: THROW/KICK in hands, DIVE/SWITCH without the ball, and like an
    // outfielder (PASS/SHOOT) with the ball at its feet outside the box.
    s.buttons.b1 = hands
      ? 'THROW'
      : hasBall
        ? 'PASS'
        : keeper
          ? 'DIVE'
          : 'TACKLE';
    s.buttons.b2 = hands ? 'KICK' : hasBall ? 'SHOOT' : 'SWITCH';
    s.buttons.sweetSpot = !hands; // a keeper kick has no over-hit zone
    s.buttons.charge =
      this.chargeSince === null
        ? -1
        : clamp((realNow() - this.chargeSince) / SHOOT.chargeSec, 0, 1);
  }

  private showResult() {
    if (this.resultShown) return;
    this.resultShown = true;
    const result: MatchResult = {
      difficulty: this.config.difficulty,
      goalsFor: this.flow.score.home,
      goalsAgainst: this.flow.score.away,
      shots: this.stats.shots,
      passes: this.stats.passes,
      tacklesWon: 0,
    };
    this.scene.start('Result', result);
  }

  private debugInfo() {
    const p = this.controlled;
    const b = this.ball;
    const f = this.rig.focus;
    const owner = b.owner ? `${b.owner.team} ${b.owner.role}` : 'loose';
    return [
      `AI ${this.config.difficulty} | ${this.flow.phase}`,
      `POS ${Math.round(p.x)},${Math.round(p.y)} SPEED ${Math.round(p.speed)}${p.sprinting ? ' SPRINT' : ''}`,
      `STAMINA ${Math.round(p.stamina)}${p.sprintLocked ? ' LOCKED' : ''}`,
      `BALL ${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.z)} V ${Math.round(b.speed)} ${owner}`,
      `CAM ${Math.round(f.x)},${Math.round(f.y)} ZOOM ${this.rig.currentZoom.toFixed(2)}`,
    ].join('\n');
  }
}
