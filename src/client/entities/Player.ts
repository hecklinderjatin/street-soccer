import Phaser from 'phaser';
import { AI, SIM, STAMINA, TACKLE } from '../../shared/tuning';
import type { JerseyColor, Team } from '../../shared/types';
import { newProjected, type Projector } from '../render/Projector';
import { PAL, PX } from '../ui/palette';
import {
  MARKER_ARROW,
  MARKER_TARGET,
  IDLE_FRAME,
  LOOKS,
  PLAYER_HAIR_TEXTURE,
  PLAYER_SKIN_TEXTURE,
  PLAYER_HEIGHT,
  PLAYER_ORIGIN_Y,
  PLAYER_PX,
  celebrateAnim,
  idleAnim,
  holdAnim,
  playerTexture,
  runAnim,
  shootAnim,
  type Kit,
  type Look,
  type RunView,
} from '../art/playerArt';

const DEFAULT_LOOK: Look = LOOKS[0] ?? { skin: 0xffffff, hair: 0xffffff };

export type Role = 'outfield' | 'keeper';

// How a player was at one moment, as an opponent's AI sees it (seenAgo).
export type Seen = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
};
const SEEN_STEPS = Math.ceil(AI.readMaxSec * SIM.hz) + 1; // one record per fixed step

const DEPTH_OVERLAY = 2_000_000; // above the fence
const BAR_W = 14; // stamina bar width in art pixels
const feet = newProjected();
const head = newProjected();

// A player in the 2.5D world: ground position (x, y) plus height z.
// Simulation state is plain fields (stepped at a fixed rate); render()
// draws an interpolated frame through the perspective Projector, as a
// camera-facing sprite scaled by distance and depth-sorted by ground y.
export class Player {
  x: number;
  y: number;
  z = 0;
  prevX: number;
  prevY: number;
  heading = 0; // radians, direction of travel (and facing when standing)
  speed = 0; // px/s along heading
  stamina: number = STAMINA.max;
  sprinting = false;
  sprintLocked = false;
  sinceSprint = Infinity; // seconds since the last sprint tick
  controlled = false; // the human's player
  renderX: number; // interpolated ground position for this render frame
  renderY: number;

  // Possession and actions (sim time in seconds).
  lockUntil = 0; // can't touch the ball before this (after losing or releasing it)
  touchTimer = 0; // seconds since the last dribble touch
  dribbleAngle = 0; // where the ball sits around the carrier (radians) ...
  dribbleDist = 0; // ... and how far from the feet
  receiving = false; // the intended receiver of the pass in flight
  receivingThrough = false; // ... and that pass is a through ball (no receiver hold)
  holdTimer = 0; // keeper: how long the ball has been held
  holding = false; // keeper: has the ball in its hands (only possible inside its box)
  readonly heldBallScreen = {
    x: 0,
    y: 0,
    scale: 1,
    visible: false,
    behindHands: false,
  };
  diveUntil = 0; // keeper: diving until this sim time ...
  diveAt = -Infinity; // actual dive start, including shortened AI dives
  recoverUntil = 0; // ... then down until this one
  diveDir = 0; // keeper: dive direction (radians)
  lying = false; // keeper: diving or down after a dive (drawn on its side)
  reactAt = -1; // AI keeper: sim time it reacts to the threat it has seen (-1 = none) ...
  reactKind = ''; // ... and of which kind (keeper.ts KeeperMove)
  shuffleAt = -1; // AI keeper: sim time it starts side-stepping toward a shot it has just seen
  jumpAt = -Infinity; // keeper: jump save started ...
  jumpUntil = 0; // ... in the air until ...
  jumpLandUntil = 0; // ... landing until
  blockAt = -Infinity; // keeper: block pose (standing save / tackle) from ...
  blockUntil = 0; // ... until
  blockTackle = false; // ... and it is a standing tackle
  passTarget = false; // drawn with the blue ring: where a pass would go now
  // Tackles (systems/tackle.ts; sim times in seconds).
  tackleAt = -Infinity; // the current / last tackle started
  tackleUntil = -Infinity; // it (with its recovery or stumble) ends
  tackleDir = 0; // lunge direction (radians)
  tackleSprint = false; // went in at a sprint
  tackleDone = false; // contact already resolved (one per tackle)
  stumbling = false; // a failed tackle: down (drawn on its side) until tackleUntil
  jukeRef: number | null = null; // the carrier's stick direction when the tackle started
  staggerUntil = -Infinity; // tackled: can't move or touch the ball until then
  private hurtAt = -Infinity;
  private hurtDir = 0;
  celebrating = false; // the scorer, during the goal celebration
  private celebrationStyle = 0; // which of the celebrations it plays
  tackleReadyAt = 0; // AI: no new tackle before this
  wantDir = 0; // the direction last asked for by stick or AI (the juke check)

  // The last AI.readMaxSec of position / movement / facing, one record per
  // fixed step in a ring (recordSeen, seenAgo).
  private readonly seenLog: Seen[] = Array.from({ length: SEEN_STEPS }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    heading: 0,
  }));
  private seenHead = 0; // where the next record goes
  private seenCount = 0;

  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly skinLayer: Phaser.GameObjects.Sprite;
  private readonly hairLayer: Phaser.GameObjects.Sprite;
  private readonly targetRing: Phaser.GameObjects.Image;
  private readonly arrow: Phaser.GameObjects.Image;
  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly kit: Kit;
  private shooting = false; // the strike animation is playing
  private readonly finishShoot = () => {
    this.shooting = false;
  };
  private runView: RunView = 'side';

  constructor(
    scene: Phaser.Scene,
    readonly team: Team,
    readonly role: Role,
    x: number,
    y: number,
    look: Look = DEFAULT_LOOK,
    jersey: JerseyColor = team === 'home' ? 'pink' : 'blue' // outfielders' kit
  ) {
    this.x = this.prevX = this.renderX = x;
    this.y = this.prevY = this.renderY = y;
    this.heading = team === 'home' ? 0 : Math.PI;
    this.kit =
      role === 'keeper'
        ? team === 'home'
          ? 'homeKeeper'
          : 'awayKeeper'
        : jersey;

    this.targetRing = scene.add.image(0, 0, MARKER_TARGET);
    this.sprite = scene.add
      .sprite(0, 0, playerTexture(this.kit), IDLE_FRAME)
      .setOrigin(0.5, PLAYER_ORIGIN_Y);
    // Added right after the body, so at the same depth they draw on top.
    this.skinLayer = scene.add
      .sprite(0, 0, PLAYER_SKIN_TEXTURE, IDLE_FRAME)
      .setOrigin(0.5, PLAYER_ORIGIN_Y)
      .setTint(look.skin);
    this.hairLayer = scene.add
      .sprite(0, 0, PLAYER_HAIR_TEXTURE, IDLE_FRAME)
      .setOrigin(0.5, PLAYER_ORIGIN_Y)
      .setTint(look.hair);
    this.arrow = scene.add
      .image(0, 0, MARKER_ARROW)
      .setScale(PX)
      .setDepth(DEPTH_OVERLAY);
    this.barBg = scene.add
      .rectangle(0, 0, (BAR_W + 2) * PX, 3 * PX, PAL.black)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_OVERLAY);
    this.barFill = scene.add
      .rectangle(0, 0, BAR_W * PX, PX, PAL.green)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_OVERLAY);
  }

  get vx() {
    return Math.cos(this.heading) * this.speed;
  }

  get vy() {
    return Math.sin(this.heading) * this.speed;
  }

  // Puts the player on a spot, standing, facing the way their team attacks.
  placeAt(x: number, y: number) {
    this.x = this.prevX = this.renderX = x;
    this.y = this.prevY = this.renderY = y;
    this.speed = 0;
    this.heading = this.team === 'home' ? 0 : Math.PI;
    this.receiving = false;
    this.receivingThrough = false;
    this.lockUntil = 0;
    this.touchTimer = 0;
    this.holdTimer = 0;
    this.holding = false;
    this.diveUntil = 0;
    this.diveAt = -Infinity;
    this.recoverUntil = 0;
    this.lying = false;
    this.reactAt = -1;
    this.reactKind = '';
    this.shuffleAt = -1;
    this.jumpAt = this.blockAt = -Infinity;
    this.jumpUntil = this.jumpLandUntil = this.blockUntil = 0;
    this.blockTackle = false;
    this.z = 0;
    this.tackleAt = this.tackleUntil = this.staggerUntil = -Infinity;
    this.hurtAt = -Infinity;
    this.celebrating = false;
    this.tackleDone = false;
    this.stumbling = false;
    this.jukeRef = null;
    this.tackleReadyAt = 0;
    this.seenCount = 0; // a fresh picture after a reset
  }

  // Records this step's position, movement and facing (MatchScene, once per
  // fixed step after movement).
  recordSeen() {
    const s = this.seenLog[this.seenHead];
    if (!s) return;
    s.x = this.x;
    s.y = this.y;
    s.vx = this.vx;
    s.vy = this.vy;
    s.heading = this.heading;
    this.seenHead = (this.seenHead + 1) % SEEN_STEPS;
    this.seenCount = Math.min(this.seenCount + 1, SEEN_STEPS);
  }

  // How this player was `sec` ago (as far back as recorded; as it is now
  // when nothing is): the late picture an opponent's AI reacts to
  // (LEVELS.readSec), so a feint or a sudden turn isn't followed at once.
  seenAgo(sec: number): Seen {
    const back = Math.min(Math.round(sec * SIM.hz), this.seenCount - 1);
    const s =
      back >= 0
        ? this.seenLog[(this.seenHead - 1 - back + SEEN_STEPS) % SEEN_STEPS]
        : undefined;
    return (
      s ?? {
        x: this.x,
        y: this.y,
        vx: this.vx,
        vy: this.vy,
        heading: this.heading,
      }
    );
  }

  // Plays the strike animation once (shot or keeper kick); running and
  // standing animations wait until it has finished.
  playShoot() {
    this.shooting = true;
    this.sprite.anims.timeScale = 1;
    this.sprite.play(shootAnim(this.kit));
    this.sprite.off(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.finishShoot
    );
    this.sprite.once(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.finishShoot
    );
  }

  playTackle() {
    this.sprite.off(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.finishShoot
    );
    this.shooting = false;
    this.sprite.anims.stop();
    this.sprite.setTexture(playerTexture(this.kit), 'tackle1');
  }

  // A strike animation stops (a jump or block pose takes over).
  stopShot() {
    this.sprite.off(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.finishShoot
    );
    this.shooting = false;
    this.sprite.anims.stop();
  }

  playDive() {
    this.sprite.off(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.finishShoot
    );
    this.shooting = false;
    this.sprite.anims.stop();
    this.sprite.setTexture(playerTexture(this.kit), 'dive1');
  }

  playHurt(time: number, direction: number) {
    this.hurtAt = time;
    this.hurtDir = direction;
    this.sprite.off(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.finishShoot
    );
    this.shooting = false;
    this.sprite.anims.stop();
    this.sprite.setTexture(playerTexture(this.kit), 'hurt1');
  }

  // The scorer celebrates until the next kickoff reset (placeAt).
  celebrate(style: number) {
    this.celebrating = true;
    this.celebrationStyle = style;
    this.sprite.off(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.finishShoot
    );
    this.shooting = false;
  }

  // Call at the start of every simulation step.
  savePrevious() {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  // Sets renderX/renderY for this frame; call before the camera update.
  interpolate(alpha: number) {
    this.renderX = this.prevX + (this.x - this.prevX) * alpha;
    this.renderY = this.prevY + (this.y - this.prevY) * alpha;
  }

  render(projector: Projector, timeSec: number, simTime = timeSec) {
    const x = this.renderX;
    const y = this.renderY;
    projector.project(x, y, this.z, feet);
    projector.project(x, y, this.z + PLAYER_HEIGHT, head);

    this.sprite
      .setPosition(feet.x, feet.y)
      .setScale(PLAYER_PX * feet.scale)
      .setDepth(y);
    const tackling = simTime >= this.tackleAt && simTime < this.tackleUntil;
    const hurting = simTime >= this.hurtAt && simTime < this.staggerUntil;
    const diving =
      this.role === 'keeper' &&
      simTime >= this.diveAt &&
      simTime < this.recoverUntil;
    const jumping =
      this.role === 'keeper' &&
      simTime >= this.jumpAt &&
      simTime < this.jumpLandUntil;
    const blocking =
      this.role === 'keeper' &&
      simTime >= this.blockAt &&
      simTime < this.blockUntil;
    this.sprite.setAngle(
      this.lying && !tackling && !diving && !hurting && !this.celebrating
        ? Math.cos(this.diveDir) < 0
          ? -80
          : 80
        : 0
    );
    // A shot / kick animation plays out; otherwise run or stand.
    if (this.celebrating) {
      this.sprite.play(celebrateAnim(this.kit, this.celebrationStyle), true);
      this.sprite.anims.timeScale = 1;
    } else if (hurting) {
      const progress = Math.max(
        0,
        Math.min(
          1,
          (simTime - this.hurtAt) /
            Math.max(0.001, this.staggerUntil - this.hurtAt)
        )
      );
      const frame =
        progress < 0.75
          ? `hurt${Math.min(3, Math.floor((progress / 0.75) * 4)) + 1}`
          : `tackle${6 + Math.min(2, Math.floor(((progress - 0.75) / 0.25) * 3))}`;
      this.sprite.setTexture(playerTexture(this.kit), frame);
    } else if (diving) {
      const progress = Math.max(
        0,
        (simTime - this.diveAt) / Math.max(0.001, this.diveUntil - this.diveAt)
      );
      const frame =
        simTime >= this.diveUntil ? 5 : Math.min(4, Math.floor(progress * 5));
      this.sprite.setTexture(playerTexture(this.kit), `dive${frame + 1}`);
    } else if (jumping) {
      // Set, take-off, top, then the landing pose until it can move.
      const progress =
        (simTime - this.jumpAt) / Math.max(0.001, this.jumpUntil - this.jumpAt);
      const frame =
        simTime >= this.jumpUntil
          ? 4
          : progress < 0.15
            ? 1
            : progress < 0.4
              ? 2
              : progress < 0.8
                ? 3
                : 4;
      this.sprite.setTexture(playerTexture(this.kit), `jump${frame}`);
    } else if (blocking) {
      // Hands up, then pushing forward.
      const progress =
        (simTime - this.blockAt) /
        Math.max(0.001, this.blockUntil - this.blockAt);
      const frame = progress < 0.3 ? 1 : progress < 0.6 ? 2 : 3;
      this.sprite.setTexture(playerTexture(this.kit), `block${frame}`);
    } else if (tackling) {
      const since = simTime - this.tackleAt;
      let frame: number;
      if (!this.tackleDone && since < TACKLE.windupSec) {
        frame = Math.min(1, Math.floor((since / TACKLE.windupSec) * 2));
      } else if (
        !this.tackleDone &&
        since < TACKLE.windupSec + TACKLE.activeSec
      ) {
        frame =
          2 +
          Math.min(
            2,
            Math.floor(((since - TACKLE.windupSec) / TACKLE.activeSec) * 3)
          );
      } else {
        const recoverStart = this.tackleDone
          ? this.tackleUntil -
            (this.stumbling ? TACKLE.stumbleSec : TACKLE.winRecoverSec)
          : this.tackleAt + TACKLE.windupSec + TACKLE.activeSec;
        const progress = Math.max(
          0,
          Math.min(
            1,
            (simTime - recoverStart) /
              Math.max(0.001, this.tackleUntil - recoverStart)
          )
        );
        frame =
          this.stumbling && progress < 0.55
            ? 4
            : 5 +
              Math.min(
                2,
                Math.floor(
                  (this.stumbling ? (progress - 0.55) / 0.45 : progress) * 3
                )
              );
      }
      this.sprite.setTexture(playerTexture(this.kit), `tackle${frame + 1}`);
    } else if (this.shooting) {
      // left alone until it completes
    } else if (this.role === 'keeper' && this.holding) {
      const moving = this.speed > 10;
      this.sprite.play(holdAnim(this.kit, moving), true);
      this.sprite.anims.timeScale = moving ? this.speed / 220 : 1;
    } else if (this.speed > 10) {
      const vertical = Math.sin(this.heading);
      // Separate enter/exit thresholds avoid flicker around diagonal headings.
      const threshold =
        this.runView === 'up' || this.runView === 'down' ? 0.72 : 0.82;
      const diagonalThreshold =
        this.runView === 'up-diagonal' || this.runView === 'down-diagonal'
          ? 0.28
          : 0.38;
      this.runView =
        Math.abs(vertical) > threshold
          ? vertical < 0
            ? 'up'
            : 'down'
          : vertical < -diagonalThreshold
            ? 'up-diagonal'
            : vertical > diagonalThreshold
              ? 'down-diagonal'
              : 'side';
      this.sprite.play(runAnim(this.kit, this.runView), true);
      // Leg cycle speeds up with running speed (sprint ~1.5x).
      this.sprite.anims.timeScale = this.speed / 220;
    } else {
      this.sprite.play(idleAnim(this.kit), true);
      this.sprite.anims.timeScale = 1;
    }
    const cos = Math.cos(this.heading);
    if (this.celebrating) {
      if (Math.abs(cos) > 0.2) this.sprite.setFlipX(cos < 0);
    } else if (hurting) {
      this.sprite.setFlipX(Math.cos(this.hurtDir) < 0);
    } else if (diving) {
      // The supplied six-pose sheet reaches left; mirror for rightward dives.
      this.sprite.setFlipX(Math.cos(this.diveDir) >= 0);
    } else if (tackling) {
      this.sprite.setFlipX(Math.cos(this.tackleDir) < 0);
    } else if (
      !this.shooting &&
      !this.holding &&
      this.speed > 10 &&
      (this.runView === 'up' || this.runView === 'down')
    ) {
      this.sprite.setFlipX(false);
    } else if (Math.abs(cos) > 0.2) this.sprite.setFlipX(cos < 0);

    const carrying = this.sprite.frame.name.startsWith('carry');
    this.heldBallScreen.visible =
      this.holding && (carrying || this.sprite.frame.name.startsWith('hold'));
    this.heldBallScreen.behindHands = carrying;
    if (this.heldBallScreen.visible) {
      const frame = Number(this.sprite.frame.name.slice(carrying ? 5 : 4)) - 1;
      const handX = carrying
        ? ([495, 459, 485, 500, 441, 455][frame] ?? 495)
        : ([335, 345, 334, 339][frame] ?? 335);
      const handY = carrying
        ? ([321, 324, 323, 314, 314, 311][frame] ?? 321)
        : ([376, 345, 376, 376][frame] ?? 376);
      const sign = this.sprite.flipX ? -1 : 1;
      this.heldBallScreen.x =
        feet.x + sign * ((handX - 320) / 724) * PLAYER_HEIGHT * feet.scale;
      this.heldBallScreen.y =
        feet.y + ((handY - 681) / 724) * PLAYER_HEIGHT * feet.scale;
      this.heldBallScreen.scale = feet.scale;
    }

    // Skin and hair layers copy the body's final pose for this frame.
    for (const layer of [this.skinLayer, this.hairLayer])
      layer
        .setFrame(this.sprite.frame.name)
        .setPosition(this.sprite.x, this.sprite.y)
        .setScale(this.sprite.scaleX, this.sprite.scaleY)
        .setAngle(this.sprite.angle)
        .setFlipX(this.sprite.flipX)
        .setDepth(this.sprite.depth);

    // The pass-target ring (a perspective-squashed circle) and overhead
    // markers, which keep a fixed screen size and sit just above the sprite.
    // The controlled player is marked by the arrow overhead and the facing
    // arrow on the ground (drawn by the Match scene).
    const top = feet.y - PLAYER_HEIGHT * feet.scale;
    const squash = projector.groundSquash(x, y);
    projector.project(x, y, 0, feet);
    const ringScale = PX * feet.scale;
    const pulse = 1 + 0.15 * Math.sin(timeSec * 10);
    this.targetRing
      .setVisible(this.passTarget && !this.controlled)
      .setPosition(feet.x, feet.y)
      .setScale(ringScale * pulse, ringScale * squash * pulse)
      .setDepth(y - 1);
    this.arrow.setVisible(this.controlled).setPosition(head.x, top - 8 * PX);

    // Stamina bar over the controlled player's head; flashes red while locked.
    const show = this.controlled;
    const frac = this.stamina / STAMINA.max;
    const color = this.sprintLocked
      ? PAL.red
      : frac > 0.6
        ? PAL.green
        : frac > 0.3
          ? PAL.yellow
          : PAL.orange;
    const left = head.x - ((BAR_W + 2) * PX) / 2;
    const barY = top - 3 * PX;
    this.barBg.setVisible(show).setPosition(left, barY);
    this.barFill
      .setVisible(
        show &&
          (!this.sprintLocked || Math.floor((timeSec * 1000) / 150) % 2 === 0)
      )
      .setPosition(left + PX, barY)
      .setSize(Math.max(1, Math.round(frac * BAR_W)) * PX, PX)
      .setFillStyle(color);
  }
}
