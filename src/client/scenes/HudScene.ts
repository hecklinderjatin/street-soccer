import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import type { Team, TeamSetup } from '../../shared/types';
import type { Controls } from '../systems/Controls';
import { ActionButtons, type ButtonContext } from '../ui/ActionButtons';
import { buildHelpLayer } from '../ui/HelpPanel';
import { Joystick } from '../ui/Joystick';
import { Minimap, type MinimapState } from '../ui/Minimap';
import { JERSEY_SWATCH, PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';
import { setSoundMuted, soundMuted } from '../ui/soundSetting';

// Match state the HUD shows, written by the Match scene every frame.
export type MatchHudState = {
  home: number;
  away: number;
  clock: number; // seconds left
  goldenGoal: boolean;
  banner: string; // big centre message, '' for none
  buttons: ButtonContext;
  minimap: MinimapState;
};

export type HudData = {
  controls: Controls;
  state: MatchHudState;
  teams: Record<Team, TeamSetup>; // scoreboard names and chip colours
  debugInfo: () => string; // extra lines for the debug overlay
};

// Screen-space UI drawn over the Match scene with its own camera, so it is
// unaffected by the world rendering.
export class HudScene extends Phaser.Scene {
  private hud!: HudData;
  private joystick!: Joystick;
  private actionButtons!: ActionButtons;
  private minimap!: Minimap;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private clockText!: Phaser.GameObjects.BitmapText;
  private goldenText!: Phaser.GameObjects.BitmapText;
  private bannerText!: Phaser.GameObjects.BitmapText;
  private bannerShadow!: Phaser.GameObjects.BitmapText;
  private debugText!: Phaser.GameObjects.BitmapText;
  private showDebug = false;
  private pauseLayer!: Phaser.GameObjects.Container;
  private helpLayer!: Phaser.GameObjects.Container; // how to play (the i button)

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
    this.minimap = new Minimap(this);

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
      () => this.setOverlay('pause'),
      {
        width: 72,
        height: 64,
        fill: PAL.darkGray,
        icon: 'pause',
      }
    );
    // i: how to play (pauses the match while it's open), left of pause.
    new TextButton(
      this,
      VIEW.width - 144,
      48,
      '',
      () => this.setOverlay('help'),
      {
        width: 72,
        height: 64,
        fill: PAL.blue,
        icon: 'info',
      }
    );
    // One master sound switch for music and effects, directly left of i.
    // The switch's state lives in soundSetting (Phaser's mute can't be read
    // back right after it is set).
    setSoundMuted(this.sound, soundMuted());
    const soundButton = new TextButton(
      this,
      VIEW.width - 232,
      48,
      '',
      () => {
        setSoundMuted(this.sound, !soundMuted());
        drawSound();
      },
      { width: 72, height: 64, fill: PAL.darkGray }
    );
    const speaker = this.add.graphics();
    soundButton.add(speaker);
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
      soundButton.setFill(mute ? PAL.darkGray : PAL.darkGreen);
    };
    drawSound();
    // ESC closes whatever is open, else pauses; I toggles the help.
    this.input.keyboard?.on('keydown-ESC', () =>
      this.setOverlay(this.overlayOpen() ? null : 'pause')
    );
    this.input.keyboard?.on('keydown-I', () =>
      this.setOverlay(this.helpLayer.visible ? null : 'help')
    );

    this.pauseLayer = this.buildPauseLayer().setVisible(false);
    this.helpLayer = buildHelpLayer(this, () =>
      this.setOverlay(null)
    ).setVisible(false);
  }

  override update(time: number) {
    const s = this.hud.state;
    this.joystick.update();
    this.actionButtons.update(s.buttons);
    this.minimap.update(s.minimap);

    const { home, away } = this.hud.teams;
    this.scoreText.setText(`${home.name} ${s.home} - ${s.away} ${away.name}`);
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
    // Chips in each team's jersey colour, outlined so black still shows.
    const { home, away } = this.hud.teams;
    for (const [dx, setup] of [
      [-152, home],
      [152, away],
    ] as const)
      this.add
        .rectangle(scoreX + dx, scoreY - 2, 16, 28, JERSEY_SWATCH[setup.jersey])
        .setStrokeStyle(2, PAL.white, 0.5);
    this.scoreText = pixelText(
      this,
      scoreX,
      scoreY + 2,
      '',
      0.75 * PX,
      PAL.white
    ).setOrigin(0.5);

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

  private overlayOpen() {
    return this.pauseLayer.visible || this.helpLayer.visible;
  }

  // Shows the pause menu or the help (either pauses the match), or closes
  // both and resumes.
  private setOverlay(which: 'pause' | 'help' | null) {
    this.pauseLayer.setVisible(which === 'pause');
    this.helpLayer.setVisible(which === 'help');
    const paused = which !== null;
    this.joystick.enabled = !paused;
    this.actionButtons.enabled = !paused;
    if (paused) {
      this.joystick.release();
      this.actionButtons.release();
      if (!this.scene.isPaused('Match')) this.scene.pause('Match');
    } else if (this.scene.isPaused('Match')) {
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
      () => this.setOverlay(null),
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
