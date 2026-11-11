import Phaser from 'phaser';
import { context } from '@devvit/web/client';
import { BALL, FREE_KICK as FK } from '../../shared/tuning';
import { createBallTexture } from '../art/ballArt';
import { queueAssets } from '../art/gameAssets';
import { freeKickAssets } from '../art/assetList';
import { registerPlayerAtlases } from '../art/playerArt';
import { startingConfig, freeKickChallenge } from '../challenge';
import { releaseEarlyDownloads, withEarlyDownloads } from '../earlyAssets';
import { endlessFreeKick } from '../../shared/freeKickChallenge';
import { PAL } from '../ui/palette';
import { KickCamera } from './KickCamera';
import { kickerFrame, runupShares } from './kickerFrames';
import { Stage } from './Stage';
import {
  GOAL_X,
  GOAL_Y,
  POST_HALF,
  STEP,
  ballContact,
  levelFor,
  postKick,
  makeKick,
  powerBand,
  startPlay,
  stepPlay,
  type KickPlay,
  type Strike,
} from './rules';

// The actual court, players and physics, with no player session, audio,
// scores, metrics or controls. Preview attempts never become played games.
class FreeKickPreviewScene extends Phaser.Scene {
  private readonly cam = new KickCamera();
  private stage: Stage | null = null;
  private setup = makeKick(levelFor(0), Math.random);
  private play: KickPlay | null = null;
  private strike!: Strike;
  private clock = 0;
  private acc = 0;
  private attempt = 0;
  private nextAt = 0;
  private resultAt: number | null = null;

  constructor(private readonly visibleRatio: () => number) {
    super('FreeKickPreview');
  }

  create() {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.frame, this);
    this.game.events.on('preview-layout', this.frame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.frame, this);
      this.game.events.off('preview-layout', this.frame, this);
    });
    const assets = freeKickAssets(startingConfig());
    void withEarlyDownloads(assets).then((ready) => {
      if (!this.sys.isActive()) return;
      const finish = () => {
        void releaseEarlyDownloads(assets);
        registerPlayerAtlases(this);
        createBallTexture(this);
        const config = startingConfig();
        this.stage = new Stage(this, {
          kicker: config.home.jersey,
          wall: config.away.jersey,
        });
        this.nextKick();
      };
      if (queueAssets(this, ready)) {
        this.load.once(Phaser.Loader.Events.COMPLETE, finish);
        this.load.start();
      } else finish();
    });
  }

  private frame() {
    this.cam.frame(
      this.setup.spot,
      this.scale.width,
      this.scale.height * this.visibleRatio()
    );
  }

  private nextKick() {
    const config = freeKickChallenge();
    this.setup = postKick(
      config,
      endlessFreeKick(config)
        ? this.attempt++
        : this.attempt++ % config.goals,
      context?.postId ?? 'local'
    );
    const contact = ballContact(((this.attempt % 3) - 1) * 0.5, 0.4);
    const band = powerBand(this.setup, contact);
    this.strike = {
      contact,
      power: band ? (band.lo + band.hi) / 2 : FK.defaultPower,
      targetY: GOAL_Y + (this.attempt % 2 ? -1 : 1) * POST_HALF * 0.7,
    };
    this.play = null;
    this.acc = 0;
    this.resultAt = null;
    this.nextAt = this.clock + 1.2;
    this.frame();
    this.stage?.setKick(this.cam);
  }

  override update(_time: number, deltaMs: number) {
    if (!this.stage) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.clock += dt;
    if (!this.play && this.clock >= this.nextAt)
      this.play = startPlay(this.setup, this.strike, Math.random);
    if (this.play && this.resultAt === null) {
      this.acc += dt;
      while (this.acc >= STEP && this.play.outcome === null) {
        this.acc -= STEP;
        stepPlay(this.play, STEP);
        this.stage.recordTrail(this.play);
      }
      if (this.play.outcome !== null) this.resultAt = this.clock;
    }
    if (this.resultAt !== null) {
      this.stage.fadeTrail(dt);
      if (this.clock - this.resultAt >= 1.4) this.nextKick();
    }
    const { spot } = this.setup;
    const dx = GOAL_X - spot.x,
      dy = GOAL_Y - spot.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length,
      uy = dy / length;
    const run = this.play
      ? 1
      : Phaser.Math.Clamp(
          (this.clock - (this.nextAt - FK.runupSec)) / FK.runupSec,
          0,
          1
        );
    // Round in a curve on the ball's right, then on toward the goal.
    const share = runupShares(run);
    const follow = this.play
      ? FK.kickerFollow * (1 - Math.exp(-Math.min(this.play.t, 0.4) * 9))
      : 0;
    const back =
      FK.kickerStartBack +
      (FK.kickerContactBack - FK.kickerStartBack) * share.back -
      follow;
    const side =
      FK.kickerStartSide +
      (FK.kickerContactSide - FK.kickerStartSide) * share.side;
    // Unmirrored on the ball's right; a left curl flips at the strike.
    const kick = kickerFrame(
      run,
      this.play?.t ?? null,
      this.strike.contact.x > 0
    );
    this.stage.render(this.cam, this.setup, this.play, {
      ball: this.play?.ball ?? { ...spot, z: BALL.radius },
      ballAge: this.play?.t ?? Infinity,
      kicker: {
        x: spot.x - ux * back - uy * side,
        y: spot.y - uy * back + ux * side,
        frame: kick.frame,
        flip: kick.mirror,
      },
      timeSec: this.clock,
      goalFlash: false,
    });
  }
}

export function createFreeKickPreview(parent: HTMLElement) {
  const visibleRatio = () => {
    const details = parent.parentElement?.querySelector<HTMLElement>(
      '.freekick-lobby-details'
    );
    return Phaser.Math.Clamp(
      (parent.clientHeight - (details?.offsetHeight ?? 0)) /
        Math.max(1, parent.clientHeight),
      0.15,
      1
    );
  };
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: FK.viewWidth,
    height: FK.viewHeight,
    backgroundColor: PAL.navy,
    antialias: false,
    roundPixels: false,
    fps: { target: 30, limit: 30 },
    audio: { noAudio: true },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new FreeKickPreviewScene(visibleRatio)],
  });
  const details = parent.parentElement?.querySelector(
    '.freekick-lobby-details'
  );
  if (details && typeof ResizeObserver !== 'undefined') {
    const resize = new ResizeObserver(() => game.events.emit('preview-layout'));
    resize.observe(details);
    game.events.once(Phaser.Core.Events.DESTROY, () => resize.disconnect());
  }
  if (new URLSearchParams(window.location.search).has('debug'))
    Reflect.set(window, '__freekickPreview', game);
  return game;
}
