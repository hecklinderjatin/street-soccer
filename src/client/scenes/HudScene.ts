import { tacticButton, paintTacticButton } from '../ui/TacticButton';
import type { MatchTactic } from '../systems/ai';
import { RampageFeedback, type RampageHudState } from '../ui/RampageFeedback';
import { chaosRules } from '../../shared/chaos';
import { buildMatchDetailsLayer } from '../ui/MatchDetailsPanel';
import { currentPostType } from '../challenge';
import {
  GoalCelebration,
  type GoalCelebrationState,
} from '../ui/GoalCelebration';
import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import type { Team, TeamSetup, MatchConfig } from '../../shared/types';
import type { Controls } from '../systems/Controls';
import {
  actionForKey,
  loadKeyBindings,
  type KeyBindings,
} from '../systems/keyBindings';
import { ActionButtons, type ButtonContext } from '../ui/ActionButtons';
import { buildHelpLayer } from '../ui/HelpPanel';
import { Joystick } from '../ui/Joystick';
import { KeyBindingsPanel } from '../ui/KeyBindingsPanel';
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
  goalCelebration: GoalCelebrationState;
  mission: string;
  rampage: RampageHudState | null;
  goalDetail: string;
  goalRecord: string;
  banner: string; // big centre message, '' for none
  buttons: ButtonContext;
  minimap: MinimapState;
};

export type HudData = {
  onTactic: (tactic: MatchTactic) => void;
  onMatchStart: () => void;
  onInputCancel: () => void;
  onMatchQuit: () => void;
  config: MatchConfig;
  controls: Controls;
  state: MatchHudState;
  teams: Record<Team, TeamSetup>; // scoreboard names and chip colours
  debugInfo: () => string; // extra lines for the debug overlay
};

// Screen-space UI drawn over the Match scene with its own camera, so it is
// unaffected by the world rendering.
export class HudScene extends Phaser.Scene {
  private tactic: MatchTactic = 'normal';
  private tacticButtons: { mode: MatchTactic; button: TextButton }[] = [];
  private tacticNotice!: Phaser.GameObjects.BitmapText;
  private hud!: HudData;
  private joystick!: Joystick;
  private actionButtons!: ActionButtons;
  private minimap!: Minimap;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private clockText!: Phaser.GameObjects.BitmapText;
  private goldenText!: Phaser.GameObjects.BitmapText;
  private bannerText!: Phaser.GameObjects.BitmapText;
  private rampageFeedback!: RampageFeedback;
  private livesText!: Phaser.GameObjects.BitmapText;
  private missionText!: Phaser.GameObjects.BitmapText;
  private goalCelebration!: GoalCelebration;
  private bannerShadow!: Phaser.GameObjects.BitmapText;
  private debugText!: Phaser.GameObjects.BitmapText;
  private showDebug = false;
  private pauseLayer!: Phaser.GameObjects.Container;
  private keyPanel: KeyBindingsPanel | null = null;
  private desktop = false;
  private refreshHelpKeys!: (bindings: Readonly<KeyBindings>) => void;
  private introPending = false;
  private detailsLayer!: Phaser.GameObjects.Container;
  private setDetailsStartLabel!: (text: string) => void;
  private keysReturn: 'pause' | 'details' = 'pause'; // where the key panel's BACK goes
  private helpLayer!: Phaser.GameObjects.Container; // how to play (the i button)

  constructor() {
    super('Hud');
  }

  init(data: HudData) {
    this.hud = data;
    this.tactic = 'normal';
    this.tacticButtons = [];
    this.showDebug = false;
    this.introPending = false;
    this.keyPanel = null;
  }

  create() {
    this.desktop = window.matchMedia(
      '(pointer: fine) and (hover: hover)'
    ).matches;
    if (this.desktop) this.hud.controls.setKeyBindings(loadKeyBindings());
    this.joystick = new Joystick(this, this.hud.controls);
    this.actionButtons = new ActionButtons(this, this.hud.controls);
    // Never leave the player running (or a button held) if the app loses focus mid-touch.
    const release = () => this.releaseInputs();
    this.game.events.on(Phaser.Core.Events.BLUR, release);
    this.game.events.on(Phaser.Core.Events.HIDDEN, release);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, release);
      this.game.events.off(Phaser.Core.Events.HIDDEN, release);
    });

    this.buildScoreboard();
    this.tacticNotice = pixelText(this, VIEW.width / 2, 154, '', 3, PAL.yellow)
      .setOrigin(0.5)
      .setAlpha(0);
    for (const [i, mode] of (
      ['attack', 'normal', 'defend'] as const
    ).entries()) {
      const button = tacticButton(
        this,
        VIEW.width - 82,
        178 + i * 52,
        mode,
        this.tactic,
        () => this.selectTactic(mode)
      );
      this.tacticButtons.push({ mode, button });
    }
    this.minimap = new Minimap(this, chaosRules(this.hud.config).pitch);
    this.rampageFeedback = new RampageFeedback(this);
    this.livesText = pixelText(
      this,
      VIEW.width / 2 + 96,
      112,
      '',
      0.6 * PX,
      PAL.yellow
    )
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.missionText = pixelText(
      this,
      VIEW.width / 2,
      112,
      '',
      0.6 * PX,
      PAL.yellow
    ).setOrigin(0.5);

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

    this.goalCelebration = new GoalCelebration(this);

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
      () => this.setOverlay('details'),
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
      () => toggleSound(),
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
    const toggleSound = () => {
      setSoundMuted(this.sound, !soundMuted());
      drawSound();
    };
    drawSound();
    this.pauseLayer = this.buildPauseLayer().setVisible(false);
    const help = buildHelpLayer(this, () => this.setOverlay(null), {
      tactic: () => this.tactic,
      label: 'PLAY MATCH',
      back: () => this.setOverlay('details'),
      desktop: this.desktop,
    });
    this.helpLayer = help.layer.setVisible(false);
    this.refreshHelpKeys = help.refreshKeys;
    const details = buildMatchDetailsLayer(
      this,
      this.hud.config,
      currentPostType(),
      {
        // Straight into the match, skipping the how-to-play page.
        start: () => this.setOverlay(null, true),
        next: () => this.setOverlay('help'),
        ...(this.desktop
          ? { controls: () => this.openKeyBindings('details') }
          : {}),
      }
    );
    this.detailsLayer = details.layer.setVisible(false);
    this.setDetailsStartLabel = details.setStartLabel;
    this.listenForKeys(toggleSound);
    // First entry stays paused for match details, then how to play;
    // once per page load.
    if (this.registry.get('helpAtStart') === true) {
      this.registry.set('helpAtStart', false);
      this.introPending = true;
      this.setOverlay('details');
    }
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
    this.goldenText.setVisible(s.goldenGoal && !s.goalCelebration.active);

    const showMission = !s.goalCelebration.active;
    const showRampage = showMission && s.rampage !== null;
    this.missionText
      .setText(s.mission)
      .setPosition(VIEW.width / 2 - (s.rampage ? 96 : 0), 112)
      .setOrigin(s.rampage ? 1 : 0.5, 0.5)
      .setVisible(showMission);
    this.rampageFeedback.update(s.rampage, s.goalCelebration);
    this.livesText.setVisible(showRampage);
    if (s.rampage) {
      this.livesText.setText(`${s.rampage.lives} LIVES`);
    }
    this.goalCelebration.update(s.goalCelebration, this.hud.teams);
    const banner = s.banner === 'GOAL!' ? '' : s.banner.toUpperCase();
    this.bannerText.setText(banner).setScale(1);
    this.bannerShadow.setText(banner).setScale(1);

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
    return (
      this.keyPanel?.layer.visible ||
      this.pauseLayer.visible ||
      this.detailsLayer.visible ||
      this.helpLayer.visible
    );
  }

  private releaseInputs() {
    this.joystick.release();
    this.actionButtons.release();
    this.hud.controls.clearKeyboard();
    this.hud.onInputCancel();
  }

  private selectTactic(mode: MatchTactic) {
    if (this.overlayOpen() || mode === this.tactic) return;
    this.tactic = mode;
    this.hud.onTactic(mode);
    for (const entry of this.tacticButtons) {
      paintTacticButton(entry.button, entry.mode, mode);
    }
    this.tweens.killTweensOf(this.tacticNotice);
    this.tacticNotice
      .setText(`${mode.toUpperCase()} TACTICS`)
      .setPosition(VIEW.width / 2, 166)
      .setAlpha(1);
    this.tweens.add({
      targets: this.tacticNotice,
      y: 148,
      alpha: 0,
      duration: 1200,
      hold: 250,
    });
  }

  private listenForKeys(toggleSound: () => void) {
    const { controls } = this.hud;
    // The HUD stays active when the match is paused. Use physical key
    // codes to track both Shift keys and capture Tab before focus moves.
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing)
        return;
      if (!event.repeat && this.keyPanel?.capture(event.code)) {
        event.preventDefault();
        return;
      }
      const tactic =
        event.code === 'Digit8'
          ? 'defend'
          : event.code === 'Digit9'
            ? 'normal'
            : event.code === 'Digit0'
              ? 'attack'
              : null;
      if (tactic && !this.overlayOpen()) {
        event.preventDefault();
        if (!event.repeat) this.selectTactic(tactic);
        return;
      }
      const action = actionForKey(controls.keyBindings, event.code);
      if (!action) {
        if (
          !event.repeat &&
          event.code === 'Enter' &&
          (this.detailsLayer.visible || this.helpLayer.visible)
        ) {
          event.preventDefault();
          this.advanceInfo();
        }
        return;
      }
      event.preventDefault();
      if (event.repeat) return;
      if (action === 'pause') {
        this.setOverlay(
          this.keyPanel?.layer.visible
            ? this.keysReturn
            : this.overlayOpen()
              ? null
              : 'pause'
        );
      } else if (action === 'info') {
        if (!this.keyPanel?.layer.visible) this.advanceInfo();
      } else if (action === 'mute') {
        toggleSound();
      } else if (!this.overlayOpen()) {
        // Lob and curl keys are passes; the regular Pass key also tackles
        // or handles keeper actions when its on-screen button changes.
        if (
          (action === 'lob' ||
            action === 'passLeft' ||
            action === 'passRight') &&
          this.hud.state.buttons.b1 !== 'PASS'
        )
          return;
        controls.keyDown(event.code, action);
      }
    };
    const up = (event: KeyboardEvent) => controls.keyUp(event.code);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      controls.clearKeyboard();
    });
  }

  // Advance the two-page briefing without resuming between its pages.
  private advanceInfo() {
    if (this.detailsLayer.visible) this.setOverlay('help');
    else if (this.helpLayer.visible) this.setOverlay(null);
    else this.setOverlay('details');
  }

  // The key bindings panel, opened from the pause menu or match info; its
  // BACK returns there.
  private openKeyBindings(from: 'pause' | 'details') {
    this.keysReturn = from;
    this.keyPanel ??= new KeyBindingsPanel(this, this.hud.controls, () =>
      this.setOverlay(this.keysReturn)
    );
    this.setOverlay('keys');
  }

  // `skipIntro`: close the first-entry briefing from page 1 (START GAME)
  // without showing how to play first.
  private setOverlay(
    which: 'pause' | 'details' | 'help' | 'keys' | null,
    skipIntro = false
  ) {
    if (
      which === null &&
      this.introPending &&
      !this.helpLayer.visible &&
      !skipIntro
    )
      which = 'help';
    else if (which === null) {
      if (this.introPending) this.hud.onMatchStart();
      this.introPending = false;
    }
    if (which === 'details')
      this.setDetailsStartLabel(this.introPending ? 'START GAME' : 'RESUME');
    this.detailsLayer.setVisible(which === 'details');
    this.pauseLayer.setVisible(which === 'pause');
    this.helpLayer.setVisible(which === 'help');
    if (which === 'help') this.refreshHelpKeys(this.hud.controls.keyBindings);
    this.keyPanel?.setVisible(which === 'keys');
    const paused = which !== null;
    for (const { button } of this.tacticButtons)
      button.setVisible(!paused).setEnabled(!paused);
    this.tacticNotice.setVisible(!paused);
    this.joystick.enabled = !paused;
    this.actionButtons.enabled = !paused;
    if (paused) {
      this.releaseInputs();
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
      this.desktop ? 330 : 360,
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
      this.desktop ? 530 : 470,
      'QUIT',
      () => {
        this.hud.onMatchQuit();
        this.scene.stop('Match');
        this.scene.start(
          this.registry.get('activeMode') === 'casual' ? 'Casual' : 'Menu'
        );
      },
      { width: 320, fill: PAL.red }
    );
    const items = [dim, title, resume, quit];
    if (this.desktop)
      items.push(
        new TextButton(
          this,
          cx,
          430,
          'KEY BINDINGS',
          () => this.openKeyBindings('pause'),
          { width: 320, fill: PAL.blue, textSize: PX * 0.75 }
        )
      );
    return this.add.container(0, 0, items).setDepth(10);
  }
}
