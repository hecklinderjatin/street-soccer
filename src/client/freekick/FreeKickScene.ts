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
import { Stage, TRAIL_COLOR } from './Stage';
import {
  BAR_Z,
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  STEP,
  aimAtGoalLine,
  levelFor,
  makeKick,
  powerBand,
  readSwipe,
  scoreGoal,
  startPlay,
  stepPlay,
  swipePower,
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
function advice(outcome: Outcome, power: number, band: Band | null) {
  if (outcome === 'wall')
    return band && power < band.lo
      ? 'MORE POWER TO CLEAR THE WALL'
      : 'BEND IT ROUND THE WALL';
  if (outcome === 'over') return 'LESS POWER TO DIP UNDER THE BAR';
  if (outcome === 'short') return 'SWIPE LONGER FOR MORE POWER';
  if (outcome === 'saved') return 'AIM FOR THE CORNERS';
  if (outcome === 'wide') return 'AIM INSIDE THE POSTS';
  if (outcome === 'post') return 'SO CLOSE! A LITTLE INSIDE';
  return '';
}

const FIRST_HINTS = [
  'SWIPE UP TO SHOOT',
  'LONGER SWIPE = MORE POWER',
  'CURVE YOUR SWIPE TO BEND IT',
];

type Band = { lo: number; hi: number };

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

// Free Kick mode: one kick after another from spots around the box. Swipe
// up to shoot: the swipe's direction aims, its length sets the power (the
// meter shows it live, with the band that clears the wall and dips under
// the bar) and bending it curls the ball. Goals raise the level (more men
// in the wall, a sharper keeper, longer and wider spots); a miss costs one
// of three lives and the kick is retaken with the last attempt as a ghost.
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
  private kicks = 0;

  private setup: KickSetup = makeKick(levelFor(0), Math.random);
  private band: Band | null = null;
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

  private swipeId: number | null = null;
  private swipe: ScreenPoint[] = [];
  private swipeFade = 0;

  private scoreText!: Phaser.GameObjects.BitmapText;
  private scoreLabel!: Phaser.GameObjects.BitmapText;
  private streakText!: Phaser.GameObjects.BitmapText;
  private kickText!: Phaser.GameObjects.BitmapText;
  private hintText!: Phaser.GameObjects.BitmapText;
  private banner!: Phaser.GameObjects.BitmapText;
  private bannerSub!: Phaser.GameObjects.BitmapText;
  private powerLabel!: Phaser.GameObjects.BitmapText;
  private meter!: Phaser.GameObjects.Graphics;
  private swipeTrail!: Phaser.GameObjects.Graphics;
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
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => this.music?.pause());
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
    }
    this.retry = retry;
    this.band = powerBand(this.setup);
    this.play = null;
    this.strike = null;
    this.acc = 0;
    this.kicks++;
    this.frameCamera();
    this.stage?.setKick(this.cam, retry);
    this.banner.setVisible(false);
    this.bannerSub.setVisible(false);
    if (!this.hint) this.hint = FIRST_HINTS[this.kicks - 1] ?? '';
    this.hintText.setText(this.hint);
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

  // The swipe's direction from the ball, as it looks on screen, picks the
  // point on the goal line it aims at.
  private shoot(power: number, curl: number, dirX: number, dirY: number) {
    this.measure('kickoff');
    const z = BAR_Z * FK.aimHeight;
    const { spot } = this.setup;
    this.cam.project(GOAL_X, GOAL_Y - POST_HALF, z, at);
    const a = { sx: at.x, sy: at.y, y: GOAL_Y - POST_HALF };
    this.cam.project(GOAL_X, GOAL_Y + POST_HALF, z, at);
    const b = { sx: at.x, sy: at.y, y: GOAL_Y + POST_HALF };
    this.cam.project(spot.x, spot.y, R, at);
    const targetY =
      aimAtGoalLine({ x: at.x, y: at.y }, dirX, dirY, a, b) ?? GOAL_Y;
    this.strike = { power, targetY, curl };
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
      this.hint = advice(outcome, this.strike?.power ?? 0, this.band);
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
    this.score = this.goals = this.streak = this.bestStreak = this.kicks = 0;
    this.lives = FK.lives;
    this.hint = '';
    this.sfx('match-start');
    this.newKick(false);
  }

  // ---- Input --------------------------------------------------------------

  private onDown(
    pointer: Phaser.Input.Pointer,
    over: Phaser.GameObjects.GameObject[]
  ) {
    if (this.phase !== 'aim' || this.swipeId !== null || over.length > 0)
      return;
    this.swipeId = pointer.id;
    this.swipe = [{ x: pointer.x, y: pointer.y }];
    this.swipeFade = 1;
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.swipeId) return;
    const last = this.swipe[this.swipe.length - 1];
    if (last && Math.hypot(pointer.x - last.x, pointer.y - last.y) < 3) return;
    this.swipe.push({ x: pointer.x, y: pointer.y });
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.swipeId) return;
    this.onMove(pointer);
    this.swipeId = null;
    if (this.phase !== 'aim') return;
    const swipe = readSwipe(this.swipe);
    if (!swipe) {
      this.hintText.setText('SWIPE UP TOWARD THE GOAL');
      return;
    }
    this.shoot(swipe.power, swipe.curl, swipe.dirX, swipe.dirY);
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
    this.drawSwipe(dt);
    this.drawMeter();
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

  // The finger's path as a glowing ribbon, thickest at the finger; it
  // fades once released.
  private drawSwipe(dt: number) {
    const g = this.swipeTrail.clear();
    if (this.swipeId === null)
      this.swipeFade = Math.max(0, this.swipeFade - dt / 0.35);
    const pts = this.swipe;
    const fade = this.swipeFade;
    if (pts.length < 2 || fade <= 0) return;
    for (const [grow, color, alpha] of [
      [1, TRAIL_COLOR, 0.3],
      [0.35, PAL.white, 0.95],
    ] as const) {
      g.fillStyle(color, alpha * fade);
      pts.forEach((p, i) => {
        const r = (4 + 22 * (i / (pts.length - 1))) * grow;
        g.fillCircle(p.x, p.y, r);
        const q = pts[i + 1];
        if (!q) return;
        const r2 = (4 + 22 * ((i + 1) / (pts.length - 1))) * grow;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        g.fillTriangle(
          p.x + nx * r,
          p.y + ny * r,
          p.x - nx * r,
          p.y - ny * r,
          q.x + nx * r2,
          q.y + ny * r2
        );
        g.fillTriangle(
          p.x - nx * r,
          p.y - ny * r,
          q.x - nx * r2,
          q.y - ny * r2,
          q.x + nx * r2,
          q.y + ny * r2
        );
      });
    }
  }

  // Power meter: the band that clears the wall and dips under the bar is
  // bracketed in green, too much (over the bar) is red. The fill shows the
  // live power while swiping, green inside the band; an orange tick marks
  // the attempt being retaken.
  private drawMeter() {
    const g = this.meter.clear();
    const show =
      this.phase === 'aim' || this.phase === 'runup' || this.phase === 'flight';
    this.powerLabel.setVisible(show);
    if (!show) return;
    const H = this.scale.height;
    const x = 28;
    const w = 32;
    const top = H * 0.46;
    const bottom = H * 0.76;
    const yOf = (power: number) => bottom - (bottom - top) * power;
    g.fillStyle(PAL.black, 0.7);
    g.fillRect(x - PX, top - PX, w + 2 * PX, bottom - top + 2 * PX);
    g.fillStyle(PAL.ink, 1).fillRect(x, top, w, bottom - top);

    const first = this.swipe[0];
    const last = this.swipe[this.swipe.length - 1];
    const power =
      this.swipeId !== null && first && last
        ? swipePower(Math.hypot(last.x - first.x, last.y - first.y))
        : (this.strike?.power ?? null);
    const band = this.band;
    if (power !== null) {
      const y = yOf(power);
      g.fillStyle(
        !band || power < band.lo
          ? PAL.lightGray
          : power <= band.hi
            ? PAL.green
            : PAL.red,
        1
      );
      g.fillRect(x, y, w, bottom - y);
      g.fillStyle(PAL.white, 1).fillRect(x - PX, y - PX, w + 2 * PX, PX);
    }
    if (band) {
      const hi = yOf(band.hi);
      const lo = yOf(band.lo);
      g.fillStyle(PAL.red, 0.35).fillRect(x, top, w, hi - top);
      g.fillStyle(PAL.green, 0.3).fillRect(x, hi, w, lo - hi);
      g.fillStyle(PAL.green, 1);
      g.fillRect(x - 3 * PX, hi, 2 * PX, lo - hi);
      g.fillRect(x + w + PX, hi, 2 * PX, lo - hi);
    }
    if (this.lastPower !== null) {
      g.fillStyle(PAL.orange, 1);
      g.fillRect(x + w + PX, yOf(this.lastPower) - PX, 4 * PX, 2 * PX);
    }
  }

  // ---- HUD ----------------------------------------------------------------

  private buildHud() {
    const text = (size: number, color: number = PAL.white) =>
      pixelText(this, 0, 0, '', size, color).setDepth(HUD);
    this.scoreLabel = text(2, PAL.lightGray).setText('SCORE');
    this.scoreText = text(6);
    this.streakText = text(3, PAL.yellow);
    this.kickText = text(3).setOrigin(0.5, 0);
    this.hintText = text(3).setOrigin(0.5, 1);
    this.banner = text(10).setOrigin(0.5).setVisible(false);
    this.bannerSub = text(3, PAL.white)
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setVisible(false);
    this.powerLabel = text(2, PAL.lightGray).setText('POWER');
    this.meter = this.add.graphics().setDepth(HUD);
    this.swipeTrail = this.add.graphics().setDepth(HUD + 1);

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
    this.hintText.setPosition(W / 2, H - 40);
    this.banner.setPosition(W / 2, H * 0.6);
    this.bannerSub.setPosition(W / 2, H * 0.6 + 56);
    this.powerLabel.setPosition(24, H * 0.46 - 28);
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
