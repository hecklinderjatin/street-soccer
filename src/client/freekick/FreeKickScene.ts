import { context, exitExpandedMode } from '@devvit/web/client';
import { launchSpeedKmh } from '../../shared/goalSpeed';
import type { FreeKickStats } from '../../shared/freeKick';
import { FreeKickRecords } from './records';
import { freeKickResults } from './results';
import { pixelLabel } from '../ui/pixelLabel';
import { practiceLevel } from './mode';
import { buildFreeKickOverlay, type FreeKickOverlay } from './overlay';
import {
  freeKickControls,
  freeKickGesture,
  type FreeKickGesture,
} from './controls';
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
  stepPlay,
  type KickPlay,
  type KickSetup,
  type Outcome,
  type ScreenPoint,
  type Strike,
  type Swipe,
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
type Gesture = { id: number; mode: FreeKickGesture };

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
// longer spots. A miss costs a life and retries the same spot.
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

  private practice = false;
  private practiceLevel = 1;
  private records = new FreeKickRecords();
  private shots = 0;
  private shotKmh = 0;
  private fastestGoalKmh = 0;
  private runStartedAt = 0;
  private introPending = false;
  private resultScreen: ReturnType<typeof freeKickResults> | null = null;
  private quitButton: HTMLAnchorElement | null = null;
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
  private swipeTrailUntil = 0;
  private swipeTrail!: Phaser.GameObjects.Graphics;
  private contactBall: Phaser.GameObjects.Image | null = null;

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
  private swipeLabel!: Phaser.GameObjects.BitmapText;
  private launchLabel!: Phaser.GameObjects.BitmapText;
  private controls!: Phaser.GameObjects.Graphics;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private soundButton!: TextButton;
  private infoButton!: TextButton;
  private pauseButton!: TextButton;
  private overlay: FreeKickOverlay = null;
  private helpReturn: 'pause' | null = null;
  private overlayLayer: Phaser.GameObjects.Container | null = null;
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private card: Phaser.GameObjects.GameObject[] = [];
  private bestBefore = 0; // the device's best when this run ended

  constructor() {
    super('FreeKick');
  }

  create() {
    this.practice = this.registry.get('freekickPractice') === true;
    this.practiceLevel = practiceLevel(
      this.registry.get('freekickPracticeLevel')
    );
    if (this.practice) this.measure = () => {};
    this.overlay = null;
    this.helpReturn = null;
    this.overlayLayer = null;
    createPixelFont(this);
    this.buildHud();
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.cancelGesture,
      this
    );
    const hidden = () => {
      this.resetGesture();
      this.music?.pause();
    };
    const visible = () => {
      if (this.overlay === null && this.phase !== 'over') this.music?.resume();
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, hidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, visible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, hidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, visible);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.resultScreen?.destroy();
      this.quitButton?.remove();
    });

    this.input.keyboard?.addCapture(['ESC', 'TAB']);
    this.input.keyboard?.on('keydown-ESC', (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      if (this.overlay === 'details' && this.introPending)
        this.setOverlay('help');
      else if (this.overlay === 'details' || this.overlay === 'help')
        this.finishInfo();
      else this.setOverlay(this.overlay ? null : 'pause');
    });
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      if (this.overlay === 'details') this.setOverlay('help');
      else if (this.overlay === 'help') this.finishInfo();
      else this.setOverlay('details');
    });

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
    this.contactBall = this.add
      .image(0, 0, BALL_KEY, 'a')
      .setDepth(HUD + 1)
      .setVisible(false);
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
    this.drawWorld();
    this.introPending = true;
    this.setOverlay('details');
    if (!this.practice) playReady('freekick');
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
    this.resetGesture();
    if (!retry) {
      this.setup = makeKick(
        levelFor(
          this.practice
            ? (this.practiceLevel - 1) * FK.goalsPerLevel
            : this.goals
        ),
        Math.random
      );
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
    this.stage?.setKick(this.cam);
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
      this.hint || read || 'SET POWER + SHOT TYPE ON LEFT. SWIPE TO SHOOT'
    );
    this.hint = '';
    const metres = Math.round(this.setup.distance / FK.pxPerMetre);
    this.kickText.setText(
      `${this.practice ? `PRACTICE LEVEL ${this.setup.level.level}` : this.retry ? 'RETRY' : `LEVEL ${this.setup.level.level}`}  ${metres} M`
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

  // The arrow and the shot use the same aim point, including the wide limit.
  private aimTarget(swipe: Swipe) {
    const z = BAR_Z * FK.aimHeight;
    const { spot } = this.setup;
    this.cam.project(GOAL_X, GOAL_Y - POST_HALF, z, at);
    const a = { sx: at.x, sy: at.y, y: GOAL_Y - POST_HALF };
    this.cam.project(GOAL_X, GOAL_Y + POST_HALF, z, at);
    const b = { sx: at.x, sy: at.y, y: GOAL_Y + POST_HALF };
    this.cam.project(spot.x, spot.y, R, at);
    return aimAtGoalLine(at, swipe.dirX, swipe.dirY, a, b) ?? GOAL_Y;
  }

  private shoot(strike: Strike) {
    if (this.shots === 0) {
      this.runStartedAt = this.clock;
      if (!this.practice) this.records.start();
    }
    this.shots++;
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
    this.shotKmh = launchSpeedKmh(b.vx, b.vy, b.vz);
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
      this.fastestGoalKmh = Math.max(this.fastestGoalKmh, this.shotKmh);
      this.measure('first_goal');
      const level = levelFor(this.goals).level;
      this.goals++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const { points, tags } = scoreGoal(play, this.streak);
      this.score += points;
      const up = !this.practice && levelFor(this.goals).level > level;
      // One line per style tag: all five side by side overflow the view.
      this.showBanner('GOAL!', PAL.yellow, [`+${points}`, ...tags].join('\n'));
      if (up) this.hint = `LEVEL ${level + 1}! THE WALL GETS TOUGHER`;
      this.sfx('goal-celebration');
      if (!this.reducedMotion.matches) {
        this.slowUntil = this.clock + FK.slowMoSec;
        this.cameras.main.shake(220, 0.006);
      }
    } else {
      if (!this.practice) this.lives--;
      this.streak = 0;
      this.lastPower = this.strike?.power ?? null;
      this.showBanner(
        BANNER[outcome],
        outcome === 'saved' ? PAL.blue : PAL.orange,
        this.practice
          ? 'UNLIMITED PRACTICE'
          : this.lives > 0
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
    if (!this.practice && this.lives <= 0) {
      this.gameOver();
      return;
    }
    const goal = this.play?.outcome === 'goal';
    const half = (FK.fadeSec * 1000) / 2;
    const main = this.cameras.main;
    main.fadeOut(half, 0x1d, 0x2b, 0x53);
    main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.newKick(this.practice || !goal);
      main.fadeIn(half, 0x1d, 0x2b, 0x53);
    });
  }

  private gameOver() {
    if (this.practice) return;
    this.measure('completed');
    this.setPhase('over');
    this.sfx('match-over');
    this.music?.stop();
    this.bestBefore = readBest();
    if (this.score > this.bestBefore) writeBest(this.score);
    this.showCard();
  }

  private restart() {
    this.resultScreen?.destroy();
    this.resultScreen = null;
    this.records = new FreeKickRecords();
    this.shots = this.shotKmh = this.fastestGoalKmh = 0;
    this.runStartedAt = 0;
    this.measure('rematch_tap');
    this.measure = this.practice ? () => {} : playAttempt('freekick');
    for (const node of this.card) node.destroy();
    this.card = [];
    this.score = this.goals = this.streak = this.bestStreak = 0;
    this.lives = FK.lives;
    this.hint = '';
    this.sfx('match-start');
    this.newKick(false);
    this.music?.play();
    this.introPending = true;
    this.setOverlay('details');
  }

  // ---- Input --------------------------------------------------------------

  private ballLayout() {
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

  private contactLayout() {
    return freeKickControls(this.scale.width, this.scale.height).contact;
  }

  private powerLayout() {
    return freeKickControls(this.scale.width, this.scale.height).power;
  }

  private swipeHintLayout() {
    return { y: this.scale.height - 110, height: 90 };
  }

  private onDown(
    pointer: Phaser.Input.Pointer,
    over: Phaser.GameObjects.GameObject[]
  ) {
    if (
      this.overlay !== null ||
      this.phase !== 'aim' ||
      this.gesture ||
      over.length > 0
    )
      return;
    const mode = freeKickGesture(
      pointer,
      freeKickControls(this.scale.width, this.scale.height)
    );
    if (!mode) return;
    this.gesture = { id: pointer.id, mode };
    this.swipeTrailUntil = 0;
    if (mode === 'swipe') this.swipe = [{ x: pointer.x, y: pointer.y }];
    else this.onMove(pointer);
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
    this.swipe.push({ x: pointer.x, y: pointer.y });
    // Preserve the launch chord's first point and bound the visual trail.
    if (this.swipe.length > 96) this.swipe.splice(1, 1);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.gesture?.id) return;
    if (pointer.event?.type === 'touchcancel') {
      this.cancelGesture(pointer);
      return;
    }
    this.onMove(pointer);
    const { mode } = this.gesture;
    this.gesture = null;
    if (mode !== 'swipe' || this.phase !== 'aim') return;
    this.swipeTrailUntil = this.clock + 0.35;
    const swipe = readSwipe(this.swipe);
    if (swipe)
      this.shoot({
        power: this.power,
        contact: this.contact,
        targetY: this.aimTarget(swipe),
      });
  }

  private resetGesture() {
    this.gesture = null;
    this.swipe = [];
    this.swipeTrailUntil = 0;
    this.swipeTrail.clear();
  }

  private cancelGesture(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.gesture?.id) this.resetGesture();
  }

  // ---- Frame --------------------------------------------------------------

  override update(_time: number, deltaMs: number) {
    if (this.overlay !== null) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.clock += dt;
    if (!this.stage) return;
    if (this.phase === 'runup' && this.clock - this.phaseAt >= FK.runupSec)
      this.strikeBall();
    if (this.phase === 'flight') this.fly(dt);
    if (this.play?.outcome) this.stage.fadeTrail(dt);
    this.drawWorld();
    this.drawControls();
    this.drawSwipeTrail();
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

  private drawLaunchArrow(
    ball: ReturnType<FreeKickScene['ballLayout']>,
    swipe: Swipe,
    ready: boolean
  ) {
    const g = this.aimGuide;
    const targetY = this.aimTarget(swipe);
    this.cam.project(GOAL_X, targetY, BAR_Z * FK.aimHeight, at);
    const angle = Math.atan2(at.y - ball.y, at.x - ball.x);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const start = ball.frame / Math.max(Math.abs(dx), Math.abs(dy)) + 8;
    const x = ball.x + (start + 106) * dx;
    const y = ball.y + (start + 106) * dy;
    const color = ready ? PAL.yellow : PAL.white;
    const layers: [number, number, number][] = [
      [PAL.ink, 13, 15],
      [color, 6, 10],
    ];
    for (const [ink, width, head] of layers) {
      g.lineStyle(width, ink).lineBetween(
        ball.x + start * dx,
        ball.y + start * dy,
        x,
        y
      );
      g.fillStyle(ink).fillTriangle(
        x + head * dx,
        y + head * dy,
        x - 13 * dx - head * dy,
        y - 13 * dy + head * dx,
        x - 13 * dx + head * dy,
        y - 13 * dy - head * dx
      );
    }
    const labelX = Phaser.Math.Clamp(x, 145, this.scale.width - 145);
    g.fillStyle(PAL.ink, 0.9).fillRoundedRect(labelX - 123, y - 54, 246, 30, 7);
    this.launchLabel
      .setPosition(labelX, y - 47)
      .setTint(color)
      .setVisible(true);
  }

  private drawSwipeHint(swiping: boolean, ready: boolean) {
    // This is a hint, not a button: the clear pitch to the right accepts swipes.
    this.swipeLabel
      .setTint(ready ? PAL.yellow : PAL.white)
      .setText(
        ready
          ? 'RELEASE TO SHOOT'
          : swiping
            ? 'KEEP SWIPING UP'
            : 'SWIPE UP TO SHOOT'
      );
  }

  private drawSwipeTrail() {
    const g = this.swipeTrail.clear();
    const dragging = this.gesture?.mode === 'swipe';
    const alpha = dragging
      ? 1
      : Phaser.Math.Clamp((this.swipeTrailUntil - this.clock) / 0.35, 0, 1);
    if (alpha <= 0 || this.swipe.length < 2) return;
    for (let i = 1; i < this.swipe.length; i++) {
      const a = this.swipe[i - 1];
      const b = this.swipe[i];
      if (!a || !b) continue;
      const taper = 0.35 + (0.65 * i) / (this.swipe.length - 1);
      g.lineStyle(9 * taper, PAL.blue, 0.25 * alpha).lineBetween(
        a.x,
        a.y,
        b.x,
        b.y
      );
      g.lineStyle(3 * taper, PAL.white, 0.8 * alpha).lineBetween(
        a.x,
        a.y,
        b.x,
        b.y
      );
    }
  }

  private drawControls() {
    const g = this.controls.clear();
    this.aimGuide.clear();
    const show = this.phase === 'aim';
    const swiping = this.gesture?.mode === 'swipe';
    this.contactStyle.setVisible(show);
    this.contactBall?.setVisible(show);
    this.powerLabel.setVisible(show);
    this.powerValue.setVisible(show);
    this.swipeLabel.setVisible(show);
    this.launchLabel.setVisible(false);
    this.hintText.setVisible(show && !swiping);
    if (!show) return;

    const ball = this.contactLayout();
    const ready = swiping ? readSwipe(this.swipe) : null;
    const direction = ready ?? (swiping ? readSwipe(this.swipe, 8) : null);
    if (direction)
      this.drawLaunchArrow(this.ballLayout(), direction, ready !== null);
    this.drawSwipeHint(swiping, ready !== null);

    const { x, y, radius, frame } = ball;
    this.contactBall?.setPosition(x, y).setDisplaySize(radius * 2, radius * 2);
    g.lineStyle(7, PAL.ink, 0.85).strokeRoundedRect(
      x - frame,
      y - frame,
      frame * 2,
      frame * 2,
      10
    );
    g.lineStyle(
      3,
      this.gesture?.mode === 'contact' ? PAL.yellow : PAL.white,
      0.9
    ).strokeRoundedRect(x - frame, y - frame, frame * 2, frame * 2, 10);
    const dotX = x + this.contact.x * radius;
    const dotY = y + this.contact.y * radius;
    g.fillStyle(PAL.ink).fillCircle(dotX, dotY, 12);
    g.fillStyle(PAL.yellow).fillCircle(dotX, dotY, 8);
    const curl = this.contact.x > 0 ? 'LEFT' : 'RIGHT';
    const curls = Math.abs(this.contact.x) >= 0.25;
    const style =
      this.contact.y >= 0.25
        ? 'CHIP'
        : this.contact.y <= -0.25
          ? 'LOW DRIVE'
          : '';
    const curlLabel = `CURL ${curl}`;
    this.contactStyle
      .setText(
        curls
          ? style
            ? `${style}\n${curlLabel}`
            : curlLabel
          : style || 'POWER SHOT'
      )
      .setPosition(x, y + frame + 12);
    const labelWidth = this.contactStyle.width + 28;
    g.fillStyle(PAL.ink, 0.88).fillRoundedRect(
      x - labelWidth / 2,
      y + frame + 11,
      labelWidth,
      this.contactStyle.height + 8,
      8
    );

    const { x: sx, top, bottom } = this.powerLayout();
    const yOf = (power: number) => bottom - (bottom - top) * power;
    const handle = yOf(this.power);
    g.fillStyle(PAL.ink, 0.92).fillRoundedRect(
      sx - 55,
      top - 54,
      110,
      bottom - top + 112,
      14
    );
    g.lineStyle(2, PAL.lightGray, 0.6).strokeRoundedRect(
      sx - 55,
      top - 54,
      110,
      bottom - top + 112,
      14
    );
    g.fillStyle(PAL.navy).fillRoundedRect(sx - 17, top, 34, bottom - top, 5);
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
    g.fillStyle(
      this.gesture?.mode === 'power' ? PAL.yellow : PAL.white
    ).fillRoundedRect(sx - 24, handle - 9, 48, 18, 4);
    this.powerValue.setText(`${Math.round(this.power * 100)}%`);
  }

  // ---- HUD ----------------------------------------------------------------

  private buildHud() {
    const text = (size: number, color: number = PAL.white) =>
      pixelText(this, 0, 0, '', size, color).setDepth(HUD);
    this.scoreLabel = text(2, PAL.lightGray).setText(
      this.practice ? 'PRACTICE GOALS' : 'SCORE'
    );
    this.scoreText = text(6);
    this.streakText = text(3, PAL.yellow);
    this.kickText = text(3).setOrigin(0.5, 0);
    this.hintText = text(2)
      .setOrigin(0.5, 1)
      .setDepth(HUD + 2);
    this.banner = text(10).setOrigin(0.5).setVisible(false);
    this.bannerSub = text(3, PAL.white)
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setVisible(false);
    this.aimGuide = this.add.graphics().setDepth(HUD);
    this.controls = this.add.graphics().setDepth(HUD + 2);
    this.swipeTrail = this.add.graphics().setDepth(HUD + 4);
    const label = (size: number, color: number) =>
      text(size, color)
        .setDepth(HUD + 3)
        .setOrigin(0.5, 0)
        .setVisible(false);
    this.contactStyle = label(1.5, PAL.yellow).setCenterAlign();
    this.powerLabel = label(2, PAL.white).setText('POWER');
    this.powerValue = label(3, PAL.white);
    this.swipeLabel = label(3, PAL.white).setOrigin(0.5);
    this.launchLabel = label(2, PAL.white).setText('LAUNCH DIRECTION');

    this.infoButton = new TextButton(
      this,
      0,
      0,
      '',
      () => this.setOverlay('details'),
      {
        width: 72,
        height: 64,
        fill: PAL.blue,
        icon: 'info',
      }
    ).setDepth(HUD + 2);
    this.pauseButton = new TextButton(
      this,
      0,
      0,
      '',
      () => this.setOverlay('pause'),
      {
        width: 72,
        height: 64,
        fill: PAL.darkGray,
        icon: 'pause',
      }
    ).setDepth(HUD + 2);

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
    this.resetGesture();
    const W = this.scale.width;
    const H = this.scale.height;
    this.scoreLabel.setPosition(24, 24);
    this.scoreText.setPosition(24, 44);
    this.streakText.setPosition(24, 100);
    this.kickText.setPosition(W / 2, 132);
    const pad = this.swipeHintLayout();
    this.swipeLabel.setPosition(W / 2, pad.y + pad.height / 2);
    this.hintText.setPosition(W / 2, pad.y - 14);
    this.banner.setPosition(W / 2, H * 0.6);
    this.bannerSub.setPosition(W / 2, H * 0.6 + 56);
    const slider = this.powerLayout();
    this.powerLabel.setPosition(slider.x, slider.top - 39);
    this.powerValue.setPosition(slider.x, slider.bottom + 19);
    this.soundButton.setPosition(W - 60, 56);
    this.infoButton.setPosition(W - 144, 56);
    this.pauseButton.setPosition(W - 228, 56);
    this.lifeIcons.forEach((icon, i) =>
      icon.setPosition(W - 288 - (FK.lives - 1 - i) * 44, 56).setScale(36 / 64)
    );
    if (this.stage) this.frameCamera();
    if (this.phase === 'over' && !this.resultScreen) this.showCard();
    if (this.overlay !== null) this.renderOverlay();
  }

  private setOverlay(which: FreeKickOverlay) {
    if (this.phase === 'loading' || this.phase === 'over' || !this.stage)
      return;
    if (this.introPending && which === null && this.overlay === 'details')
      which = 'help';
    if (
      (which === 'help' || which === 'details') &&
      this.overlay !== 'help' &&
      this.overlay !== 'details'
    )
      this.helpReturn = this.overlay === 'pause' ? 'pause' : null;
    this.overlay = which;
    // Releasing a held control while opening/closing a panel cannot shoot.
    this.resetGesture();
    this.drawControls();
    this.overlayLayer?.destroy(true);
    this.quitButton?.remove();
    this.quitButton = null;
    this.overlayLayer = null;
    if (which !== null) {
      this.tweens.pauseAll();
      this.music?.pause();
      this.renderOverlay();
    } else {
      this.tweens.resumeAll();
      if (!document.hidden) this.music?.resume();
    }
  }

  private renderOverlay() {
    this.overlayLayer?.destroy(true);
    this.quitButton?.remove();
    this.quitButton = null;
    if (this.overlay === null) {
      this.overlayLayer = null;
      return;
    }
    this.overlayLayer = buildFreeKickOverlay(this, {
      mode: this.overlay,
      level: this.setup.level.level,
      metres: Math.round(this.setup.distance / FK.pxPerMetre),
      lives: this.lives,
      practice: this.practice,
      newSpot: () => {
        this.setOverlay(null);
        this.hint = '';
        this.newKick(false);
      },
      backToPause: this.helpReturn === 'pause',
      resume: () => this.setOverlay(null),
      help: () => this.setOverlay('details'),
      next: () => this.setOverlay('help'),
      previous: () => this.setOverlay('details'),
      intro: this.introPending,
      back: () => this.finishInfo(),
    }).setDepth(HUD + 20);
    if (this.overlay === 'pause') this.renderQuit();
  }

  private finishInfo() {
    this.introPending = false;
    this.setOverlay(this.helpReturn);
  }

  private renderQuit() {
    const host = document.getElementById('freekick');
    if (!host) return;
    const quit = document.createElement('a');
    quit.href = 'splash.html';
    quit.className = 'fk-pause-quit';
    pixelLabel(quit, 'QUIT');
    const panelHeight = this.practice ? 660 : 550,
      row = this.practice ? 540 : 430;
    quit.style.top = `${(((this.scale.height - panelHeight) / 2 + row) / this.scale.height) * 100}%`;
    quit.style.width = `${(360 / this.scale.width) * 100}%`;
    quit.addEventListener('click', (event) => {
      this.resetGesture();
      this.music?.stop();
      if (this.phase !== 'over') this.measure('quit');
      if (context?.postId) {
        event.preventDefault();
        exitExpandedMode(event);
      }
    });
    host.append(quit);
    this.quitButton = quit;
  }

  private updateHud() {
    this.scoreText.setText(String(this.practice ? this.goals : this.score));
    const multiplier = Math.min(
      FK.streakMax,
      1 + FK.streakStep * Math.max(0, this.streak - 1)
    );
    this.streakText.setText(
      this.streak >= 2 ? `STREAK ${this.streak}  X${multiplier}` : ''
    );
    this.lifeIcons.forEach((icon, i) =>
      icon.setVisible(!this.practice).setAlpha(i < this.lives ? 1 : 0.2)
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
    if (this.practice || this.resultScreen) return;
    this.banner.setVisible(false);
    this.bannerSub.setVisible(false);
    this.hintText.setText('');
    const stats: FreeKickStats = {
      mode: 'play',
      score: this.score,
      goals: this.goals,
      shots: this.shots,
      bestStreak: this.bestStreak,
      level: levelFor(this.goals).level,
      fastestGoalKmh: this.fastestGoalKmh,
      elapsedSec: Math.floor(this.clock - this.runStartedAt),
    };
    this.resultScreen = freeKickResults(
      stats,
      this.bestBefore,
      this.records,
      () => this.restart()
    );
  }
}
