import { createMatchJourney } from '../matchJourney';
import { journeyAppReady, sendJourney } from '../journeys';
import {
  freeKickJourneySettings,
  freeKickJourneyResult,
} from '../../shared/freeKickJourneys';
import { context, exitExpandedMode } from '@devvit/web/client';
import { launchSpeedKmh } from '../../shared/goalSpeed';
import type { FreeKickStats } from '../../shared/freeKick';
import { FreeKickRecords } from './records';
import { freeKickResults } from './results';
import { pixelLabel } from '../ui/pixelLabel';
import { practiceLevel } from './mode';
import {
  buildFreeKickOverlay,
  pauseLayout,
  type FreeKickOverlay,
} from './overlay';
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
import { freeKickChallenge, startingConfig } from '../challenge';
import {
  challengeOutcome,
  freeKickRoundLevel,
  freeKickSkill,
  challengeRandom,
  type FreeKickChallengeConfig,
} from '../../shared/freeKickChallenge';
import { releaseEarlyDownloads, withEarlyDownloads } from '../earlyAssets';
import { playAttempt, playReady } from '../playMetrics';
import { newProjected } from '../render/Projector';
import { PAL, PX } from '../ui/palette';
import { createPixelFont, pixelText } from '../ui/pixelFont';
import { setSoundMuted, soundMuted } from '../ui/soundSetting';
import { StreamMusic } from '../ui/streamMusic';
import { TextButton } from '../ui/TextButton';
import { KickCamera } from './KickCamera';
import { kickerFrame, runupShares } from './kickerFrames';
import { ResultFx } from './resultFx';
import { drawRibbon, smoothLine } from './ribbon';
import { Stage } from './Stage';
import {
  BAR_Z,
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  STEP,
  SpotXg,
  aimAtGoalLine,
  ballContact,
  challengeKick,
  practiceKick,
  curvedStrike,
  goalPoints,
  greatSavePoints,
  levelFor,
  makeKick,
  powerBand,
  readSwipe,
  retryXg,
  scoreGoal,
  shotXgot,
  startPlay,
  stepPlay,
  streakMultiplier,
  swipeBow,
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
const SIDE_KEY = 'street-soccer-freekick-side';
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

// Which side the kicker stands on: 1 right (controls on the left), -1 left.
function readSide(): 1 | -1 {
  try {
    return localStorage.getItem(SIDE_KEY) === 'left' ? -1 : 1;
  } catch {
    return 1; // storage can be unavailable inside an embedded browser
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const at = newProjected();

// Free Kick mode: set contact and power, then swipe at the goal to aim and shoot.
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

  private journey: ReturnType<typeof createMatchJourney> | null = null;
  private journeyStartedAt: number | null = null;
  private practice = false;
  // A challenge run: this post's settings (goals to win with its lives,
  // its distance, wall and difficulty); null in Practice.
  private challenge: FreeKickChallengeConfig | null = null;
  private maxLives: number = FK.lives;
  private side: 1 | -1 = readSide();
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
  // Expected goals: this spot's xG (worked out while aiming), how often it
  // has been retaken, the xG of the shot in flight, the run's xG so far and
  // the great saves (on-target shots saved that cost no life).
  private xgEstimate: SpotXg | null = null;
  private retries = 0;
  private shotXg = 0;
  private xgTotal = 0;
  private greatSaves = 0;
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
  private timeScale = 1; // play speed, eased (slow motion)
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
  private xgText!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private resultFx!: ResultFx;
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
  private sideButton!: TextButton;
  private overlay: FreeKickOverlay = null;
  private overlayLayer: Phaser.GameObjects.Container | null = null;
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private card: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('FreeKick');
  }

  create() {
    this.practice = this.registry.get('freekickPractice') === true;
    this.practiceLevel = practiceLevel(
      this.registry.get('freekickPracticeLevel')
    );
    this.challenge = this.practice ? null : freeKickChallenge();
    this.records = new FreeKickRecords();
    this.maxLives = this.challenge?.lives ?? FK.lives;
    this.lives = this.maxLives;
    if (!this.ranked) this.measure = () => {};
    this.overlay = null;
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
      // As the match: Escape closes any panel, else pauses.
      this.setOverlay(this.overlay ? null : 'pause');
    });
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      this.advanceInfo();
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
    this.lifeIcons = Array.from({ length: this.maxLives }, () =>
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
    this.prepareJourney(false);
    journeyAppReady();
    this.layout();
    this.drawWorld();
    this.introPending = true;
    this.setOverlay('details');
    if (this.ranked) playReady('freekick');
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
      // Fixed post sequence: goals advance; misses keep the same setup.
      this.setup = this.challenge
        ? challengeKick(this.challenge, this.goals, context?.postId ?? 'local')
        : practiceKick(freeKickChallenge(), this.practiceLevel, Math.random);
      this.lastPower = null;
      this.contact = ballContact(0, 0);
      this.power = FK.defaultPower;
      this.xgEstimate = new SpotXg(this.setup);
      this.retries = 0;
    } else this.retries++;
    this.retry = retry;
    this.band = powerBand(this.setup, this.footContact());
    this.play = null;
    this.strike = null;
    this.acc = 0;
    this.frameCamera();
    this.stage?.setKick(this.cam);
    this.resultFx.hide();
    // What the player can read before the kick: a man lying behind the
    // wall, a keeper cheating toward it.
    const read = this.setup.wall.lyer
      ? 'A MAN LIES BEHIND THE WALL'
      : this.setup.keeperStyle === 'cheat'
        ? 'KEEPER CHEATS TO THE WALL SIDE'
        : '';
    this.hintText.setText(
      this.hint ||
        read ||
        (this.challenge
          ? this.challengeLine()
          : 'SET POWER + SHOT TYPE, THEN SWIPE TO SHOOT')
    );
    this.hint = '';
    const metres = Math.round(this.setup.distance / FK.pxPerMetre);
    this.kickText.setText(
      `${this.practice ? `PRACTICE LEVEL ${this.setup.level.level}` : this.challenge?.mode === 'infinity' ? `${freeKickSkill(this.setup.level.level)}  LEVEL ${this.setup.level.level}` : this.challenge ? `ROUND ${this.goals + 1}  LEVEL ${this.setup.level.level}` : this.retry ? 'RETRY' : `LEVEL ${this.setup.level.level}`}  ${metres} M`
    );
    this.updateHud();
    this.updateXgText();
    this.setPhase('aim');
  }

  // This attempt's xG (finishing the estimate if it isn't done yet).
  private currentXg() {
    const base = this.xgEstimate?.value() ?? FK.xgMax;
    return retryXg(base, this.retries);
  }

  // Under the level line: the spot's xG and what a goal from it is worth
  // with the current streak, from the weakest to the best finish.
  private updateXgText() {
    if (!this.xgEstimate?.ready) {
      this.xgText.setText('XG ...');
      return;
    }
    const xg = this.currentXg();
    const next = this.streak + 1;
    this.xgText.setText(
      `XG ${xg.toFixed(2)}  GOAL ${goalPoints(xg, 0, next)}-${goalPoints(xg, 1, next)}`
    );
  }

  private frameCamera() {
    this.cam.frame(this.setup.spot, this.scale.width, this.scale.height);
    this.cam.project(GOAL_X, GOAL_Y, BAR_Z / 2, at);
    // The flight's push-in is about a point beyond the goal, which brings
    // the goal toward the middle of the view as it grows.
    const pull = FK.flightCentre / (FK.flightZoom - 1);
    this.zoomAnchor = {
      x: at.x - (this.scale.width / 2 - at.x) * pull,
      y: at.y,
    };
  }

  // Only Challenge submits records; Practice never does.
  private get ranked() {
    return !this.practice;
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
    const a = { sx: at.x, sy: at.y, y: GOAL_Y - POST_HALF, d: at.depth };
    this.cam.project(GOAL_X, GOAL_Y + POST_HALF, z, at);
    const b = { sx: at.x, sy: at.y, y: GOAL_Y + POST_HALF, d: at.depth };
    this.cam.project(spot.x, spot.y, R, at);
    return aimAtGoalLine(at, swipe.dirX, swipe.dirY, a, b) ?? GOAL_Y;
  }

  private shoot(strike: Strike) {
    this.beginJourney();
    if (this.shots === 0) {
      this.runStartedAt = this.clock;
      if (!this.practice) this.records.start();
    }
    this.shots++;
    this.shotXg = this.currentXg();
    this.xgTotal += this.shotXg;
    this.measure('kickoff');
    this.strike = strike;
    this.hintText.setText('');
    this.setPhase('runup');
  }

  private strikeBall() {
    if (!this.strike) return;
    this.measure('first_shot');
    this.play = startPlay(
      this.setup,
      this.strike,
      this.challenge
        ? challengeRandom(context?.postId ?? 'local', `defence:${this.goals}`)
        : Math.random
    );
    const b = this.play.ball;
    this.shotKmh = launchSpeedKmh(b.vx, b.vy, b.vz);
    this.prevBall = { x: b.x, y: b.y, z: b.z };
    this.sfx('ball-strike');
    this.timeScale = 1;
    this.setPhase('flight');
  }

  // The play speed wanted now: slower for the last moment before the goal
  // line (the save or the finish) and after a goal.
  private playSpeed(play: KickPlay) {
    if (this.reducedMotion.matches) return 1;
    if (play.outcome === 'goal')
      return this.clock < this.slowUntil ? FK.slowMoScale : 1;
    const b = play.ball;
    const close =
      play.outcome === null &&
      b.vx > 1 &&
      b.x < GOAL_X &&
      (GOAL_X - b.x) / b.vx < FK.approachSec;
    return close ? FK.approachScale : 1;
  }

  // Fixed steps at the eased play speed; the ball is drawn between the
  // last two.
  private fly(dt: number) {
    const play = this.play;
    if (!play || !this.stage) return;
    this.timeScale +=
      (this.playSpeed(play) - this.timeScale) *
      (1 - Math.exp(-FK.timeEaseRate * dt));
    this.acc += dt * this.timeScale;
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
    const xgot = shotXgot(play);
    const xgotLine = `XGOT ${xgot.toFixed(2)}`;
    if (outcome === 'goal') {
      this.fastestGoalKmh = Math.max(this.fastestGoalKmh, this.shotKmh);
      this.measure('first_goal');
      this.goals++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const { points, tags } = scoreGoal(play, this.streak, this.shotXg, xgot);
      this.score += points;
      const up = this.challenge
        ? challengeOutcome(this.goals, this.lives, this.challenge) === 'open' &&
          freeKickRoundLevel(this.challenge, this.goals) >
            this.setup.level.level
        : false;
      // One line per style tag: all five side by side overflow the view.
      this.showBanner(
        'GOAL!',
        PAL.yellow,
        [
          this.practice ? xgotLine : `+${points}  ${xgotLine}`,
          ...(this.challenge ? [this.challengeLine()] : []),
          ...tags,
        ].join('\n'),
        true
      );
      if (up) this.hint = `ROUND ${this.goals + 1}: NEW ANGLE, TOUGHER DEFENCE`;
      this.sfx('goal-celebration');
      this.slowUntil = this.clock + FK.slowMoSec;
      if (!this.reducedMotion.matches) this.cameras.main.shake(220, 0.006);
    } else {
      // A shot good enough to beat most keepers, saved: no life lost.
      const great =
        !this.challenge && outcome === 'saved' && xgot >= FK.greatSaveXgot;
      if (great && !this.practice) {
        this.greatSaves++;
        this.score += greatSavePoints(xgot);
      } else if (!this.practice) this.lives--;
      this.streak = 0;
      this.lastPower = this.strike?.power ?? null;
      const livesLine = this.practice
        ? 'UNLIMITED PRACTICE'
        : this.challenge
          ? this.challengeLine()
          : great
            ? `+${greatSavePoints(xgot)}  NO LIFE LOST`
            : this.lives > 0
              ? `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`
              : '';
      this.showBanner(
        great ? 'GREAT SAVE!' : BANNER[outcome],
        outcome === 'saved' ? PAL.blue : PAL.orange,
        [outcome === 'saved' ? xgotLine : '', livesLine]
          .filter((line) => line !== '')
          .join('\n'),
        false
      );
      if (!this.reducedMotion.matches) this.cameras.main.shake(140, 0.003);
      this.hint = great ? 'UNLUCKY! SAME SPOT, HIGHER XG' : advice(play);
      this.sfx('goal-miss');
    }
    this.updateHud();
  }

  private endKick() {
    this.setPhase('next');
    if (
      this.challenge
        ? challengeOutcome(this.goals, this.lives, this.challenge) !== 'open'
        : !this.practice && this.lives <= 0
    ) {
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
    this.finishJourney(false);
    this.setPhase('over');
    this.sfx('match-over');
    this.music?.stop();
    this.showCard();
  }

  private prepareJourney(rematch: boolean) {
    this.journeyStartedAt = null;
    this.journey = createMatchJourney(
      freeKickJourneySettings(
        freeKickChallenge(),
        this.practice,
        this.setup.level.level,
        rematch
      ),
      sendJourney
    );
  }
  private beginJourney() {
    if (!this.journey || this.journeyStartedAt !== null) return;
    this.journeyStartedAt = this.clock;
    this.journey.start();
  }
  private finishJourney(quit: boolean) {
    if (!this.journey || this.journeyStartedAt === null) return;
    this.journey.end(
      freeKickJourneyResult(
        this.practice,
        !!this.challenge &&
          challengeOutcome(this.goals, this.lives, this.challenge) === 'won',
        this.goals,
        this.shots,
        this.score,
        this.clock - this.journeyStartedAt,
        quit,
        this.challenge?.mode === 'infinity'
      )
    );
  }

  private restart() {
    this.finishJourney(true);
    this.resultScreen?.destroy();
    this.resultScreen = null;
    this.records = new FreeKickRecords();
    this.shots = this.shotKmh = this.fastestGoalKmh = 0;
    this.runStartedAt = 0;
    this.measure('rematch_tap');
    this.measure = this.ranked ? playAttempt('freekick') : () => {};
    for (const node of this.card) node.destroy();
    this.card = [];
    this.score = this.goals = this.streak = this.bestStreak = 0;
    this.xgTotal = this.greatSaves = this.shotXg = 0;
    this.lives = this.maxLives;
    this.hint = '';
    this.sfx('match-start');
    this.newKick(false);
    this.prepareJourney(true);
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

  // The strike the ball dot makes: the side of the ball you pick is the way
  // the ball curls, from either side of it (the kicker then uses the leg
  // that reaches that half; there is no sprite for it, so it is the same
  // run and strike). The rules' contact point is the opposite: striking the
  // right of the ball bends it left.
  private footContact() {
    return ballContact(-this.contact.x, this.contact.y);
  }

  private controlsLayout() {
    return freeKickControls(this.scale.width, this.scale.height);
  }

  // SIDE: only the kicker swaps sides of the ball (kept on the device); the
  // camera and controls stay put.
  private switchSide() {
    if (this.phase !== 'aim' || this.overlay !== null) return;
    this.side = this.side > 0 ? -1 : 1;
    try {
      localStorage.setItem(SIDE_KEY, this.side > 0 ? 'right' : 'left');
    } catch {
      // the choice only lasts this session
    }
  }

  private contactLayout() {
    return this.controlsLayout().contact;
  }

  private powerLayout() {
    return this.controlsLayout().power;
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
    const mode = freeKickGesture(pointer, this.controlsLayout());
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
      this.band = powerBand(this.setup, this.footContact());
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
      this.shoot(
        curvedStrike(
          this.setup.spot,
          {
            power: this.power,
            contact: this.footContact(),
            targetY: this.aimTarget(swipe),
          },
          swipeBow(this.swipe)
        )
      );
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
    if (this.phase === 'aim' && this.xgEstimate && !this.xgEstimate.ready) {
      this.xgEstimate.step(FK.xgStepSamples);
      if (this.xgEstimate.ready) this.updateXgText();
    }
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
        ? 1 +
          (FK.flightZoom - 1) * smooth(Math.min(1, play.t / FK.flightZoomSec))
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
    this.resultFx.update(
      this.clock - this.outcomeAt,
      FK.resultSec,
      this.scale.width,
      this.scale.height,
      this.reducedMotion.matches
    );
  }

  // Waiting behind and left of the ball, the run-up, the follow-through,
  // and a celebration after a goal. The strike sheet faces screen-left, so
  // he is drawn mirrored on the ball's left; a left-curl strike (the
  // rules' contact right of centre) flips the sprite again from the moment
  // of the shot.
  private kickerPose() {
    const flip = this.side < 0;
    const curlLeft = (this.strike?.contact.x ?? 0) > 0;
    const strike = (run: number | null, play: number | null) => {
      const k = kickerFrame(run, play, curlLeft);
      return { frame: k.frame, flip: flip !== k.mirror };
    };
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
    const startSide = this.side * FK.kickerStartSide;
    const contactSide = this.side * FK.kickerContactSide;
    const start = place(FK.kickerStartBack, startSide);
    if (this.phase === 'runup') {
      const t = Math.min(1, (this.clock - this.phaseAt) / FK.runupSec);
      const run = runupShares(t);
      return {
        ...place(
          FK.kickerStartBack +
            (FK.kickerContactBack - FK.kickerStartBack) * run.back,
          startSide + (contactSide - startSide) * run.side
        ),
        ...strike(t, null),
      };
    }
    const play = this.play;
    if (!play) return { ...start, ...strike(null, null) };
    // On after the strike toward the goal (the way the curve ends), easing
    // to a stop.
    const follow = FK.kickerFollow * (1 - Math.exp(-Math.min(play.t, 0.4) * 9));
    const pose = place(FK.kickerContactBack - follow, contactSide);
    const since = this.clock - this.outcomeAt;
    if (play.outcome === 'goal' && since > 0.3)
      return {
        ...pose,
        frame: `celebrate_a${1 + (Math.floor(since * 6) % 6)}`,
        flip,
      };
    return { ...pose, ...strike(null, play.t) };
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
      // A shaft that widens toward the head.
      drawRibbon(
        [
          {
            x: ball.x + start * dx,
            y: ball.y + start * dy,
            w: width * 0.2,
            a: 1,
          },
          { x, y, w: width * 0.6, a: 1 },
        ],
        [[1, ink, 1]],
        () => g
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
            ? 'KEEP SWIPING'
            : 'SWIPE AT THE GOAL'
      );
  }

  private drawSwipeTrail() {
    const g = this.swipeTrail.clear();
    const dragging = this.gesture?.mode === 'swipe';
    const alpha = dragging
      ? 1
      : Phaser.Math.Clamp((this.swipeTrailUntil - this.clock) / 0.35, 0, 1);
    if (alpha <= 0 || this.swipe.length < 2) return;
    // A smooth, tapered stroke: thin where the finger started.
    const line = smoothLine(smoothLine(this.swipe));
    const last = line.length - 1;
    drawRibbon(
      line.map((p, i) => ({
        x: p.x,
        y: p.y,
        w: 7 * (0.25 + (0.75 * i) / last),
        a: alpha * (0.2 + (0.8 * i) / last),
      })),
      [
        [2.4, PAL.blue, 0.2],
        [1.2, PAL.blue, 0.55],
        [0.5, PAL.white, 0.95],
      ],
      () => g
    );
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
    const foot = this.footContact();
    const curl = foot.x > 0 ? 'LEFT' : 'RIGHT';
    const curls = Math.abs(foot.x) >= 0.25;
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
      this.practice ? 'PRACTICE GOALS' : this.challenge ? 'POINTS' : 'SCORE'
    );
    this.scoreText = text(6);
    this.streakText = text(3, PAL.yellow);
    this.kickText = text(3).setOrigin(0.5, 0);
    this.xgText = text(2, PAL.yellow).setOrigin(0.5, 0);
    this.hintText = text(2)
      .setOrigin(0.5, 1)
      .setDepth(HUD + 2);
    this.resultFx = new ResultFx(this, HUD + 5);
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

    this.sideButton = new TextButton(
      this,
      0,
      0,
      'CHANGE SIDE',
      () => this.switchSide(),
      { width: 220, height: 52, textSize: 2, fill: PAL.darkGray }
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
    this.scoreLabel.setPosition(24, 24);
    this.scoreText.setPosition(24, 44);
    this.streakText.setPosition(24, 100);
    this.kickText.setPosition(W / 2, 132);
    this.xgText.setPosition(W / 2, 166);
    const pad = this.swipeHintLayout();
    this.swipeLabel.setPosition(W / 2, pad.y + pad.height / 2);
    this.hintText.setPosition(W / 2, pad.y - 14);
    const slider = this.powerLayout();
    this.powerLabel.setPosition(slider.x, slider.top - 39);
    this.powerValue.setPosition(slider.x, slider.bottom + 19);
    // As the match's HUD: pause at the right, i left of it, sound left of i.
    this.pauseButton.setPosition(W - 60, 56);
    this.sideButton.setPosition(W / 2, pad.y - 70);
    this.infoButton.setPosition(W - 144, 56);
    this.soundButton.setPosition(W - 228, 56);
    // Up to five a row, right to left; a challenge's extra lives wrap below.
    this.lifeIcons.forEach((icon, i) => {
      const j = this.maxLives - 1 - i;
      icon
        .setPosition(W - 288 - (j % 5) * 44, 56 + Math.floor(j / 5) * 44)
        .setScale(36 / 64);
    });
    if (this.stage) this.frameCamera();
    if (this.phase === 'over' && !this.resultScreen) this.showCard();
    if (this.overlay !== null) this.renderOverlay();
  }

  // The match's flow (HudScene.setOverlay): closing the first-entry
  // briefing from page 1 shows how to play first, unless `skipIntro`
  // (page 1's START GAME); any other close resumes play.
  private setOverlay(which: FreeKickOverlay, skipIntro = false) {
    if (this.phase === 'loading' || this.phase === 'over' || !this.stage)
      return;
    if (
      which === null &&
      this.introPending &&
      this.overlay !== 'help' &&
      !skipIntro
    )
      which = 'help';
    else if (which === null) {
      if (this.introPending) this.beginJourney();
      this.introPending = false;
    }
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
      ...(this.challenge ? { challenge: this.challenge } : {}),
      newSpot: () => {
        this.setOverlay(null);
        this.hint = '';
        this.newKick(false);
      },
      intro: this.introPending,
      restart: () => this.restart(),
      resume: () => this.setOverlay(null),
      start: () => this.setOverlay(null, true),
      next: () => this.setOverlay('help'),
      previous: () => this.setOverlay('details'),
      close: () => this.setOverlay(null),
    }).setDepth(HUD + 20);
    if (this.overlay === 'pause') this.renderQuit();
  }

  // i (or Tab): page 1 -> page 2 -> play, as the match's advanceInfo.
  private advanceInfo() {
    if (this.overlay === 'details') this.setOverlay('help');
    else if (this.overlay === 'help') this.setOverlay(null);
    else this.setOverlay('details');
  }

  private renderQuit() {
    const host = document.getElementById('freekick');
    if (!host) return;
    const quit = document.createElement('a');
    quit.href = 'splash.html';
    quit.className = 'fk-pause-quit';
    pixelLabel(quit, 'QUIT');
    // Under RESUME (and NEW SPOT), the size of the canvas buttons.
    const { quitY } = pauseLayout(this.scale.height, this.practice);
    quit.style.top = `${(quitY / this.scale.height) * 100}%`;
    quit.style.width = `${(360 / this.scale.width) * 100}%`;
    quit.style.height = `${(80 / this.scale.height) * 100}%`;
    quit.addEventListener('click', (event) => {
      this.resetGesture();
      this.music?.stop();
      if (this.phase !== 'over') {
        this.measure('quit');
        this.finishJourney(true);
      }
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
    const multiplier = streakMultiplier(this.streak);
    this.streakText.setText(
      this.challenge
        ? this.challenge.mode === 'infinity'
          ? `INFINITY · ${this.goals} GOALS`
          : `GOALS ${this.goals}/${this.challenge.goals}`
        : this.streak >= 2
          ? `STREAK ${this.streak}  X${multiplier}`
          : ''
    );
    this.lifeIcons.forEach((icon, i) =>
      icon.setVisible(!this.practice).setAlpha(i < this.lives ? 1 : 0.2)
    );
  }

  // Where the challenge stands after this kick.
  private challengeLine() {
    const c = this.challenge;
    if (!c) return '';
    if (c.mode === 'infinity' && this.lives <= 0)
      return 'INFINITY RUN COMPLETE';
    if (c.mode === 'infinity')
      return `${freeKickSkill(this.setup.level.level)} · ${this.goals} GOALS · ${this.lives} LIVES LEFT`;
    const state = challengeOutcome(this.goals, this.lives, c);
    if (state === 'won') return 'CHALLENGE COMPLETE!';
    if (state === 'lost') return 'CHALLENGE FAILED';
    return `GOALS ${this.goals}/${c.goals}  ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`;
  }

  private showBanner(text: string, color: number, sub: string, goal: boolean) {
    this.resultFx.show(goal, text, color, sub);
  }

  // Results: score, goals, best streak and the best score on this device.
  private showCard() {
    if (this.practice || this.resultScreen || !this.challenge) return;
    this.resultFx.hide();
    this.hintText.setText('');
    const stats: FreeKickStats = {
      mode: this.challenge.mode === 'infinity' ? 'infinity' : 'challenge',
      score: this.score,
      goals: this.goals,
      shots: this.shots,
      bestStreak: this.bestStreak,
      level: this.challenge
        ? this.setup.level.level
        : levelFor(this.goals).level,
      fastestGoalKmh: this.fastestGoalKmh,
      elapsedSec: Math.floor(this.clock - this.runStartedAt),
      greatSaves: this.greatSaves,
      xg: Math.round(this.xgTotal * 100),
    };
    this.resultScreen = freeKickResults(
      stats,
      this.records,
      () => this.restart(),
      {
        won: challengeOutcome(this.goals, this.lives, this.challenge) === 'won',
        config: this.challenge,
      }
    );
  }
}
