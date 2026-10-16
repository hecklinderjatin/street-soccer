import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import type { Controls } from '../systems/Controls';
import { ActionButtons, type ButtonContext } from '../ui/ActionButtons';
import { Joystick } from '../ui/Joystick';
import { PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';

// Match state the HUD shows, written by the Match scene every frame.
export type MatchHudState = {
  home: number;
  away: number;
  clock: number; // seconds left
  goldenGoal: boolean;
  banner: string; // big centre message, '' for none
  buttons: ButtonContext;
};

export type HudData = {
  controls: Controls;
  state: MatchHudState;
  debugInfo: () => string; // extra lines for the debug overlay
};

// Screen-space UI drawn over the Match scene with its own camera, so it is
// unaffected by the world rendering.
export class HudScene extends Phaser.Scene {
  private hud!: HudData;
  private joystick!: Joystick;
  private actionButtons!: ActionButtons;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private clockText!: Phaser.GameObjects.BitmapText;
  private goldenText!: Phaser.GameObjects.BitmapText;
  private bannerText!: Phaser.GameObjects.BitmapText;
  private bannerShadow!: Phaser.GameObjects.BitmapText;
  private debugText!: Phaser.GameObjects.BitmapText;
  private showDebug = false;
  private pauseLayer!: Phaser.GameObjects.Container;

  constructor() {
    super('Hud');
  }

  init(data: HudData) {
    this.hud = data;
    this.showDebug = false;
  }

  create() {
    this.joystick = new Joystick(this, this.hud.controls);
    this.actionButtons = new ActionButtons(this, this.hud.controls);
    // Never leave the player running (or a button held) if the app loses focus mid-touch.
    const release = () => {
      this.joystick.release();
      this.actionButtons.release();
    };
    this.game.events.on(Phaser.Core.Events.BLUR, release);
    this.game.events.on(Phaser.Core.Events.HIDDEN, release);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, release);
      this.game.events.off(Phaser.Core.Events.HIDDEN, release);
    });

    this.buildScoreboard();

    // FPS readout under the scoreboard; tap it (or press the backtick key) for the debug overlay.
    this.debugText = pixelText(this, 16, 84, '', 0.75 * PX, PAL.green)
      .setInteractive({ useHandCursor: true })
      .on(
        Phaser.Input.Events.POINTER_DOWN,
        () => (this.showDebug = !this.showDebug)
      );
    this.input.keyboard?.on(
      'keydown-BACKTICK',
      () => (this.showDebug = !this.showDebug)
    );

    this.bannerShadow = pixelText(
      this,
      VIEW.width / 2 + 2 * PX,
      250 + 2 * PX,
      '',
      3 * PX,
      PAL.black
    ).setOrigin(0.5);
    this.bannerText = pixelText(
      this,
      VIEW.width / 2,
      250,
      '',
      3 * PX,
      PAL.yellow
    ).setOrigin(0.5);

    new TextButton(
      this,
      VIEW.width - 56,
      48,
      '',
      () => this.setPaused(true),
      {
        width: 72,
        height: 64,
        fill: PAL.darkGray,
        icon: 'pause',
      }
    );
    this.input.keyboard?.on('keydown-ESC', () =>
      this.setPaused(!this.pauseLayer.visible)
    );

    this.pauseLayer = this.buildPauseLayer().setVisible(false);
  }

  override update(time: number) {
    const s = this.hud.state;
    this.joystick.update();
    this.actionButtons.update(s.buttons);

    this.scoreText.setText(`YOU ${s.home} - ${s.away} OPP`);
    // Keep the whole label between the colour chips, including multi-digit scores.
    this.scoreText.setScale(1);
    const scoreWidth = this.scoreText.displayWidth;
    if (scoreWidth > 272) this.scoreText.setScale(272 / scoreWidth);
    // Font cells include one transparent pixel at the right and bottom.
    // Centre the visible glyphs (including their shadow), not that padding.
    const scoreBounds = this.scoreText.getTextBounds().local;
    const fontPixel = this.scoreText.fontSize / this.scoreText.fontData.size;
    this.scoreText.setDisplayOrigin(
      (scoreBounds.width - fontPixel) / 2,
      (scoreBounds.height - fontPixel) / 2
    );
    const secs = Math.ceil(s.clock);
    this.clockText.setText(
      `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
    );
    // Last 10 seconds: red and pulsing.
    const urgent = s.clock <= 10 && s.clock > 0;
    this.clockText
      .setTint(urgent ? PAL.red : PAL.white)
      .setScale(urgent ? 1 + 0.08 * Math.sin(time / 80) : 1);
    this.goldenText.setVisible(s.goldenGoal);

    const banner = s.banner.toUpperCase();
    this.bannerText.setText(banner);
    this.bannerShadow.setText(banner);
    const pop = banner === 'GOAL!' ? 1 + 0.06 * Math.sin(time / 60) : 1;
    this.bannerText.setScale(pop);
    this.bannerShadow.setScale(pop);

    const fps = `${Math.round(this.game.loop.actualFps)} FPS`;
    // The pixel font only has capitals.
    this.debugText.setText(
      (this.showDebug ? `${this.hud.debugInfo()}\n${fps}` : fps).toUpperCase()
    );
  }

  private buildScoreboard() {
    // Use one centre for the box, colour bars and score. Shorter bars leave
    // equal vertical padding and match the visible height of the lettering.
    const scoreX = 184;
    const scoreY = 44;
    this.add.rectangle(scoreX, scoreY, 336, 56, PAL.black, 0.75);
    this.add.rectangle(scoreX - 152, scoreY -2, 16, 28, PAL.red);
    this.add.rectangle(scoreX + 152, scoreY -2, 16, 28, PAL.blue);
    this.scoreText = pixelText(this, scoreX, scoreY + 2, '', 0.75 * PX, PAL.white).setOrigin(0.5);

    const cx = VIEW.width / 2;
    this.add
      .graphics()
      .fillStyle(PAL.black, 0.75)
      .fillRect(cx - 80, 16, 160, 56);
    this.clockText = pixelText(this, cx, 50, '', PX, PAL.white).setOrigin(0.5);
    this.goldenText = pixelText(
      this,
      cx,
      88,
      'GOLDEN GOAL',
      0.75 * PX,
      PAL.yellow
    )
      .setOrigin(0.5)
      .setVisible(false);
  }

  private setPaused(paused: boolean) {
    this.pauseLayer.setVisible(paused);
    this.joystick.enabled = !paused;
    this.actionButtons.enabled = !paused;
    if (paused) {
      this.joystick.release();
      this.actionButtons.release();
      this.scene.pause('Match');
    } else {
      this.scene.resume('Match');
    }
  }

  private buildPauseLayer() {
    const cx = VIEW.width / 2;
    const dim = this.add
      .rectangle(0, 0, VIEW.width, VIEW.height, PAL.black, 0.7)
      .setOrigin(0)
      .setInteractive(); // swallow taps behind the menu
    const title = pixelText(
      this,
      cx,
      220,
      'PAUSED',
      2 * PX,
      PAL.yellow
    ).setOrigin(0.5);
    const resume = new TextButton(
      this,
      cx,
      360,
      'RESUME',
      () => this.setPaused(false),
      {
        width: 320,
        fill: PAL.green,
      }
    );
    const quit = new TextButton(
      this,
      cx,
      470,
      'QUIT',
      () => {
        this.scene.stop('Match');
        this.scene.start('Menu');
      },
      { width: 320, fill: PAL.red }
    );
    return this.add.container(0, 0, [dim, title, resume, quit]).setDepth(10);
  }
}
