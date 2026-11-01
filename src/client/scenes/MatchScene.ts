import { ChaosWeather } from '../render/ChaosWeather';
import { chaosRules, chaosLabel, NORMAL_RULES } from '../../shared/chaos';
import { currentPostType } from '../challenge';
import { createMatchJourney } from '../matchJourney';
import { journeyAppReady, sendJourney } from '../journeys';
import { journeySettings, journeyResult } from '../../shared/journeys';
import {
  dailyPlans,
  startScore,
  survivalLimits,
  survivalUpgrade,
} from '../../shared/dailyMode';
import { qualifyingGoal, goalStyle } from '../../shared/goalSpeed';
import { recordGoalSpeed } from '../goalRecords';
import { trackGame } from '../gameCount';
import Phaser from 'phaser';
import {
  AI,
  CHAOS,
  GOAL_FEEDBACK,
  DAILY,
  BALL,
  FORMATION,
  FORMATIONS,
  INPUT,
  KEEPER,
  MATCH,
  PASS,
  PITCH,
  PLAYER,
  SHOOT,
  LEVELS,
  STAMINA,
  STICK,
  TACKLE,
  TACTICS,
  VIEW,
  type FormationSpot,
} from '../../shared/tuning';
import type { MatchConfig, MatchResult, Team } from '../../shared/types';
import {
  AUTHORED_BALL_TEXTURE,
  AUTHORED_SHOT_BALL_TEXTURE,
  createBallTexture,
} from '../art/ballArt';
import {
  CELEBRATION_STYLES,
  LOOKS,
  PLAYER_HEIGHT,
  registerPlayerAtlases,
  type Look,
} from '../art/playerArt';
import {
  PAINT_STEPS,
  PREPARE_STEPS,
  assetsLoaded,
  matchAssets,
  queueAssets,
} from '../art/gameAssets';
import { markTiming, timingSummary } from '../ui/timing';
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
  assistedShotDirection,
  kickShot,
  kickThroughPass,
  idealPassWeight,
  passWeight,
  shotDirection,
} from '../systems/actions';
import { collideBall, stepFreeBall } from '../systems/ballPhysics';
import { CameraRig } from '../systems/CameraRig';
import { Controls, type StickInput } from '../systems/Controls';
import { FixedStep } from '../systems/FixedStep';
import { DEG, angleDiff, clamp } from '../systems/geometry';
import {
  cpuKeeperReact,
  keepInBox,
  startDive,
  startJump,
  keeperStick,
  stepKeeperHands,
  stepKeeperBody,
} from '../systems/keeper';
import { separatePlayers } from '../systems/collisions';
import { TeamBrain, interceptPoint, type TeamView } from '../systems/ai';
import { nextSwitchSelection } from '../systems/playerSwitch';
import {
  resolveTackle,
  startTackle,
  stepLunge,
  tacklePhase,
} from '../systems/tackle';
import { MatchFlow } from '../systems/MatchFlow';
import { constrainMove, stepPlayer } from '../systems/movement';
import { gainBall, releaseBall, stepPossession } from '../systems/possession';
import { JERSEY_SWATCH, PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { StreamMusic } from '../ui/streamMusic';
import { soundMuted } from '../ui/soundSetting';

// Mix (user request): music at 80%, every effect at 25%.
const MUSIC_VOLUME = 0.8;
const EFFECTS_VOLUME = 0.25;

// Sound effects: cache key and file (public-release/audio/<file>.mp3).
const SOUND_FILES: readonly [string, string][] = [
  ['ball-strike', 'shoot'],
  ['goal-celebration', 'goal'],
  ['match-start', 'start'],
  ['match-over', 'stop'],
  ['goal-miss', 'goal-miss'],
];
import type { HudData, MatchHudState } from './HudScene';

const NO_MOVE: StickInput = { x: 0, y: 0, r: 0 };
const STAND_STILL = { move: NO_MOVE, sprint: false };
const DEBUG = new URLSearchParams(window.location.search).has('debug');
const realNow = () => performance.now() / 1000;
const AIM_AT = newProjected();
const SHOT_TEXT_DEPTH = 3e6; // above players, markers and the stamina bar
// Controlled-player ground marker (ring, pointer and charge gauge).
const RING_RADIUS = 44; // the ground marker ring round the controlled player, world px
const RING_POINTS = 40;
const GAUGE_SEGMENTS = 24; // segments of the charge gauge round the ring
const POINTER_GAP = 19; // pointer base sits this far outside the ring (clear of the gauge)
const POINTER_LENGTH = 28; // pointer head length ...
const POINTER_HALF_WIDTH = 17; // ... and half its width, world px
const POINTER_STRETCH = 190; // how far the head slides out at full charge
const POINTER_EASE = 1.6; // > 1: the stretch speeds up as the charge builds
const SHAFT_HALF_START = 3; // shaft half-width at the ring ...
const SHAFT_HALF_END = 7; // ... and at the head

// A match on the street court, seen through the broadcast camera.
// The simulation runs at a fixed 60 Hz (FixedStep) on the flat ground plane;
// rendering interpolates and projects every frame. Per step, in the plan's
// order: input -> (AI) -> move players -> move ball -> possession ->
// actions (pass, shoot, switch) -> match flow. Per frame: camera, then draw.
//
// Phase 3: 5v5, each side 4 outfield (2-1-1) plus a keeper;
// the away team mirrors the home formation. Outfielders the human isn't
// controlling are driven by the shared outfield AI (systems/ai.ts, one
// TeamBrain per side): positioning, pressing and tackles, and AI carriers
// that pass, shoot, dribble or clear (stepAiCarriers). Tackles for
// everyone are in systems/tackle.ts (the human's B1 without the ball).
export class MatchScene extends Phaser.Scene {
  private music: StreamMusic | null = null;
  private demo = false;
  private startSoundPlayed = false;
  private overSoundPlayed = false;
  private config!: MatchConfig;
  // Outfield spots of each side's formation (the away side mirrors its own).
  private homeShape: readonly FormationSpot[] = FORMATIONS['2-1-1'];
  private awayShape: readonly FormationSpot[] = FORMATIONS['2-1-1'];
  private readonly fixed = new FixedStep();
  private readonly projector = new Projector();
  private controls!: Controls;
  private court!: Court;
  private ball!: Ball;
  private home: Player[] = []; // outfield players
  private away: Player[] = []; // CPU outfield players
  private outfield: Player[] = []; // home then away outfielders (one list, no per-step copies)
  private homeBrain!: TeamBrain; // AI for our players the human isn't controlling
  private awayBrain!: TeamBrain;
  private roleText: Phaser.GameObjects.BitmapText[] = []; // ?debug: AI role over each outfielder
  private homeKeeper!: Player;
  private awayKeeper!: Player;
  private everyone: Player[] = [];
  private controlled!: Player;
  private flow!: MatchFlow;
  private rig!: CameraRig;
  private hudState!: MatchHudState;
  private marker!: Phaser.GameObjects.Graphics; // ring + pointer + charge gauge under the controlled player
  private switchMarker!: Phaser.GameObjects.Graphics; // subtle ring under the next SWITCH target
  private shotText!: Phaser.GameObjects.BitmapText; // the swipe shape, above the shooter

  private simTime = 0;
  private feedbackTime = 0; // active real seconds: UI feedback pauses with the scene
  private rampageUpgradeSince: number | null = null;
  private stats = { shots: 0, passes: 0, tacklesWon: 0 };
  private followShotUntil = -Infinity; // sim time: until then control follows the player closest to the loose ball (after a shot)
  private liveSince = Infinity; // sim time play last became live (AI tackle grace)
  private pendingPass: {
    passer: Player;
    receiver: Player;
    at: number;
    weight: number | null; // weighted pass charge 0..1, null = normal pass
  } | null = null;
  private passChargeSince: number | null = null; // real time a held PASS started charging
  // Receive assist (PASS.receiveAssist): our receiver of the pass in flight
  // comes to meet the ball until the human steers it; `stickDir` is how the
  // stick was held when the pass left (null = centred since).
  // Chase assist (INPUT.chaseAssist): `kind` 'chase' is the same takeover
  // rule for a player switched to after losing the ball, running at it.
  private receiveAssist: {
    p: Player;
    stickDir: number | null;
    kind: 'receive' | 'chase';
  } | null = null;
  // Sim time the CPU last tackled the ball off our controlled player (until
  // we win it back): SWITCH then picks the soonest to the ball and he chases.
  private lostBallAt = -Infinity;
  // Receiver hold: when each intended receiver of a normal pass was first
  // seen receiving (PASS.receiveHoldSec).
  private readonly receivingSince = new Map<Player, number>();
  private outRestart: { keeper: Player; at: number } | null = null; // goal kick after the ball went out
  private chargeSince: number | null = null; // real time the shot charge started
  private lastSwitchAt = -Infinity;
  private switchCycle: Player[] = [];
  private switchIndex = 0;
  private journey: ReturnType<typeof createMatchJourney> | null = null;
  private rematch = false;
  private rules = NORMAL_RULES;
  private weather: ChaosWeather | null = null;
  private gameCount: ReturnType<typeof trackGame> | null = null;
  private resultShown = false;
  private botDifficulty: MatchConfig['difficulty'] = 'normal';
  private tacticalKey = '';
  private pendingTactic = '';
  private pendingTacticAt = 0;
  private fastestGoalKmh = 0;
  private newSpeedBest = false;
  private goalDetail = '';
  private goalTag = '';
  private goalSpeedKmh = 0;
  private goalRecord = '';
  // Cost of the simulation per rendered frame (ms), for the debug overlay
  // (tap the FPS readout): a smoothed average and a slowly decaying peak.
  private simMsAvg = 0;
  private simMsPeak = 0;
  private loadingText: Phaser.GameObjects.BitmapText | null = null;
  private ready = false;

  constructor() {
    super('Match');
  }

  // Phaser reuses this scene object on every restart, so reset per-match state here.
  init(data: MatchConfig & { demo?: boolean; rematch?: boolean }) {
    const { demo, rematch, ...config } = data;
    this.demo = demo === true;
    this.config = config;
    this.rules = chaosRules(config);
    this.weather = null;
    this.rematch = rematch === true;
    this.journey = null;
    if (!this.demo) this.registry.set('activeMode', data.mode ?? 'competitive');
    this.homeShape = FORMATIONS[data.home.formation];
    this.awayShape = FORMATIONS[data.away.formation];
    this.ready = false;
    this.loadingText = null;
    this.fixed.reset();
    this.home = [];
    this.away = [];
    this.outfield = [];
    this.liveSince = Infinity;
    this.simMsAvg = 0;
    this.simMsPeak = 0;
    this.everyone = [];
    this.simTime = 0;
    this.feedbackTime = 0;
    this.rampageUpgradeSince = null;
    this.stats = { shots: 0, passes: 0, tacklesWon: 0 };
    this.pendingPass = null;
    this.followShotUntil = -Infinity;
    this.outRestart = null;
    this.chargeSince = null;
    this.passChargeSince = null;
    this.receiveAssist = null;
    this.lostBallAt = -Infinity;
    this.receivingSince.clear();
    this.lastSwitchAt = -Infinity;
    this.switchCycle = [];
    this.switchIndex = 0;
    this.gameCount = null;
    this.resultShown = false;
    this.botDifficulty = data.difficulty;
    this.tacticalKey = this.pendingTactic = '';
    this.pendingTacticAt = 0;
    this.fastestGoalKmh = 0;
    this.newSpeedBest = false;
    this.goalDetail = '';
    this.goalTag = '';
    this.goalSpeedKmh = 0;
    this.goalRecord = '';
    this.startSoundPlayed = false;
    this.overSoundPlayed = false;
  }

  // Sound effects (small MP3s, scripts/optimize_audio.py) load in the
  // background once the match is ready, so the match never waits for sound;
  // each one plays only once it is in (every call checks the cache). The
  // music is streamed separately (StreamMusic).
  private loadSoundsInBackground() {
    let queued = 0;
    for (const [key, file] of SOUND_FILES) {
      if (this.cache.audio.exists(key)) continue;
      this.load.audio(key, `/audio/${file}.mp3`);
      queued++;
    }
    if (!queued) return;
    this.load.once(Phaser.Loader.Events.COMPLETE, () =>
      markTiming('sound effects')
    );
    this.load.start();
  }

  create() {
    if (this.demo) {
      this.cameras.main
        .setViewport(0, 0, VIEW.width, VIEW.height)
        .setZoom(1)
        .centerOn(640, 360);
      this.input.enabled = false;
      this.scene.bringToTop('Menu');
    } else {
      this.cameras.main
        .setViewport(0, 0, VIEW.width, VIEW.height)
        .setZoom(1)
        .setScroll(0, 0);
      this.input.enabled = true;
    }
    // Let the final whistle finish over results; stop it before a new match.
    this.sound.stopByKey('match-over');
    const pauseMusic = () => this.music?.pause();
    const resumeMusic = () => this.music?.resume();
    this.events.on(Phaser.Scenes.Events.PAUSE, pauseMusic);
    this.events.on(Phaser.Scenes.Events.RESUME, resumeMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, pauseMusic);
      this.events.off(Phaser.Scenes.Events.RESUME, resumeMusic);
      this.music?.destroy();
      this.music = null;
      this.sound.stopByKey('goal-celebration');
      this.sound.stopByKey('ball-strike');
      this.sound.stopByKey('match-start');
      this.sound.stopByKey('goal-miss');
    });
    // Court first: painted and shown from the first frame (no downloads
    // needed); the players join when their art is in.
    for (const [, paint] of PAINT_STEPS) paint(this);
    this.court = new Court(this, this.rules.pitch);
    this.weather = new ChaosWeather(this, this.rules);
    this.rig = new CameraRig(this.projector);
    this.rig.snapTo(PITCH.width / 2, PITCH.height / 2);
    // The court fades in from the navy the page opens with (index.html,
    // Phaser's background), so leaving the feed preview for the game has no
    // hard cut. The feed preview shows just the court meanwhile; a real match
    // says why it is waiting, small, at the bottom.
    if (!this.demo) {
      this.cameras.main.fadeIn(450, 0x1d, 0x2b, 0x53);
      this.loadingText = pixelText(
        this,
        VIEW.width / 2,
        VIEW.height - 40,
        'LOADING PLAYERS',
        0.75 * PX,
        PAL.white
      )
        .setOrigin(0.5)
        .setAlpha(0.8)
        .setDepth(1e9);
    }
  }

  // Until the art is in (Boot downloads it while the menu is up), show
  // progress; if Boot has finished without some of it (a failed download),
  // fetch the rest here.
  private waitForPlayers() {
    const assets = matchAssets(this.config);
    const loaded = assetsLoaded(this, assets);
    if (loaded === assets.length) return true;
    this.loadingText?.setText(`LOADING PLAYERS ${loaded}/${assets.length}`);
    if (
      !this.scene.isActive('Boot') &&
      !this.load.isLoading() &&
      queueAssets(this, assets)
    )
      this.load.start();
    return false;
  }

  // Boot has usually prepared all this while the menu was up (each call does
  // nothing then); after an early PLAY the match does it here.
  private finishCreate() {
    if (!this.demo) this.loadSoundsInBackground();
    // A live lobby can start as soon as downloads finish, before Boot's
    // frame-by-frame preparation; each preparation step is idempotent.
    for (const [, prepare] of [...PAINT_STEPS, ...PREPARE_STEPS]) prepare(this);
    createBallTexture(this);
    registerPlayerAtlases(this);
    // The ball atlas persists across matches; drop its two source sheets.
    for (const key of [AUTHORED_BALL_TEXTURE, AUTHORED_SHOT_BALL_TEXTURE])
      if (this.textures.exists(key)) this.textures.remove(key);

    // Different skin / hair per player: home takes looks 0-4, away starts
    // three along, so nobody in a team shares a look.
    const look = (i: number): Look =>
      LOOKS[i % LOOKS.length] ?? { skin: 0xffffff, hair: 0xffffff };
    const keeperLook = this.homeShape.length;
    const { home, away } = this.config;
    this.home = this.homeShape.map(
      (s, i) =>
        new Player(this, 'home', 'outfield', s.x, s.y, look(i), home.jersey)
    );
    const k = FORMATION.keeper;
    this.homeKeeper = new Player(
      this,
      'home',
      'keeper',
      k.x,
      k.y,
      look(keeperLook)
    );
    this.awayKeeper = new Player(
      this,
      'away',
      'keeper',
      PITCH.width - k.x,
      k.y,
      look(keeperLook + 3)
    );
    this.away = this.awayShape.map(
      (s, i) =>
        new Player(
          this,
          'away',
          'outfield',
          PITCH.width - s.x,
          s.y,
          look(i + 3),
          away.jersey
        )
    );
    this.outfield = [...this.home, ...this.away];
    this.everyone = [...this.outfield, this.homeKeeper, this.awayKeeper];
    for (const player of this.everyone) player.rules = this.rules;
    this.ball = new Ball(this);
    this.ball.rules = this.rules;
    this.marker = this.add.graphics();
    this.switchMarker = this.add.graphics();
    this.shotText = pixelText(this, 0, 0, '', 0.6 * PX, PAL.white)
      .setOrigin(0.5, 1)
      .setDepth(SHOT_TEXT_DEPTH)
      .setVisible(false);
    this.controlled = this.forward;

    // Our AI teammates play at normal with the attacking plan (user
    // request); the CPU at the chosen difficulty with the balanced plan.
    this.homeBrain = new TeamBrain(
      'home',
      LEVELS.normal,
      TACTICS.attacking,
      this.homeShape
    );
    this.awayBrain = new TeamBrain(
      'away',
      LEVELS[this.botDifficulty],
      TACTICS.balanced,
      this.awayShape
    );
    this.roleText = DEBUG
      ? this.outfield.map((p) =>
          pixelText(
            this,
            0,
            0,
            '',
            0.5 * PX,
            p.team === 'home' ? PAL.white : PAL.yellow
          )
            .setOrigin(0.5, 1)
            .setDepth(SHOT_TEXT_DEPTH)
        )
      : [];
    this.flow = new MatchFlow(
      this.config.durationSec,
      startScore(this.config),
      this.config.dailyMode,
      survivalLimits(this.config).goals,
      survivalLimits(this.config).conceded
    );
    this.controls = new Controls();
    if (!this.demo) this.controls.bindKeyboard(this);
    this.resetForKickoff();
    this.rig.snapTo(this.ball.x, this.ball.y);

    this.hudState = {
      home: this.flow.score.home,
      away: this.flow.score.away,
      clock: this.flow.clock,
      goldenGoal: false,
      banner: '',
      goalCelebration: {
        active: false,
        age: 0,
        team: null,
        tag: '',
        kmh: 0,
        personalBest: false,
      },
      mission: '',
      rampage: null,
      goalDetail: '',
      goalRecord: '',
      buttons: { b1: 'TACKLE', b2: 'SWITCH', charge: -1, sweetSpot: true },
      // One dot per player (same order as everyone), moved in updateHud.
      minimap: {
        dots: this.everyone.map((p) => ({
          x: p.x,
          y: p.y,
          color:
            p.role === 'keeper'
              ? p.team === 'home'
                ? PAL.kitGreen
                : PAL.kitGold
              : JERSEY_SWATCH[this.config[p.team].jersey],
          controlled: false,
        })),
        ballX: this.ball.x,
        ballY: this.ball.y,
      },
    };
    if (!this.demo) {
      this.journey = createMatchJourney(
        journeySettings(this.config, currentPostType(), this.rematch),
        sendJourney
      );
      journeyAppReady();
      // Initial entry waits for PLAY MATCH; later starts follow committed
      // menu/settings/rematch clicks and keep their existing quick-start flow.
      if (this.registry.get('helpAtStart') !== true) this.journey.start();
    }
    const hud: HudData = {
      onMatchStart: () => this.journey?.start(),
      onMatchQuit: () =>
        this.journey?.end(
          journeyResult(
            this.config,
            this.flow.score.home,
            this.flow.score.away,
            this.flow.elapsedSec,
            true
          )
        ),
      config: this.config,
      controls: this.controls,
      state: this.hudState,
      teams: { home: this.config.home, away: this.config.away },
      debugInfo: () => this.debugInfo(),
    };
    if (!this.demo) this.scene.launch('Hud', hud);

    // Don't replay the paused time as a burst of steps.
    const onResume = () => this.fixed.reset();
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.scene.stop('Hud');
    });
  }

  override update(time: number, delta: number) {
    if (!this.ready) {
      if (!this.waitForPlayers()) {
        this.court.update(this.projector, time / 1000);
        return;
      }
      this.loadingText?.destroy();
      this.loadingText = null;
      this.finishCreate();
      this.ready = true;
      if (!this.demo) this.gameCount = trackGame(this.config);
      markTiming('match ready');
      return;
    }
    // Opening whistle once per match; if audio is locked, wait for a gesture.
    // Music: streamed through the game's Web Audio (volume and the master
    // mute apply on every phone); a start the browser refuses before the
    // first touch is retried on the next one (StreamMusic).
    if (!this.demo && !this.music && this.flow.phase !== 'fulltime') {
      const sound = this.sound;
      this.music = new StreamMusic(
        '/audio/bgm.mp3',
        MUSIC_VOLUME,
        sound instanceof Phaser.Sound.WebAudioSoundManager
          ? { context: sound.context, destination: sound.destination }
          : undefined
      );
      this.music.play();
    }
    this.music?.setMuted(soundMuted());
    if (this.flow.phase === 'fulltime') this.music?.stop();
    if (
      !this.demo &&
      !this.startSoundPlayed &&
      this.cache.audio.exists('match-start') &&
      !this.sound.locked
    ) {
      this.sound.play('match-start', { volume: EFFECTS_VOLUME });
      this.startSoundPlayed = true;
    }
    const realDt = delta / 1000;
    this.feedbackTime += realDt;
    this.controls.sample();
    if (this.flow.update(realDt)) this.resetForKickoff();
    if (this.flow.finished) {
      if (this.demo) {
        this.flow = new MatchFlow(
          this.config.durationSec,
          startScore(this.config),
          this.config.dailyMode,
          survivalLimits(this.config).goals,
          survivalLimits(this.config).conceded
        );
        this.resetForKickoff();
      } else this.showResult();
      return;
    }

    const timeScale = this.flow.timeScale;
    const simStart = performance.now();
    const strikesBefore = this.ball.strikes;
    const goalsBefore = this.flow.score.home + this.flow.score.away;
    const alpha = this.fixed.advance(delta * timeScale, (dt) => this.step(dt));
    if (
      !this.demo &&
      this.flow.phase === 'fulltime' &&
      !this.overSoundPlayed &&
      this.cache.audio.exists('match-over') &&
      !this.sound.locked
    ) {
      this.sound.stopByKey('goal-celebration');
      this.sound.play('match-over', { volume: EFFECTS_VOLUME });
      this.overSoundPlayed = true;
    }
    if (
      !this.demo &&
      this.ball.strikes !== strikesBefore &&
      this.cache.audio.exists('ball-strike') &&
      !this.sound.locked
    )
      this.sound.play('ball-strike', { volume: EFFECTS_VOLUME });
    if (
      !this.demo &&
      this.flow.score.home + this.flow.score.away > goalsBefore &&
      this.cache.audio.exists('goal-celebration') &&
      !this.sound.locked
    ) {
      this.sound.stopByKey('goal-celebration');
      this.sound.play('goal-celebration', {
        volume: GOAL_FEEDBACK.celebrationVolume,
      });
    }
    const simMs = performance.now() - simStart;
    if (this.demo)
      this.events.emit(
        'demo-score',
        this.flow.score.home,
        this.flow.score.away,
        this.flow.clock,
        this.flow.banner
      );
    this.simMsAvg += (simMs - this.simMsAvg) * 0.05;
    this.simMsPeak = Math.max(simMs, this.simMsPeak * 0.995);

    for (const p of this.everyone) p.interpolate(alpha);
    this.ball.interpolate(alpha);
    if (!this.demo) {
      this.updatePassPreview();
      this.updateShotText();
      this.updateRoleText();
      this.updateGroundMarker();
      this.updateSwitchMarker();
    }

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
      celebrant: this.celebrantFocus(),
    });

    const t = time / 1000;
    this.court.update(
      this.projector,
      t,
      this.rules.effect === 'goals' &&
        this.flow.phase === 'kickoff' &&
        this.flow.phaseTime < 1.2
    );
    this.weather?.update(this.projector, this.everyone, this.simTime);
    for (const p of this.everyone) p.render(this.projector, t, this.simTime);
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

    // Input -> AI -> movement. The controlled player moves by the stick;
    // every other outfielder by its team's AI (only while live). A pass's
    // receiver keeps a guaranteed first touch while the pass is travelling;
    // once a loose ball has died, that flag is dropped.
    this.updateDailyTactics(t);
    const frozen = this.flow.playersFrozen;
    if (!ball.owner && ball.z === 0 && ball.speed < PASS.receiverStopBelow)
      this.clearReceivers();
    const aiOn = this.flow.phase === 'live' && !frozen;
    // Fairness: the team behind on the scoreboard gets its breath back faster.
    const score = this.flow.score;
    const regen = (p: Player) =>
      score[p.team] < score[p.team === 'home' ? 'away' : 'home']
        ? STAMINA.trailingRegen
        : 1;
    if (!aiOn) this.liveSince = Infinity;
    else if (this.liveSince === Infinity) this.liveSince = t;
    const homeView = this.teamView('home');
    const awayView = this.teamView('away');
    if (aiOn) {
      this.homeBrain.think(homeView, t);
      this.awayBrain.think(awayView, t);
      // Tackles the AI decided on (never for the human's player).
      for (const brain of [this.homeBrain, this.awayBrain]) {
        for (const { p, dir } of brain.tackles)
          if (this.demo || p !== this.controlled)
            startTackle(p, dir, t, ball.owner);
        brain.tackles.length = 0;
      }
    }
    for (const p of this.outfield) {
      const human = !this.demo && p === this.controlled && !frozen;
      // A lunge moves the body itself; start-up, recovery, a stumble or
      // being tackled (stagger) stop the player.
      if (stepLunge(p, t, dt)) continue;
      const busy = tacklePhase(p, t) !== 'none' || t < p.staggerUntil;
      const steer = busy
        ? STAND_STILL
        : human
          ? this.humanSteer(p)
          : aiOn
            ? (p.team === 'home' ? this.homeBrain : this.awayBrain).steer(
                p,
                p.team === 'home' ? homeView : awayView
              )
            : STAND_STILL;
      // The direction asked for (a sharp change dodges a tackle: juke).
      if (steer.move.r > STICK.deadZone)
        p.wantDir = Math.atan2(steer.move.y, steer.move.x);
      const held = this.receiverHeld(p, t);
      stepPlayer(
        p,
        steer.move,
        steer.sprint && !held,
        dt,
        ball.owner === p,
        regen(p),
        held ? PASS.receiveHoldSpeed : Infinity
      );
      // An AI player standing still keeps its eyes on the ball.
      if (!human && !busy && steer.move.r <= STICK.deadZone && p.speed < 5)
        p.heading = Math.atan2(ball.y - p.y, ball.x - p.x);
    }
    // Keepers: the human steers ours when controlling it; otherwise each is
    // AI (keeper.ts): positioning, claiming, rushing out (keeperStick) and
    // dives at shots or at a carrier's feet (cpuKeeperReact, with its
    // level's reaction time; ours plays at normal).
    for (const k of [this.homeKeeper, this.awayKeeper]) {
      const home = k.team === 'home';
      const level = home ? LEVELS.normal : LEVELS[this.botDifficulty];
      if ((this.demo || k !== this.controlled) && !frozen)
        cpuKeeperReact(
          k,
          ball,
          t,
          level.keeperReactSec,
          Math.random,
          level.keeperDiveError
        );
      if (stepKeeperBody(k, t, dt)) continue; // diving or down after a dive
      const human = !this.demo && k === this.controlled;
      const steer = frozen
        ? STAND_STILL
        : human
          ? { move: this.controls.move, sprint: this.controls.sprint }
          : keeperStick(
              k,
              ball,
              home ? this.home : this.away,
              home ? this.away : this.home,
              t
            );
      stepPlayer(k, steer.move, steer.sprint, dt, ball.owner === k, regen(k));
      // Standing still, a keeper keeps its eyes on the ball.
      if (steer.move.r <= STICK.deadZone && k.speed < 5)
        k.heading = Math.atan2(ball.y - k.y, ball.x - k.x);
    }

    // Bodies can't overlap; then everyone back inside their limits.
    separatePlayers(this.everyone);
    for (const p of this.outfield)
      [p.x, p.y] = constrainMove(
        p.prevY,
        p.x,
        p.y,
        PLAYER.radius,
        this.rules.pitch
      );
    // Keepers may leave their box (playing with their feet), but not while
    // holding the ball in their hands.
    for (const k of [this.homeKeeper, this.awayKeeper]) {
      if (k.holding) keepInBox(k);
      else
        [k.x, k.y] = constrainMove(
          k.prevY,
          k.x,
          k.y,
          PLAYER.radius,
          this.rules.pitch
        );
    }
    // What the other side's AI will see of everyone a moment later
    // (LEVELS.readSec: it reacts late, so feints work).
    for (const p of this.everyone) p.recordSeen();

    this.controls.sprinting = this.controlled.sprinting;
    this.controls.sprintLocked = this.controlled.sprintLocked;

    // Lunges that reach an opposing carrier's ball (tackle.ts decides).
    if (this.flow.phase === 'live')
      for (const p of this.outfield) {
        const carrier = ball.owner;
        const result = resolveTackle(p, ball, t, Math.random);
        // The CPU took the ball off the player we control: the next SWITCH
        // goes to whoever can get to it soonest (switchPlayer).
        if (
          result === 'won' &&
          p.team === 'away' &&
          carrier !== null &&
          carrier === this.controlled
        )
          this.lostBallAt = t;
        if (result === 'won' && p === this.controlled)
          this.stats.tacklesWon += 1;
        if (result === 'won') {
          this.flow.onTouch();
          this.clearReceivers();
        }
      }

    // Ball, then who has it (only while live: not during the kickoff freeze).
    if (!ball.owner) stepFreeBall(ball, dt);
    if (this.outRestart && t >= this.outRestart.at)
      this.restartWithKeeper(this.outRestart.keeper);
    if (this.flow.phase === 'live' && ball.out === 0) {
      // Keepers are included: inside their box possession skips them (hands,
      // see stepKeeperHands); outside it they play with their feet.
      const events = stepPossession(ball, this.everyone, t, dt);
      if (events.gained) this.onGained(events.gained);
      if (events.deflected) {
        this.flow.onTouch();
        this.clearReceivers(); // a deflected pass is anyone's
      }
      for (const keeper of [this.homeKeeper, this.awayKeeper]) {
        const home = keeper.team === 'home';
        const human = !this.demo && keeper === this.controlled;
        const event = stepKeeperHands(
          keeper,
          ball,
          home ? this.home : this.away,
          home ? this.away : this.home,
          t,
          dt,
          Math.random,
          human
        );
        if (!event) continue;
        if (event === 'caught' || event === 'parried' || event === 'smothered')
          this.playMissSound();
        this.flow.onTouch();
        // A throw marks its receiver (kickPass); anything else frees the ball.
        if (event !== 'thrown') this.clearReceivers();
        // Our keeper takes the ball (catch or smother): the human takes over.
        if ((event === 'caught' || event === 'smothered') && home)
          this.setControlled(keeper);
        // Held too long and auto-distributed: control goes to the throw's
        // receiver (who comes to meet it), or to the outfielder nearest
        // where a punt is heading.
        if ((event === 'thrown' || event === 'punted') && human) {
          const receiver = this.home.find((p) => p.receiving);
          this.setControlled(
            receiver ??
              this.nearestOutfielder(ball.x + ball.vx, ball.y + ball.vy)
          );
          if (receiver) this.startReceiveAssist(receiver);
        }
        if (event === 'thrown') this.passReaction(keeper.team, t);
      }
    }

    const contact = collideBall(ball);
    if (contact.goal !== 0) {
      ball.pendingShot = false;
      if (ball.owner) releaseBall(ball, ball.owner, t);
      this.pendingPass = null;
      this.chargeSince = null;
      this.passChargeSince = null;
      this.clearReceivers();
      // Ball in the right net = home scores (home attacks right).
      const scoring = contact.goal > 0 ? 'home' : 'away';
      // One of the celebrations at random, chosen once per goal.
      const scorer = this.scorer(scoring, ball.lastTouch);
      if (scorer && !scorer.celebrating)
        scorer.celebrate(Math.floor(Math.random() * CELEBRATION_STYLES));
      if (this.flow.phase === 'live') {
        const strike = qualifyingGoal(
          ball.goalStrike,
          scoring,
          this.rules.effect ? CHAOS.maxGoalKmh : GOAL_FEEDBACK.maxKmh
        );
        this.goalDetail = strike
          ? `${goalStyle(strike)}  ${strike.kmh} KM/H`
          : '';
        this.goalTag = strike ? goalStyle(strike) : '';
        this.goalSpeedKmh = strike?.kmh ?? 0;
        this.goalRecord = '';
        if (!this.demo && scoring === 'home' && strike?.human) {
          this.fastestGoalKmh = Math.max(this.fastestGoalKmh, strike.kmh);
          const best = recordGoalSpeed(
            strike.kmh,
            this.config.mode === 'casual' || !this.config.locked,
            this.config.dailyMode === 'chaos'
          );
          this.newSpeedBest ||= best;
          if (best) this.goalRecord = 'NEW DEVICE BEST!';
        }
        if (
          !this.demo &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
          this.cameras.main.shake(
            GOAL_FEEDBACK.shakeMs,
            GOAL_FEEDBACK.shakeIntensity
          );
      }
      ball.goalStrike = null;
      this.flow.onGoal(scoring);
    }
    if (
      this.flow.phase === 'live' &&
      (contact.out !== 0 || contact.hitPost || contact.hitWall)
    )
      this.playMissSound();
    if (contact.out !== 0 && this.flow.phase === 'live') {
      // Over the bar (or over the end wall): the defending keeper restarts.
      if (ball.owner) releaseBall(ball, ball.owner, t);
      this.chargeSince = null;
      this.passChargeSince = null;
      this.clearReceivers();
      const overBar =
        Math.abs(ball.y - PITCH.height / 2) < this.rules.pitch.goalMouth / 2;
      this.flow.flash(
        overBar ? 'OVER THE BAR' : 'OUT',
        SHOOT.outRestartSec + 0.4
      );
      this.outRestart = {
        keeper: contact.out < 0 ? this.homeKeeper : this.awayKeeper,
        at: t + SHOOT.outRestartSec,
      };
    }

    if (this.flow.phase === 'live') {
      // The CPU kicks off by itself, a moment after the freeze.
      if (
        this.flow.awaitingKickoff &&
        (this.demo || this.flow.kickoffTeam === 'away') &&
        this.flow.phaseTime >= MATCH.cpuKickoffSec
      )
        this.cpuKickoff(t);
      if (!this.demo) this.stepActions(t);
      this.stepAiCarriers(t);
    }
    this.flow.tickClock(dt);
  }

  // Context buttons. With the ball: 1 = pass, 2 = shoot (hold to charge).
  // Without: 1 = tackle, 2 = switch player. A press is remembered
  // for 150 ms while the ball is close, so pressing just before gaining the
  // ball still counts as a pass or shot.
  private stepActions(t: number) {
    const ball = this.ball;
    const controls = this.controls;

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
      const { passer, receiver, weight } = this.pendingPass;
      this.pendingPass = null;
      if (ball.owner === passer) {
        kickPass(
          ball,
          passer,
          receiver,
          this.opponentsOf(passer),
          Math.random,
          weight
        );
        releaseBall(ball, passer, t);
        this.stats.passes += 1;
        // Control moves to the receiver the moment the pass is released;
        // it comes to meet the ball until the human steers it.
        this.setControlled(receiver);
        this.startReceiveAssist(receiver);
        // The passer (AI now) may burst forward for a one-two.
        this.homeBrain.passAndRun(passer, t, Math.random);
        this.flow.kickedOff(); // a kickoff pass starts the match
        this.passReaction('home', t);
      }
    }

    const hasBall = ball.owner === c;
    const fresh = (id: 1 | 2) => controls.pressAge(id) <= INPUT.bufferSec;
    // Waiting for the kickoff (user request): only PASS does anything, and
    // only for our kicker; no shot, tackle or switch.
    const kickoff = this.flow.awaitingKickoff;
    if (kickoff && !hasBall) {
      if (fresh(1)) controls.consume(1);
      if (fresh(2)) controls.consume(2);
      return;
    }

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

    // PASS: a tap is the normal pass (pace fitted to the distance); held,
    // it charges a weighted pass, struck on release at the pace you chose.
    // The target is picked on release, as the preview ring shows.
    if (hasBall && !this.pendingPass && this.chargeSince === null) {
      if (this.passChargeSince === null && fresh(1)) {
        controls.consume(1);
        this.passChargeSince = realNow();
      }
      if (this.passChargeSince !== null && !controls.isHeld(1)) {
        const held = realNow() - this.passChargeSince;
        this.passChargeSince = null;
        const receiver = choosePassTarget(c, this.home, controls.move);
        if (receiver)
          this.pendingPass = {
            passer: c,
            receiver,
            at: t + PASS.windUpSec,
            weight: held <= PASS.weightTapSec ? null : passWeight(held),
          };
      }
    } else if (fresh(1)) {
      if (hasBall) {
        controls.consume(1); // already passing or shooting
      } else if (!ballClose) {
        controls.consume(1);
        // TACKLE: a lunge along the stick (the facing with it centred).
        // Not at a teammate's ball.
        if (!ball.owner || ball.owner.team !== c.team)
          startTackle(
            c,
            controls.move.r > STICK.deadZone
              ? Math.atan2(controls.move.y, controls.move.x)
              : c.heading,
            t,
            ball.owner
          );
      }
    }
    if (!hasBall) this.passChargeSince = null;

    if (kickoff) {
      if (fresh(2)) controls.consume(2); // no kickoff shot
      return;
    }
    if (hasBall && !this.pendingPass && this.passChargeSince === null) {
      if (this.chargeSince === null && fresh(2)) {
        controls.consume(2);
        this.chargeSince = realNow();
      }
      if (this.chargeSince !== null && !controls.isHeld(2)) {
        const held = realNow() - this.chargeSince;
        const charge =
          held <= SHOOT.tapMaxSec ? 0 : clamp(held / SHOOT.chargeSec, 0, 1);
        this.chargeSince = null;
        this.passChargeSince = null;
        const aim = assistedShotDirection(
          c,
          controls.move,
          this.keeperFacing(c),
          Math.random
        );
        kickShot(
          ball,
          c,
          { x: Math.cos(aim), y: Math.sin(aim), r: 1 },
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
    this.passChargeSince = null; // a throw is never weighted

    // Without the ball: 1 = dive (along the stick, or with the stick centred
    // to where the ball will cross the keeper's line), 2 = switch out.
    if (ball.owner !== k) {
      this.chargeSince = null;
      this.passChargeSince = null;
      if (fresh(1)) {
        controls.consume(1);
        if (controls.move.r > STICK.deadZone) {
          startDive(k, Math.atan2(controls.move.y, controls.move.x), t);
        } else {
          // Stick centred: dive to where the ball will cross the line, or
          // jump if it is coming straight at the keeper.
          const target = this.diveTarget(k);
          if (target.dist < KEEPER.reach * 0.7 - KEEPER.diveReach / 2)
            startJump(k, t);
          else startDive(k, target.dir, t, target.dist);
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
        this.startReceiveAssist(receiver);
        this.passReaction('home', t);
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
      this.passChargeSince = null;
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
        speedScale *
        this.rules.power;
      ball.vx = Math.cos(dir) * speed;
      ball.vy = Math.sin(dir) * speed;
      ball.vz =
        (KEEPER.kickMinLift + (KEEPER.kickLift - KEEPER.kickMinLift) * charge) *
        liftScale *
        this.rules.power;
      ball.spin = shape.curl * KEEPER.curlKickSpin;
      k.playShoot();
      ball.shotAnimationAge = 0;
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

  // Switch to the player our AI has sent for the ball (the presser when
  // they have it, the chaser or a pass's receiver when it's loose: the one
  // actually going, not just the nearest), else the teammate who can get to
  // the ball soonest (outfielders only); pressing again within a second
  // cycles on through them in that order.
  private nextSwitch(t: number) {
    // After losing possession, interception time takes priority over AI jobs.
    const lostBall =
      t - this.lostBallAt < INPUT.lostBallSwitchSec &&
      this.ball.owner?.team !== 'home';
    return nextSwitchSelection(
      this.home,
      this.controlled,
      this.ball,
      lostBall ? null : this.homeBrain.switchTarget(),
      {
        players: this.switchCycle,
        index: this.switchIndex,
        lastAt: this.lastSwitchAt,
      },
      t
    );
  }

  private switchPlayer(t: number) {
    if (t - this.lastSwitchAt < INPUT.switchCooldownSec) return;
    this.followShotUntil = -Infinity; // the player chose; stop following the shot
    const selection = this.nextSwitch(t);
    this.switchCycle = selection.players;
    this.switchIndex = selection.index;
    const next = selection.target;
    if (next) {
      this.setControlled(next);
      if (
        INPUT.chaseAssist &&
        next.role !== 'keeper' &&
        t - this.lostBallAt < INPUT.lostBallSwitchSec &&
        this.ball.owner?.team !== 'home'
      )
        this.startChaseAssist(next);
    }
    this.lastSwitchAt = t;
  }

  private playMissSound() {
    // Consume the attempt on first save/miss, even if browser audio is locked.
    // A parry followed by an out-of-bounds bounce must not play it twice.
    if (!this.ball.pendingShot) return;
    this.ball.pendingShot = false;
    if (this.demo) return;
    const { x, y } = this.ball;
    const inGoalArea =
      Math.abs(y - PITCH.height / 2) <= this.rules.pitch.boxHeight / 2 &&
      ((x >= -PITCH.goalDepth - BALL.radius && x <= PITCH.boxDepth) ||
        (x >= PITCH.width - PITCH.boxDepth &&
          x <= PITCH.width + PITCH.goalDepth + BALL.radius));
    if (!inGoalArea) return;
    if (this.cache.audio.exists('goal-miss') && !this.sound.locked) {
      this.sound.stopByKey('goal-miss');
      // Soften only the miss/save cue: rise from silence in 150 ms.
      const cue = this.sound.add('goal-miss', { volume: 0 });
      cue.once(Phaser.Sound.Events.COMPLETE, () => cue.destroy());
      cue.once(Phaser.Sound.Events.STOP, () => cue.destroy());
      if (cue.play()) {
        const fade = this.tweens.add({
          targets: cue,
          volume: EFFECTS_VOLUME,
          duration: 150,
          ease: 'Sine.easeIn',
        });
        cue.once(Phaser.Sound.Events.DESTROY, () => fade.remove());
      } else cue.destroy();
    }
  }

  private onGained(p: Player) {
    this.ball.pendingShot = false;
    this.flow.onTouch();
    this.clearReceivers();
    // Control follows the ball: when our team gains it, we control the carrier.
    if (p.team === 'home') {
      this.lostBallAt = -Infinity;
      this.setControlled(p);
    }
    // A CPU player who has just won the ball decides at once (even while
    // its team's pass reaction delay is running).
    else this.awayBrain.wake();
  }

  // What a team's AI sees: its outfielders, the other side's, and which
  // of its players (if any) the human is controlling.
  private teamView(team: 'home' | 'away'): TeamView {
    const home = team === 'home';
    const c = this.controlled;
    return {
      mates: home ? this.home : this.away,
      opponents: home ? this.away : this.home,
      human: !this.demo && home && c.role === 'outfield' ? c : null,
      ball: this.ball,
      oppKeeper: home ? this.awayKeeper : this.homeKeeper,
      canTackle: this.simTime - this.liveSince >= TACKLE.kickoffGraceSec,
      rand: Math.random,
    };
  }

  // ?debug: each outfielder's AI role over its head (HUMAN for ours).
  private updateRoleText() {
    this.outfield.forEach((p, i) => {
      const text = this.roleText[i];
      if (!text) return;
      const brain = p.team === 'home' ? this.homeBrain : this.awayBrain;
      const t = this.simTime;
      const label =
        t < p.staggerUntil
          ? 'STAGGER'
          : p.stumbling && t < p.tackleUntil
            ? 'DOWN'
            : tacklePhase(p, t) !== 'none'
              ? 'TACKLE'
              : p === this.controlled
                ? 'HUMAN'
                : (brain.orders.get(p)?.role ?? '-').toUpperCase();
      if (text.text !== label) text.setText(label);
      this.projector.project(p.renderX, p.renderY, PLAYER_HEIGHT + 16, AIM_AT);
      text.setPosition(AIM_AT.x, AIM_AT.y);
    });
  }

  // AI carriers' passes, shots and clearances, when their brain says
  // they're due (dribbling is steering). The normal kickPass / kickShot,
  // so the same physics, aim error and keeper reactions apply.
  private stepAiCarriers(t: number) {
    const ball = this.ball;
    for (const brain of [this.homeBrain, this.awayBrain]) {
      const due = brain.takeAction(t, ball);
      if (!due || (!this.demo && due.p === this.controlled)) continue;
      const { p, act } = due;
      if (act.kind === 'dribble') continue;
      if (act.kind === 'pass') {
        if (act.through)
          kickThroughPass(
            ball,
            p,
            act.to,
            this.opponentsOf(p),
            Math.random,
            brain.skill.passErrorScale
          );
        else
          kickPass(
            ball,
            p,
            act.to,
            this.opponentsOf(p),
            Math.random,
            null,
            brain.skill.passErrorScale
          );
        releaseBall(ball, p, t);
        brain.passAndRun(p, t, Math.random); // maybe a one-two run
        this.passReaction(p.team, t);
        continue;
      }
      const dx = act.x - p.x;
      const dy = act.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      // A clearance is lofted; a chip shot is a full swipe up.
      const swipe =
        act.kind === 'clear'
          ? { x: 0, y: -AI.clearChip }
          : act.chip > 0
            ? { x: 0, y: -act.chip }
            : undefined;
      kickShot(
        ball,
        p,
        { x: dx / len, y: dy / len, r: 1 },
        act.kind === 'shoot' ? act.charge : AI.clearCharge,
        this.opponentsOf(p),
        Math.random,
        swipe
      );
      releaseBall(ball, p, t);
      p.playShoot();
    }
  }

  private setControlled(p: Player) {
    if (this.demo) return;
    // Both sides re-think at once: the released player gets an AI role on
    // the next step (no freeze), the new one drops its AI role.
    this.homeBrain.wake();
    this.awayBrain.wake();
    this.controlled.controlled = false;
    p.controlled = true;
    this.controlled = p;
    this.chargeSince = null;
    this.passChargeSince = null;
    this.receiveAssist = null; // a pass's receiver gets it again (startReceiveAssist)
  }

  // The stick for the controlled outfielder. Receive assist: while it is
  // the intended receiver of a pass still travelling and the human hasn't
  // steered it yet, it comes to meet the ball (where it can first reach
  // it; at a sprint when an opponent could get there too). Any new stick
  // input hands it straight back: pushing the stick after centring it, or
  // turning it PASS.assistTakeoverDeg from how it was held at the pass.
  private humanSteer(p: Player) {
    const manual = { move: this.controls.move, sprint: this.controls.sprint };
    const assist = this.receiveAssist;
    const ball = this.ball;
    const owner = ball.owner;
    const active =
      assist !== null &&
      assist.p === p &&
      (assist.kind === 'receive'
        ? p.receiving && !owner
        : // chase: the ball is still the CPU's (not in its keeper's hands) or loose
          owner?.team !== 'home' && !owner?.holding && ball.out === 0);
    if (!assist || !active) {
      this.receiveAssist = null;
      return manual;
    }
    const move = this.controls.move;
    if (move.r > STICK.deadZone) {
      const dir = Math.atan2(move.y, move.x);
      if (
        assist.stickDir === null ||
        Math.abs(angleDiff(dir, assist.stickDir)) > PASS.assistTakeoverDeg * DEG
      ) {
        this.receiveAssist = null;
        return manual;
      }
    } else {
      assist.stickDir = null; // centred: the next push takes over
    }
    const meet = interceptPoint(p, ball);
    const dx = meet.x - p.x;
    const dy = meet.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < AI.arriveDist) return STAND_STILL;
    // A chase after losing the ball always sprints; a receiver only when
    // an opponent could get there too.
    const contested =
      assist.kind === 'chase' ||
      this.opponentsOf(p).some(
        (o) => interceptPoint(o, ball).t < meet.t + AI.chaseRelaxSec
      );
    const sprint = contested && d > AI.sprintChase;
    return {
      move: {
        x: dx / d,
        y: dy / d,
        r: sprint ? 1 : clamp(d / AI.slowDist, 0.2, 0.8),
      },
      sprint,
    };
  }

  // A pass (or throw) to our controlled `p` has just left: it comes to meet
  // the ball until the human steers it (humanSteer).
  private startReceiveAssist(p: Player) {
    if (!PASS.receiveAssist || !p.receiving || p !== this.controlled) return;
    const move = this.controls.move;
    this.receiveAssist = {
      p,
      stickDir: move.r > STICK.deadZone ? Math.atan2(move.y, move.x) : null,
      kind: 'receive',
    };
  }

  // SWITCH after the CPU tackled the ball off us: the new player runs at
  // the ball (at the carrier, or where it can first reach a loose one) by
  // himself until the human steers him (humanSteer; same takeover rule).
  private startChaseAssist(p: Player) {
    const move = this.controls.move;
    this.receiveAssist = {
      p,
      stickDir: move.r > STICK.deadZone ? Math.atan2(move.y, move.x) : null,
      kind: 'chase',
    };
  }

  // The CPU's kickoff: its kicker passes to the nearest teammate (the
  // normal pass at its level's accuracy), and play starts.
  private cpuKickoff(t: number) {
    const ball = this.ball;
    const team = this.flow.kickoffTeam;
    const kicker = team === 'home' ? this.forward : this.awayForward;
    let to: Player | null = null;
    let best = Infinity;
    for (const p of team === 'home' ? this.home : this.away) {
      if (p === kicker) continue;
      const d = Math.hypot(p.x - kicker.x, p.y - kicker.y);
      if (d < best) {
        to = p;
        best = d;
      }
    }
    if (ball.owner === kicker && to) {
      kickPass(
        ball,
        kicker,
        to,
        this.opponentsOf(kicker),
        Math.random,
        null,
        (team === 'home' ? this.homeBrain : this.awayBrain).skill.passErrorScale
      );
      releaseBall(ball, kicker, t);
      this.passReaction(team, t);
    }
    this.flow.kickedOff();
  }

  // After a pass or throw by `team`, the other side's AI only reacts once
  // its pass reaction time is up (LEVELS.passReactSec): until then only
  // players already in the way can cut it out.
  private passReaction(team: Team, t: number) {
    const other = team === 'home' ? this.awayBrain : this.homeBrain;
    other.delay(t, other.skill.passReactSec);
  }

  // Receiver hold (PASS.receiveHoldSec): the intended receiver of a normal
  // pass still travelling, during the first second of it. Ends as soon as
  // anyone has the ball or the pass is no longer his (deflected, cut out).
  private receiverHeld(p: Player, t: number) {
    if (!p.receiving || p.receivingThrough || this.ball.owner) {
      this.receivingSince.delete(p);
      return false;
    }
    const since = this.receivingSince.get(p);
    if (since === undefined) {
      this.receivingSince.set(p, t);
      return true;
    }
    return t - since < PASS.receiveHoldSec;
  }

  private clearReceivers() {
    for (const p of this.outfield) p.receiving = false;
  }

  private opponentsOf(p: Player) {
    return p.team === 'home'
      ? [...this.away, this.awayKeeper]
      : [...this.home, this.homeKeeper];
  }

  private get forward() {
    return this.home[this.home.length - 1] ?? this.home[0] ?? this.homeKeeper;
  }

  private get awayForward() {
    return this.away[this.away.length - 1] ?? this.away[0] ?? this.awayKeeper;
  }

  // Players to their spots, ball on the centre spot. The kicking team's
  // forward stands next to the ball; the away side mirrors ours.
  // Ground point of the celebrating scorer, for the camera (null otherwise).
  private celebrantFocus() {
    const p = this.everyone.find((q) => q.celebrating);
    return p ? { x: p.renderX, y: p.renderY } : null;
  }

  // Who celebrates a goal: the last toucher if they are on the scoring
  // team, else (an own goal) the scoring team's outfielder nearest the ball.
  private scorer(team: Team, last: Player | null) {
    // Keepers never celebrate (their atlases have no celebration poses):
    // a keeper's goal is celebrated by the nearest outfielder.
    if (last && last.team === team && last.role !== 'keeper') return last;
    const side = team === 'home' ? this.home : this.away;
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of side) {
      const d = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private updateDailyTactics(time: number, force = false) {
    if (!this.config.dailyMode || this.config.mode === 'casual') return;
    if (!force && this.flow.phase !== 'live' && this.flow.phase !== 'kickoff')
      return;
    const plan = dailyPlans(this.config, this.flow.score, this.flow.clock);
    if (plan.key === this.tacticalKey) {
      this.pendingTactic = '';
      return;
    }
    if (!force && this.flow.phase !== 'kickoff') {
      if (this.pendingTactic !== plan.key) {
        this.pendingTactic = plan.key;
        this.pendingTacticAt = time + DAILY.tacticSwitchSec;
      }
      if (time < this.pendingTacticAt) return;
    }
    this.homeBrain.configure(LEVELS.normal, plan.home);
    this.awayBrain.configure(LEVELS[plan.difficulty], plan.away);
    this.botDifficulty = plan.difficulty;
    this.tacticalKey = plan.key;
    this.pendingTactic = '';
  }

  private resetForKickoff() {
    const previousDifficulty = this.botDifficulty;
    this.updateDailyTactics(this.simTime, true);
    // Announce the actual upgrade only after the goal scene has finished.
    this.rampageUpgradeSince =
      this.config.dailyMode === 'survival' &&
      this.flow.lastScorer === 'home' &&
      survivalUpgrade(this.config, this.flow.score.home, previousDifficulty) ===
        this.botDifficulty
        ? this.feedbackTime
        : null;
    this.ball.placeAt(PITCH.width / 2, PITCH.height / 2);
    this.homeShape.forEach((s, i) => this.home[i]?.placeAt(s.x, s.y));
    this.awayShape.forEach((s, i) =>
      this.away[i]?.placeAt(PITCH.width - s.x, s.y)
    );
    // The other side's forward waits outside the centre circle.
    const spotY = FORMATION.kickoffSpot.y;
    if (this.flow.kickoffTeam === 'home') {
      this.forward.placeAt(FORMATION.kickoffSpot.x, spotY);
      this.awayForward.placeAt(PITCH.width - FORMATION.defendKickoffX, spotY);
    } else {
      this.awayForward.placeAt(PITCH.width - FORMATION.kickoffSpot.x, spotY);
      this.forward.placeAt(FORMATION.defendKickoffX, spotY);
    }
    this.homeKeeper.placeAt(FORMATION.keeper.x, FORMATION.keeper.y);
    this.awayKeeper.placeAt(
      PITCH.width - FORMATION.keeper.x,
      FORMATION.keeper.y
    );
    // The kicker has the ball at its feet; play (AI, clock) starts with its
    // kickoff pass (MatchFlow.kickedOff).
    gainBall(
      this.ball,
      this.flow.kickoffTeam === 'home' ? this.forward : this.awayForward
    );
    this.pendingPass = null;
    this.followShotUntil = -Infinity;
    this.outRestart = null;
    this.chargeSince = null;
    this.passChargeSince = null;
    this.receiveAssist = null;
    this.lostBallAt = -Infinity;
    // Nothing the AI had queued (a pass, a shot, a tackle) survives a restart.
    this.homeBrain.reset();
    this.awayBrain.reset();
    this.setControlled(this.forward);
  }

  // While a shot (or keeper kick) charges: the swipe shape above the
  // shooter's head (the thumb hides the button). The strike direction is
  // shown by the ground marker's pointer stretching out (updateGroundMarker).
  private updateShotText() {
    const c = this.controlled;
    const charging = this.chargeSince !== null && this.ball.owner === c;
    this.shotText.setVisible(charging);
    if (!charging) return;
    const label =
      shotLabel(this.controls.swipe, c.holding) ||
      (c.holding ? 'KICK' : 'SHOT');
    if (this.shotText.text !== label) this.shotText.setText(label);
    // Above the overhead arrow (which sits over the sprite).
    this.projector.project(c.renderX, c.renderY, PLAYER_HEIGHT + 48, AIM_AT);
    this.shotText.setPosition(AIM_AT.x, AIM_AT.y);
  }

  // How far the shot (or keeper kick) is charged, 0..1, or null when the
  // controlled player isn't charging one.
  private currentCharge() {
    if (this.chargeSince === null || this.ball.owner !== this.controlled)
      return null;
    return clamp((realNow() - this.chargeSince) / SHOOT.chargeSec, 0, 1);
  }

  // The charge being built on the controlled player's ball, shot or
  // weighted pass, with where it goes and its colour; null when none is.
  // `ideal` (passes) is the charge that weighs the pass just right.
  private activeCharge(c: Player): {
    charge: number;
    dir: number;
    color: number;
    ideal: number | null;
  } | null {
    const shot = this.currentCharge();
    if (shot !== null)
      return {
        charge: shot,
        dir: this.strikeDirection(c),
        color: this.chargeColor(shot, c.holding),
        ideal: null,
      };
    if (this.passChargeSince === null || this.ball.owner !== c) return null;
    const held = realNow() - this.passChargeSince;
    // A tap's worth of holding is still a normal pass: no gauge yet.
    if (held <= PASS.weightTapSec) return null;
    const charge = passWeight(held);
    const target = this.home.find((p) => p.passTarget);
    if (!target)
      return { charge, dir: c.heading, color: PAL.white, ideal: null };
    const ideal = idealPassWeight(
      Math.hypot(target.x - this.ball.x, target.y - this.ball.y)
    );
    const off = charge - ideal;
    return {
      charge,
      dir: Math.atan2(target.y - c.y, target.x - c.x),
      color:
        Math.abs(off) <= PASS.weightGoodBand
          ? PAL.green
          : off > 0
            ? PAL.red
            : PAL.white,
      ideal,
    };
  }

  // Which way the strike will leave: the stick, or the facing with the stick
  // centred; a keeper kick from the hands goes upfield then. An outfield
  // shot shows the finishing assist at its middle strength.
  private strikeDirection(c: Player) {
    if (c.holding && this.controls.move.r <= STICK.deadZone)
      return c.team === 'home' ? 0 : Math.PI;
    if (c.role === 'keeper') return shotDirection(c, this.controls.move);
    return assistedShotDirection(
      c,
      this.controls.move,
      this.keeperFacing(c),
      () => 0.5
    );
  }

  // The keeper a player shoots at.
  private keeperFacing(p: Player) {
    return p.team === 'home' ? this.awayKeeper : this.homeKeeper;
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
  // KICK or a weighted PASS charges, a segmented gauge fills round the ring
  // and the pointer itself stretches out into an arrow along the strike
  // (pass) direction, growing faster the longer it is held. It is the same
  // arrow throughout: the head slides out from the ring with a shaft behind.
  private updateGroundMarker() {
    const g = this.marker;
    g.clear();
    const c = this.controlled;
    if (this.flow.phase === 'fulltime') return;
    const active = this.activeCharge(c);
    const charge = active?.charge ?? null;
    const dir = active?.dir ?? c.heading;
    const color = active?.color ?? PAL.white;
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
    // A point `along` the pointer direction and `across` it (world px).
    const onPointer = (along: number, across: number) => {
      this.projector.project(
        x + Math.cos(dir) * along - Math.sin(dir) * across,
        y + Math.sin(dir) * along + Math.cos(dir) * across,
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
    // For a weighted pass the segments that would weigh it right glow green.
    if (active && charge !== null) {
      const step = (Math.PI * 2) / GAUGE_SEGMENTS;
      const lit = Math.ceil(charge * GAUGE_SEGMENTS);
      for (let i = 0; i < GAUGE_SEGMENTS; i++) {
        const a0 = dir + i * step + step * 0.12;
        const a1 = dir + (i + 1) * step - step * 0.12;
        const inner = RING_RADIUS + 5;
        const outer = RING_RADIUS + 15;
        const mid = (i + 0.5) / GAUGE_SEGMENTS;
        const good =
          active.ideal !== null &&
          Math.abs(mid - active.ideal) <= PASS.weightGoodBand;
        if (i < lit) g.fillStyle(color, 0.95);
        else if (good) g.fillStyle(PAL.green, 0.45);
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

    // Pointer: a triangle just outside the gauge pointing along the
    // direction. While charging it slides outward (ease-in, so it speeds
    // up as the charge builds) and a tapering shaft fills in behind it.
    const base = RING_RADIUS + POINTER_GAP;
    const reach =
      charge === null || !SHOOT.aimArrow
        ? 0
        : POINTER_STRETCH * Math.pow(charge, POINTER_EASE);
    const headBack = base + reach; // where the head's back edge sits
    if (reach > 1) {
      g.fillStyle(color, 0.8).fillPoints(
        [
          onPointer(base, -SHAFT_HALF_START),
          onPointer(headBack, -SHAFT_HALF_END),
          onPointer(headBack, SHAFT_HALF_END),
          onPointer(base, SHAFT_HALF_START),
        ],
        true
      );
    }
    const tip = onPointer(headBack + POINTER_LENGTH, 0);
    const left = onPointer(headBack, -POINTER_HALF_WIDTH);
    const right = onPointer(headBack, POINTER_HALF_WIDTH);
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

  // Smaller, broken, muted outline: no disc, pointer, gauge or animation.
  private updateSwitchMarker() {
    const g = this.switchMarker;
    g.clear();
    const c = this.controlled;
    if (
      this.flow.phase !== 'live' ||
      this.flow.awaitingKickoff ||
      this.ball.owner === c ||
      (c.role !== 'keeper' &&
        !this.ball.owner &&
        Math.hypot(this.ball.x - c.x, this.ball.y - c.y) < INPUT.bufferNearBall)
    )
      return;
    const target = this.nextSwitch(this.simTime).target;
    if (!target) return;
    const scale = this.projector.project(
      target.renderX,
      target.renderY,
      0,
      AIM_AT
    ).scale;
    g.lineStyle(Math.max(1, 1.5 * scale), PAL.lightGray, 0.45);
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const points = Array.from({ length: 5 }, (_, j) => {
        const angle = ((i + 0.65 * (j / 4)) / segments) * Math.PI * 2;
        this.projector.project(
          target.renderX + Math.cos(angle) * RING_RADIUS * 0.85,
          target.renderY + Math.sin(angle) * RING_RADIUS * 0.85,
          0,
          AIM_AT
        );
        return { x: AIM_AT.x, y: AIM_AT.y };
      });
      g.strokePoints(points, false, false);
    }
    g.setDepth(target.renderY - 0.5);
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
    s.rampage =
      this.config.dailyMode === 'survival'
        ? {
            difficulty: this.botDifficulty,
            upgradeAge:
              this.rampageUpgradeSince === null
                ? null
                : this.feedbackTime - this.rampageUpgradeSince,
            lives: Math.max(
              0,
              survivalLimits(this.config).conceded - this.flow.score.away
            ),
          }
        : null;
    s.mission =
      this.config.dailyMode === 'chaos'
        ? chaosLabel(this.config)
        : this.config.dailyMode === 'survival'
          ? `${Math.min(survivalLimits(this.config).goals, this.flow.score.home)}/${survivalLimits(this.config).goals} GOALS`
          : this.config.dailyMode === 'hold-lead'
            ? 'SHIELD - FINISH AHEAD'
            : this.config.dailyMode === 'comeback'
              ? 'COMEBACK - FINISH AHEAD'
              : '';
    s.goalCelebration = {
      active: this.flow.phase === 'goal',
      age: this.flow.phaseTime,
      team: this.flow.lastScorer,
      tag: this.goalTag,
      kmh: this.goalSpeedKmh,
      personalBest: this.goalRecord !== '',
    };
    s.goalDetail = this.flow.phase === 'goal' ? this.goalDetail : '';
    s.goalRecord = this.flow.phase === 'goal' ? this.goalRecord : '';
    this.everyone.forEach((p, i) => {
      const dot = s.minimap.dots[i];
      if (!dot) return;
      dot.x = p.renderX;
      dot.y = p.renderY;
      dot.controlled = p === this.controlled;
    });
    s.minimap.ballX = this.ball.renderX;
    s.minimap.ballY = this.ball.renderY;
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
    if (this.demo) return;
    if (this.resultShown) return;
    this.resultShown = true;
    void this.gameCount?.complete();
    const result: MatchResult = {
      config: this.config,
      elapsedSec: Math.min(
        this.config.durationSec,
        Math.ceil(this.flow.elapsedSec)
      ),
      fastestGoalKmh: this.fastestGoalKmh,
      newSpeedBest: this.newSpeedBest,
      goalsFor: this.flow.score.home,
      goalsAgainst: this.flow.score.away,
      shots: this.stats.shots,
      passes: this.stats.passes,
      tacklesWon: this.stats.tacklesWon,
    };
    this.journey?.end(
      journeyResult(
        this.config,
        result.goalsFor,
        result.goalsAgainst,
        this.flow.elapsedSec
      )
    );
    this.scene.start('Result', result);
  }

  private debugInfo() {
    const p = this.controlled;
    const b = this.ball;
    const f = this.rig.focus;
    const owner = b.owner ? `${b.owner.team} ${b.owner.role}` : 'loose';
    return [
      `AI ${this.botDifficulty} | ${this.flow.phase}`,
      `POS ${Math.round(p.x)},${Math.round(p.y)} SPEED ${Math.round(p.speed)}${p.sprinting ? ' SPRINT' : ''}`,
      `STAMINA ${Math.round(p.stamina)}${p.sprintLocked ? ' LOCKED' : ''}`,
      `BALL ${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.z)} V ${Math.round(b.speed)} ${owner}`,
      `CAM ${Math.round(f.x)},${Math.round(f.y)} ZOOM ${this.rig.currentZoom.toFixed(2)}`,
      `SIM ${this.simMsAvg.toFixed(2)} MS/FRAME PEAK ${this.simMsPeak.toFixed(2)}`,
      `LOAD MS ${timingSummary()}`,
    ].join('\n');
  }
}
