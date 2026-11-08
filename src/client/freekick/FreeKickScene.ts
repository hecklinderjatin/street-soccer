import Phaser from 'phaser';
import { BALL, FREE_KICK as FK } from '../../shared/tuning';
import { BALL_KEY, createBallTexture } from '../art/ballArt';
import { matchAssets, queueAssets, type Asset } from '../art/gameAssets';
import { createCourtTextures } from '../art/pitchArt';
import { registerPlayerAtlases } from '../art/playerArt';
import { startingConfig } from '../challenge';
import { releaseEarlyDownloads, withEarlyDownloads } from '../earlyAssets';
import { playAttempt, playReady } from '../playMetrics';
import { newProjected } from '../render/Projector';
import { PAL, PX } from '../ui/palette';
import { createPixelFont, pixelText } from '../ui/pixelFont';
import { setSoundMuted, soundMuted } from '../ui/soundSetting';
import { StreamMusic } from '../ui/streamMusic';
import { TextButton } from '../ui/TextButton';
import { KickCamera } from './KickCamera';
import { Stage } from './Stage';
import {
  BAR_Z,
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  STEP,
  aimAtGoalLine,
  ballContact,
  levelFor,
  makeKick,
  powerBand,
  readSwipe,
  scoreGoal,
  startPlay,
  stepBall,
  stepPlay,
  strikeBall,
  type KickPlay,
  type KickSetup,
  type Outcome,
  type ScreenPoint,
  type Strike,
} from './rules';

type Phase = 'loading' | 'aim' | 'runup' | 'flight' | 'next' | 'over';

const MUSIC_VOLUME = 0.8; // the match's mix
const EFFECTS_VOLUME = 0.25;
const SOUND_FILES: readonly [string, string][] = [
  ['ball-strike', 'shoot'],
  ['goal-celebration', 'goal'],
  ['match-start', 'start'],
  ['match-over', 'stop'],
  ['goal-miss', 'goal-miss'],
];
const BEST_KEY = 'street-soccer-freekick-best';
const HUD = 10_000_000; // over the whole world
const R = BALL.radius;
type Gesture = { id: number; mode: 'contact' | 'power' | 'swipe' };

const BANNER: Record<Outcome, string> = {
  goal: 'GOAL!',
  saved: 'SAVED!',
  wall: 'OFF THE WALL',
  post: 'OFF THE POST',
  over: 'OVER THE BAR',
  wide: 'WIDE',
  short: 'TOO SOFT',
};

// What to try next after a miss (shown on the retry).
function advice(play: KickPlay) {
  const outcome = play.outcome;
  if (outcome === 'wall' && play.blockedBy === 'lyer')
    return 'A MAN LIES BEHIND THE WALL: GO OVER OR AROUND';
  if (outcome === 'wall' && play.wall.jumpAt === Infinity)
    return 'THE WALL STAYED DOWN: GO HIGHER OR CURL AROUND';
  if (outcome === 'wall')
    return 'GO OVER, CURL AROUND, OR DRIVE LOW UNDER THE JUMP';
  if (outcome === 'saved' && play.keeper.guessY !== null)
    return 'THE KEEPER GUESSED RIGHT: TRY THE OTHER CORNER';
  if (outcome === 'over') return 'USE LESS POWER OR STRIKE HIGHER';
  if (outcome === 'short') return 'ADD POWER WITH THE SLIDER';
  if (outcome === 'saved') return 'AIM FOR THE CORNERS';
  if (outcome === 'wide') return 'AIM INSIDE THE POSTS';
  if (outcome === 'post') return 'SO CLOSE! A LITTLE INSIDE';
  return '';
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0; // storage can be unavailable inside an embedded browser
  }
}

function writeBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // the best only lasts this session
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const at = newProjected();

// Free Kick mode: set contact and power, then swipe up to aim and shoot.
// Goals raise the level with more men in the wall, a sharper keeper and
// longer spots. A miss costs a life and leaves a ghost for the retry.
export class FreeKickScene extends Phaser.Scene {
  private readonly cam = new KickCamera();
  private readonly reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  private stage: Stage | null = null;
  private music: StreamMusic | null = null;
  private phase: Phase = 'loading';
  private phaseAt = 0; // clock time the phase began
  private clock = 0; // seconds since the scene started

  private score = 0;
  private goals = 0;
  private lives: number = FK.lives;
  private streak = 0;
  private bestStreak = 0;
  private setup: KickSetup = makeKick(levelFor(0), Math.random);
  private contact = ballContact(0, 0);
  private power: number = FK.defaultPower;
  private band: ReturnType<typeof powerBand> = null;
  private retry = false;
  private measure = playAttempt('freekick');
  private lastPower: number | null = null; // the miss being retaken
  private hint = '';
  private strike: Strike | null = null;
  private play: KickPlay | null = null;
  private prevBall = { x: 0, y: 0, z: 0 };
  private acc = 0;
  private slowUntil = 0;
  private outcomeAt = 0;
  private zoomAnchor = { x: 0, y: 0 };

  private gesture: Gesture | null = null;
  private swipe: ScreenPoint[] = [];

  private scoreText!: Phaser.GameObjects.BitmapText;
  private scoreLabel!: Phaser.GameObjects.BitmapText;
  private streakText!: Phaser.GameObjects.BitmapText;
  private kickText!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private banner!: Phaser.GameObjects.BitmapText;
  private bannerSub!: Phaser.GameObjects.BitmapText;
  private contactStyle!: Phaser.GameObjects.BitmapText;
  private powerLabel!: Phaser.GameObjects.BitmapText;
  private powerValue!: Phaser.GameObjects.BitmapText;
  private controls!: Phaser.GameObjects.Graphics;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private soundButton!: TextButton;
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private card: Phaser.GameObjects.GameObject[] = [];
  private bestBefore = 0; // the device's best when this run ended

  constructor() {
    super('FreeKick');
  }

  create() {
    createPixelFont(this);
    this.buildHud();
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => {
      this.gesture = null;
      this.music?.pause();
    });
    this.game.events.on(Phaser.Core.Events.VISIBLE, () => this.music?.resume());

    // The art usually started downloading before this code arrived
    // (earlyAssets.ts); the loader then reads those copies.
    const assets = matchAssets(startingConfig());
    void withEarlyDownloads(assets).then((ready) => {
      if (!queueAssets(this, ready)) return this.ready(assets);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.ready(assets));
      this.load.start();
    });
  }

  private ready(assets: readonly Asset[]) {
    void releaseEarlyDownloads(assets);
    registerPlayerAtlases(this);
    createBallTexture(this);
    createCourtTextures(this);
    const config = startingConfig();
    this.stage = new Stage(this, {
      kicker: config.home.jersey,
      wall: config.away.jersey,
    });
    this.lifeIcons = Array.from({ length: FK.lives }, () =>
      this.add.image(0, 0, BALL_KEY, 'a').setDepth(HUD)
    );
    const loader = document.getElementById('boot-loading');
    loader?.classList.add('done');
    setTimeout(() => loader?.remove(), 400);
    this.loadSounds();
    const sound = this.sound;
    this.music = new StreamMusic(
      '/audio/bgm.mp3',
      MUSIC_VOLUME,
      sound instanceof Phaser.Sound.WebAudioSoundManager
        ? { context: sound.context, destination: sound.destination }
        : undefined
    );
    this.music.setMuted(soundMuted());
    this.music.play(); // or on the first touch, if the browser refuses
    this.newKick(false);
    this.layout();
    playReady('freekick');
  }

  // Effects load in the background; each plays only once it is in.
  private loadSounds() {
    let queued = 0;
    for (const [key, file] of SOUND_FILES) {
      if (this.cache.audio.exists(key)) continue;
      this.load.audio(key, `/audio/${file}.mp3`);
      queued++;
    }
    if (queued) this.load.start();
  }

  private sfx(key: string) {
    if (!this.cache.audio.exists(key) || this.sound.locked) return;
    this.sound.stopByKey(key);
    this.sound.play(key, { volume: EFFECTS_VOLUME });
  }

  // ---- Kicks --------------------------------------------------------------

  // The next kick: a new spot after a goal (or a new run), the same one
  // again after a miss.
  private newKick(retry: boolean) {
    if (!retry) {
      this.setup = makeKick(levelFor(this.goals), Math.random);
      this.lastPower = null;
      this.contact = ballContact(0, 0);
      this.power = FK.defaultPower;
    }
    this.retry = retry;
    this.band = powerBand(this.setup, this.contact);
    this.play = null;
    this.strike = null;
    this.acc = 0;
    this.frameCamera();
    this.stage?.setKick(this.cam, retry);
    this.banner.setVisible(false);
    this.bannerSub.setVisible(false);
    // What the player can read before the kick: a man lying behind the
    // wall, a keeper cheating toward it.
    const read = this.setup.wall.lyer
      ? 'A MAN LIES BEHIND THE WALL'
      : this.setup.keeperStyle === 'cheat'
        ? 'KEEPER CHEATS TO THE WALL SIDE'
        : '';
    this.hintText.setText(
      this.hint || read || 'DRAG DOT  /  SWIPE UP ON PITCH TO SHOOT'
    );
    this.hint = '';
    const metres = Math.round(this.setup.distance / FK.pxPerMetre);
    this.kickText.setText(
      `${this.retry ? 'RETRY' : `LEVEL ${this.setup.level.level}`}  ${metres} M`
    );
    this.updateHud();
    this.setPhase('aim');
  }

  private frameCamera() {
    this.cam.frame(this.setup.spot, this.scale.width, this.scale.height);
    this.cam.project(GOAL_X, GOAL_Y, BAR_Z / 2, at);
    this.zoomAnchor = { x: at.x, y: at.y };
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.phaseAt = this.clock;
  }

  // Both the preview and the shot use the same launch settings.
  private aimedStrike(swipe: ReturnType<typeof readSwipe>): Strike {
    const strike = { power: this.power, targetY: GOAL_Y, contact: this.contact };
    if (!swipe) return strike;
    const z = BAR_Z * FK.aimHeight;
    const { spot } = this.setup;
    this.cam.project(GOAL_X, GOAL_Y - POST_HALF, z, at);
    const a = { sx: at.x, sy: at.y, y: GOAL_Y - POST_HALF };
    this.cam.project(GOAL_X, GOAL_Y + POST_HALF, z, at);
    const b = { sx: at.x, sy: at.y, y: GOAL_Y + POST_HALF };
    this.cam.project(spot.x, spot.y, R, at);
    strike.targetY =
      aimAtGoalLine(at, swipe.dirX, swipe.dirY, a, b) ?? GOAL_Y;
    return strike;
  }

  private shoot(strike: Strike) {
    this.measure('kickoff');
    this.strike = strike;
    this.hintText.setText('');
    this.setPhase('runup');
  }

  private strikeBall() {
    if (!this.strike) return;
    this.measure('first_shot');
    this.play = startPlay(this.setup, this.strike, Math.random);
    const b = this.play.ball;
    this.prevBall = { x: b.x, y: b.y, z: b.z };
    this.sfx('ball-strike');
    this.setPhase('flight');
  }

  // Fixed steps, slowed for a goal; the ball is drawn between the last two.
  private fly(dt: number) {
    const play = this.play;
    if (!play || !this.stage) return;
    this.acc += dt * (this.clock < this.slowUntil ? FK.slowMoScale : 1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const b = play.ball;
      this.prevBall = { x: b.x, y: b.y, z: b.z };
      const decided = play.outcome !== null;
      stepPlay(play, STEP);
      if (play.outcome === null || play.t - play.outcomeAt < 0.15)
        this.stage.recordTrail(play);
      if (!decided && play.outcome !== null) this.onOutcome(play);
    }
    if (play.outcome !== null && this.clock - this.outcomeAt >= FK.resultSec)
      this.endKick();
  }

  private onOutcome(play: KickPlay) {
    this.outcomeAt = this.clock;
    const outcome = play.outcome;
    if (!outcome) return;
    if (outcome === 'goal') {
      this.measure('first_goal');
      const level = levelFor(this.goals).level;
      this.goals++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const { points, tags } = scoreGoal(play, this.streak);
      this.score += points;
      const up = levelFor(this.goals).level > level;
      // One line per style tag: all five side by side overflow the view.
      this.showBanner('GOAL!', PAL.yellow, [`+${points}`, ...tags].join('\n'));
      if (up) this.hint = `LEVEL ${level + 1}! THE WALL GETS TOUGHER`;
      this.sfx('goal-celebration');
      if (!this.reducedMotion.matches) {
        this.slowUntil = this.clock + FK.slowMoSec;
        this.cameras.main.shake(220, 0.006);
      }
    } else {
      this.lives--;
      this.streak = 0;
      this.lastPower = this.strike?.power ?? null;
      this.showBanner(
        BANNER[outcome],
        outcome === 'saved' ? PAL.blue : PAL.orange,
        this.lives > 0
          ? `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`
          : ''
      );
      this.hint = advice(play);
      this.sfx('goal-miss');
    }
    this.updateHud();
  }

  private endKick() {
    this.setPhase('next');
    if (this.lives <= 0) {
      this.gameOver();
      return;
    }
    const goal = this.play?.outcome === 'goal';
    const half = (FK.fadeSec * 1000) / 2;
    const main = this.cameras.main;
    main.fadeOut(half, 0x1d, 0x2b, 0x53);
    main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.newKick(!goal);
      main.fadeIn(half, 0x1d, 0x2b, 0x53);
    });
  }

  private gameOver() {
    this.measure('completed');
    this.setPhase('over');
    this.sfx('match-over');
    this.bestBefore = readBest();
    if (this.score > this.bestBefore) writeBest(this.score);
    this.showCard();
  }

  private restart() {
    this.measure('rematch_tap');
    this.measure = playAttempt('freekick');
    for (const node of this.card) node.destroy();
    this.card = [];
    this.score = this.goals = this.streak = this.bestStreak = 0;
    this.lives = FK.lives;
    this.hint = '';
    this.sfx('match-start');
    this.newKick(false);
  }

  // ---- Input --------------------------------------------------------------

  private contactLayout() {
    const { spot } = this.setup;
    this.cam.project(spot.x, spot.y, R, at);
    const radius = R * at.scale;
    return {
      x: at.x,
      y: at.y,
      radius: radius * 0.86,
      frame: Math.max(48, radius + 9),
    };
  }

  private powerLayout() {
    const height = this.scale.height;
    const top = height * 0.43;
    return { x: 76, top, bottom: top + Math.min(330, height * 0.26) };
  }

  private onDown(
    pointer: Phaser.Input.Pointer,
    over: Phaser.GameObjects.GameObject[]
  ) {
    if (this.phase !== 'aim' || this.gesture || over.length > 0) return;
    const ball = this.contactLayout();
    const slider = this.powerLayout();
    if (
      Math.abs(pointer.x - ball.x) <= ball.frame &&
      Math.abs(pointer.y - ball.y) <= ball.frame
    ) {
      this.gesture = { id: pointer.id, mode: 'contact' };
      this.onMove(pointer);
      return;
    }
    if (
      Math.abs(pointer.x - slider.x) <= 58 &&
      pointer.y >= slider.top - 54 &&
      pointer.y <= slider.bottom + 58
    ) {
      this.gesture = { id: pointer.id, mode: 'power' };
      this.onMove(pointer);
      return;
    }
    this.gesture = { id: pointer.id, mode: 'swipe' };
    this.swipe = [{ x: pointer.x, y: pointer.y }];
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.gesture?.id) return;
    if (this.gesture.mode === 'contact') {
      const ball = this.contactLayout();
      this.contact = ballContact(
        (pointer.x - ball.x) / ball.radius,
        (pointer.y - ball.y) / ball.radius
      );
      this.band = powerBand(this.setup, this.contact);
      return;
    }
    if (this.gesture.mode === 'power') {
      const slider = this.powerLayout();
      this.power = Phaser.Math.Clamp(
        (slider.bottom - pointer.y) / (slider.bottom - slider.top),
        0,
        1
      );
      return;
    }
    this.swipe[1] = { x: pointer.x, y: pointer.y };
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.gesture?.id) return;
    const cancelled = pointer.event?.type === 'touchcancel';
    if (!cancelled) this.onMove(pointer);
    const { mode } = this.gesture;
    this.gesture = null;
    if (cancelled || mode !== 'swipe' || this.phase !== 'aim') return;
    const swipe = readSwipe(this.swipe);
    if (!swipe) {
      this.hintText.setText('SWIPE UP TOWARD THE GOAL');
      return;
    }
    this.shoot(this.aimedStrike(swipe));
  }

  // ---- Frame --------------------------------------------------------------

  override update(_time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.clock += dt;
    if (!this.stage) return;
    if (this.phase === 'runup' && this.clock - this.phaseAt >= FK.runupSec)
      this.strikeBall();
    if (this.phase === 'flight') this.fly(dt);
    if (this.play?.outcome) this.stage.fadeTrail(dt);
    this.drawWorld();
    this.drawControls();
  }

  private drawWorld() {
    const stage = this.stage;
    if (!stage) return;
    const play = this.play;
    const { spot } = this.setup;
    const k =
      play && !this.reducedMotion.matches
        ? 1 + (FK.flightZoom - 1) * easeOut(Math.min(1, play.t / 0.9))
        : 1;
    this.cam.zoom(k, this.zoomAnchor.x, this.zoomAnchor.y);

    const alpha = this.acc / STEP;
    const b = play?.ball;
    const p = this.prevBall;
    const ball = b
      ? {
          x: p.x + (b.x - p.x) * alpha,
          y: p.y + (b.y - p.y) * alpha,
          z: p.z + (b.z - p.z) * alpha,
        }
      : { x: spot.x, y: spot.y, z: R };
    const goal = play?.outcome === 'goal';
    stage.render(this.cam, this.setup, play, {
      ball,
      ballAge: play ? play.t : Infinity,
      kicker: this.kickerPose(),
      timeSec: this.clock,
      goalFlash:
        goal && Math.floor((this.clock - this.outcomeAt) * 8) % 2 === 0,
    });
  }

  // Waiting behind and left of the ball, the run-up, the follow-through,
  // and a celebration after a goal.
  private kickerPose() {
    const { spot } = this.setup;
    const dx = GOAL_X - spot.x;
    const dy = GOAL_Y - spot.y;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    const place = (back: number, side: number) => ({
      x: spot.x - ux * back - uy * side,
      y: spot.y - uy * back + ux * side,
    });
    const start = place(FK.kickerStartBack, FK.kickerStartSide);
    const contact = place(FK.kickerContactBack, FK.kickerContactSide);
    if (this.phase === 'runup') {
      const t = Math.min(1, (this.clock - this.phaseAt) / FK.runupSec);
      return {
        x: start.x + (contact.x - start.x) * t,
        y: start.y + (contact.y - start.y) * t,
        frame: `run_up_diagonal${1 + Math.min(3, Math.floor(t * 4))}`,
      };
    }
    const play = this.play;
    if (!play) return { ...start, frame: 'run_up4' };
    const follow = Math.min(play.t, 0.25) * 60;
    const pose = { x: contact.x + ux * follow, y: contact.y + uy * follow };
    const since = this.clock - this.outcomeAt;
    if (play.outcome === 'goal' && since > 0.3)
      return {
        ...pose,
        frame: `celebrate_a${1 + (Math.floor(since * 6) % 6)}`,
      };
    return { ...pose, frame: play.t < 0.3 ? 'run_up_diagonal3' : 'run_up4' };
  }

  // Preview the first part of the actual flight up to the wall.
  private drawAimGuide() {
    const g = this.aimGuide;
    const swipe = this.gesture?.mode === 'swipe' ? readSwipe(this.swipe) : null;
    const ball = strikeBall(this.setup.spot, this.aimedStrike(swipe));
    const color = swipe ? PAL.white : PAL.blue;
    let tip: ScreenPoint | null = null;
    let tail: ScreenPoint | null = null;
    for (let i = 1; i <= 60; i++) {
      stepBall(ball, STEP);
      if (ball.x >= this.setup.wall.x) break;
      if (i % 6 !== 0) continue;
      this.cam.project(ball.x, ball.y, ball.z, at);
      tail = tip;
      tip = { x: at.x, y: at.y };
      g.fillStyle(PAL.ink, 0.85).fillCircle(at.x, at.y, 7);
      g.fillStyle(color).fillCircle(at.x, at.y, 4);
    }
    if (!tip || !tail) return;
    const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    g.fillStyle(color).fillTriangle(
      tip.x + 14 * dx,
      tip.y + 14 * dy,
      tip.x - 6 * dx - 9 * dy,
      tip.y - 6 * dy + 9 * dx,
      tip.x - 6 * dx + 9 * dy,
      tip.y - 6 * dy - 9 * dx
    );
  }

  private drawControls() {
    const g = this.controls.clear();
    this.aimGuide.clear();
    const show = this.phase === 'aim';
    this.contactStyle.setVisible(show);
    this.powerLabel.setVisible(show);
    this.powerValue.setVisible(show);
    if (!show) return;

    this.drawAimGuide();
    const ball = this.contactLayout();
    const { x, y, radius, frame } = ball;
    g.lineStyle(7, PAL.ink, 0.85)
      .strokeRoundedRect(x - frame, y - frame, frame * 2, frame * 2, 10);
    g.lineStyle(3, PAL.white, 0.9)
      .strokeRoundedRect(x - frame, y - frame, frame * 2, frame * 2, 10);
    const dotX = x + this.contact.x * radius;
    const dotY = y + this.contact.y * radius;
    g.fillStyle(PAL.ink).fillCircle(dotX, dotY, 12);
    g.fillStyle(PAL.yellow).fillCircle(dotX, dotY, 8);
    const curl = this.contact.x > 0 ? 'LEFT' : 'RIGHT';
    const curls = Math.abs(this.contact.x) >= 0.25;
    const style =
      this.contact.y >= 0.25 ? 'CHIP' : this.contact.y <= -0.25 ? 'LOW' : '';
    this.contactStyle
      .setText(curls ? `${style || 'CURL'} ${curl}` : style || 'POWER SHOT')
      .setPosition(x, y + frame + 20);
    const labelWidth = this.contactStyle.width + 28;
    g.fillStyle(PAL.ink, 0.88)
      .fillRoundedRect(x - labelWidth / 2, y + frame + 11, labelWidth, 35, 8);

    const { x: sx, top, bottom } = this.powerLayout();
    const yOf = (power: number) => bottom - (bottom - top) * power;
    const handle = yOf(this.power);
    g.fillStyle(PAL.ink, 0.92)
      .fillRoundedRect(sx - 55, top - 54, 110, bottom - top + 112, 14);
    g.lineStyle(2, PAL.lightGray, 0.6)
      .strokeRoundedRect(sx - 55, top - 54, 110, bottom - top + 112, 14);
    g.fillStyle(PAL.navy)
      .fillRoundedRect(sx - 17, top, 34, bottom - top, 5);
    g.fillStyle(PAL.blue).fillRect(sx - 12, handle, 24, bottom - handle);
    const band = this.band;
    if (band)
      g.fillStyle(PAL.green).fillRect(
        sx + 26,
        yOf(band.hi),
        6,
        Math.max(4, yOf(band.lo) - yOf(band.hi))
      );
    if (this.lastPower !== null)
      g.fillStyle(PAL.orange).fillRect(sx - 36, yOf(this.lastPower) - 2, 10, 4);
    g.fillStyle(PAL.white).fillRoundedRect(sx - 24, handle - 9, 48, 18, 4);
    this.powerValue.setText(`${Math.round(this.power * 100)}%`);
  }

  // ---- HUD ----------------------------------------------------------------

  private buildHud() {
    const text = (size: number, color: number = PAL.white) =>
      pixelText(this, 0, 0, '', size, color).setDepth(HUD);
    this.scoreLabel = text(2, PAL.lightGray).setText('SCORE');
    this.scoreText = text(6);
    this.streakText = text(3, PAL.yellow);
    this.kickText = text(3).setOrigin(0.5, 0);
    this.hintText = text(2).setOrigin(0.5, 1).setDepth(HUD + 2);
    this.banner = text(10).setOrigin(0.5).setVisible(false);
    this.bannerSub = text(3, PAL.white)
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setVisible(false);
    this.aimGuide = this.add.graphics().setDepth(HUD);
    this.controls = this.add.graphics().setDepth(HUD + 2);
    const label = (size: number, color: number) =>
      text(size, color).setDepth(HUD + 3).setOrigin(0.5, 0).setVisible(false);
    this.contactStyle = label(2, PAL.yellow);
    this.powerLabel = label(2, PAL.white).setText('POWER');
    this.powerValue = label(3, PAL.white);

    // One master sound switch, as in the match.
    setSoundMuted(this.sound, soundMuted());
    this.soundButton = new TextButton(
      this,
      0,
      0,
      '',
      () => {
        setSoundMuted(this.sound, !soundMuted());
        this.music?.setMuted(soundMuted());
        drawSound();
      },
      { width: 72, height: 64, fill: PAL.darkGray }
    );
    this.soundButton.setDepth(HUD + 2);
    const speaker = this.add.graphics();
    this.soundButton.add(speaker);
    const drawSound = () => {
      speaker.clear();
      const mute = soundMuted();
      speaker.fillStyle(mute ? PAL.lightGray : PAL.green);
      const rows = [
        '....#......',
        '...##..#...',
        '.####...#..',
        '.####...#..',
        '.####...#..',
        '...##..#...',
        '....#......',
      ];
      rows.forEach((row, y) =>
        [...row].forEach((pixel, x) => {
          if (pixel === '#' && (x < 5 || !mute))
            speaker.fillRect((x - 5) * PX, (y - 3) * PX, PX, PX);
        })
      );
      if (mute) {
        speaker.fillStyle(PAL.red);
        for (let i = 0; i < 7; i++)
          speaker.fillRect((i - 3) * PX, (3 - i) * PX, PX, PX);
      }
      this.soundButton.setFill(mute ? PAL.darkGray : PAL.darkGreen);
    };
    drawSound();
  }

  // Places the HUD for the current view size and reframes the kick.
  private layout() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.scoreLabel.setPosition(24, 24);
    this.scoreText.setPosition(24, 44);
    this.streakText.setPosition(24, 100);
    this.kickText.setPosition(W / 2, 132);
    this.hintText.setPosition(W / 2, H - 36);
    this.banner.setPosition(W / 2, H * 0.6);
    this.bannerSub.setPosition(W / 2, H * 0.6 + 56);
    const slider = this.powerLayout();
    this.powerLabel.setPosition(slider.x, slider.top - 39);
    this.powerValue.setPosition(slider.x, slider.bottom + 19);
    this.soundButton.setPosition(W - 60, 56);
    this.lifeIcons.forEach((icon, i) =>
      icon.setPosition(W - 120 - (FK.lives - 1 - i) * 44, 56).setScale(36 / 64)
    );
    if (this.stage) this.frameCamera();
    if (this.phase === 'over') this.showCard();
  }

  private updateHud() {
    this.scoreText.setText(String(this.score));
    const multiplier = Math.min(
      FK.streakMax,
      1 + FK.streakStep * Math.max(0, this.streak - 1)
    );
    this.streakText.setText(
      this.streak >= 2 ? `STREAK ${this.streak}  X${multiplier}` : ''
    );
    this.lifeIcons.forEach((icon, i) =>
      icon.setAlpha(i < this.lives ? 1 : 0.2)
    );
  }

  private showBanner(text: string, color: number, sub: string) {
    const W = this.scale.width;
    const size = Math.max(
      4,
      Math.min(12, Math.floor((W - 48) / (text.length * 7))) // 7 px font cells
    );
    this.tweens.killTweensOf(this.banner);
    this.banner
      .setText(text)
      .setFontSize(size * 7)
      .setTint(color)
      .setVisible(true)
      .setScale(this.reducedMotion.matches ? 1 : 0.5);
    if (!this.reducedMotion.matches)
      this.tweens.add({
        targets: this.banner,
        scale: 1,
        duration: 260,
        ease: 'Back.Out',
      });
    this.bannerSub.setText(sub).setVisible(sub !== '');
  }

  // Results: score, goals, best streak and the best score on this device.
  private showCard() {
    for (const node of this.card) node.destroy();
    this.banner.setVisible(false);
    this.bannerSub.setVisible(false);
    this.hintText.setText('');
    const W = this.scale.width;
    const H = this.scale.height;
    const best = this.bestBefore;
    const line = (y: number, value: string, size: number, color: number) =>
      pixelText(this, W / 2, y, value, size, color)
        .setOrigin(0.5)
        .setDepth(HUD + 11);
    const again = new TextButton(
      this,
      W / 2,
      H * 0.68,
      'PLAY AGAIN',
      () => this.restart(),
      { width: 400, height: 96, textSize: 5 }
    );
    again.setDepth(HUD + 11);
    this.card = [
      this.add
        .rectangle(0, 0, W, H, PAL.black, 0.72)
        .setOrigin(0)
        .setDepth(HUD + 10)
        .setInteractive(), // swallows taps meant for the kick behind
      line(H * 0.26, 'OUT OF LIVES', 7, PAL.white),
      line(H * 0.36, 'SCORE', 3, PAL.lightGray),
      line(H * 0.41, String(this.score), 12, PAL.yellow),
      line(
        H * 0.49,
        `GOALS ${this.goals}   BEST STREAK ${this.bestStreak}`,
        3,
        PAL.white
      ),
      line(
        H * 0.54,
        this.score > best ? 'NEW BEST!' : `BEST ${best}`,
        4,
        this.score > best ? PAL.green : PAL.lightGray
      ),
      again,
    ];
  }
}
