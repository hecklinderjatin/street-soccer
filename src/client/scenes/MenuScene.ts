import Phaser from 'phaser';
import { context, requestExpandedMode } from '@devvit/web/client';
import type { DailyLeadersResponse } from '../../shared/api';
import { formatClock } from '../../shared/matchConfig';
import {
  DIFFICULTIES,
  type Difficulty,
  type MatchConfig,
} from '../../shared/types';
import { postChallenge, startingConfig } from '../challenge';
import { JERSEY_SWATCH, PAL } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';
import { createMobileLobby } from '../ui/mobileLobby';
import { addStreetBackdrop } from '../ui/backdrop';

const PLAY = { x: 256, y: 435, w: 448, h: 66 };

// Viewing the lobby never records a result. Match runs as a silent AI demo.
export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = 'normal';
  private config!: MatchConfig;
  private board!: Phaser.GameObjects.Container;
  private mobileLobby: ReturnType<typeof createMobileLobby> | null = null;

  constructor() {
    super('Menu');
  }

  create() {
    this.config = startingConfig();
    this.difficulty = this.config.difficulty;
    this.board = this.add.container(0, 0).setDepth(2);
    const inline = this.registry.get('inline') === true;
    const challenge = postChallenge();
    this.mobileLobby = createMobileLobby(
      this.config,
      challenge?.description ?? '',
      (event) => {
        if (inline && context?.postId) requestExpandedMode(event, 'game');
        else this.play();
      },
      () => {
        void this.mobileLobby?.showBoard(Boolean(context?.postId));
      }
    );
    document.body.append(this.mobileLobby.element);
    const responsiveLayout = () => {
      const portrait =
        window.innerWidth < 700 && window.innerHeight > window.innerWidth;
      this.registry.set('mobileLobby', portrait);
      this.mobileLobby?.element.classList.toggle('is-portrait', portrait);
      this.cameras.main.setVisible(!portrait);
      const camera = this.scene.get('Match').cameras?.main;
      if (camera) {
        if (portrait)
          camera.setViewport(0, 0, 1280, 720).setZoom(1).centerOn(640, 360);
        else
          camera.setViewport(528, 0, 752, 720).setZoom(0.92).centerOn(640, 360);
      }
      this.game.events.emit('layout-mode');
    };
    responsiveLayout();
    window.addEventListener('resize', responsiveLayout);
    const text = (
      x: number,
      y: number,
      value: string,
      size = 2,
      color: number = PAL.white
    ) => pixelText(this, x, y, value, size, color).setOrigin(0, 0.5);
    addStreetBackdrop(this).setCrop(0, 0, 528, 720);
    this.add.rectangle(264, 360, 528, 720, PAL.black, 0.8);
    this.add.rectangle(526, 360, 4, 720, PAL.yellow);
    text(32, 45, 'STREET', 5, PAL.yellow);
    text(32, 100, 'SOCCER', 5);
    text(
      34,
      149,
      this.config.locked ? 'COMMUNITY CHALLENGE' : 'QUICK MATCH',
      1.8,
      PAL.yellow
    );
    this.add.rectangle(256, 244, 448, 152, PAL.black, 0.6);
    const team = (side: 'home' | 'away', y: number) => {
      const setup = this.config[side];
      this.add.rectangle(54, y, 12, 28, JERSEY_SWATCH[setup.jersey]);
      text(75, y, setup.name, 2.5);
      pixelText(this, 460, y, setup.formation, 1.8, PAL.lightGray).setOrigin(
        1,
        0.5
      );
    };
    team('home', 200);
    text(75, 227, 'VS', 1.5, PAL.lightGray);
    team('away', 254);
    text(
      48,
      293,
      `${formatClock(this.config.durationSec)}  /  START 0-${this.config.startGoalsAgainst}`,
      2,
      PAL.yellow
    );
    const description =
      challenge?.description || 'OUTPLAY THE OPPOSITION. OWN THE STREET.';
    const lines =
      description.toUpperCase().match(/.{1,30}(?:\s|$)|.{1,30}/g) ?? [];
    lines
      .slice(0, 2)
      .forEach((line, i) =>
        text(34, 340 + i * 22, line.trim(), 1.8, PAL.lightGray)
      );
    if (!this.config.locked && !inline) {
      const buttons = DIFFICULTIES.map(
        (difficulty, i) =>
          new TextButton(
            this,
            104 + i * 152,
            386,
            difficulty,
            () => {
              this.difficulty = difficulty;
              this.mobileLobby?.setDifficulty(difficulty);
              buttons.forEach((button, j) =>
                button.setFill(
                  DIFFICULTIES[j] === difficulty ? PAL.orange : PAL.darkGray
                )
              );
              this.restartDemo();
            },
            {
              width: 140,
              height: 36,
              textSize: 1.8,
              fill: difficulty === this.difficulty ? PAL.orange : PAL.darkGray,
            }
          )
      );
    } else
      text(
        34,
        385,
        `${this.config.difficulty.toUpperCase()} AI  /  FIXED MATCH RULES`,
        1.8,
        PAL.lightGray
      );
    new TextButton(
      this,
      PLAY.x,
      PLAY.y,
      'PLAY MATCH',
      () => {
        if (!inline || !context?.postId) this.play();
      },
      { width: PLAY.w, height: PLAY.h, textSize: 3, fill: PAL.orange }
    );
    text(34, 502, "TODAY'S LEADERBOARD", 2.3, PAL.yellow);
    new TextButton(
      this,
      425,
      500,
      'MORE',
      () => {
        void this.openBoard();
      },
      {
        width: 100,
        height: 32,
        textSize: 1.6,
        fill: PAL.darkGray,
      }
    );
    text(34, 528, 'BEST MATCH PER PLAYER / THIS POST', 1.45, PAL.lightGray);
    this.board.add(
      text(
        34,
        575,
        context?.postId ? 'LOADING SCORES...' : 'PLAY ON REDDIT TO RANK',
        1.8,
        PAL.lightGray
      )
    );
    void this.fillBoard();
    const timer = this.time.addEvent({
      delay: 30000,
      loop: true,
      callback: () => {
        void this.fillBoard();
      },
    });
    this.add.rectangle(904, 43, 700, 48, PAL.black, 0.75);
    this.add.rectangle(561, 43, 8, 8, PAL.green);
    text(578, 43, 'LIVE MATCH PREVIEW', 2);
    this.add.rectangle(904, 668, 704, 50, PAL.black, 0.7);
    const demoScore = pixelText(
      this,
      904,
      668,
      'WARMING UP THE PITCH...',
      2,
      PAL.white
    ).setOrigin(0.5);
    text(
      560,
      710,
      'AI VS AI / PREVIEW DOES NOT COUNT TOWARD SCORES',
      1.4,
      PAL.lightGray
    );
    const demo = this.scene.get('Match');
    const updateScore = (
      home: number,
      away: number,
      clock: number,
      banner: string
    ) => {
      demoScore.setText(
        `${this.config.home.name} ${home} - ${away} ${this.config.away.name}  ${formatClock(Math.ceil(clock))}${banner === 'GOAL!' ? '  GOAL!' : ''}`
      );
      demoScore.setScale(1);
      if (demoScore.width > 660) demoScore.setScale(660 / demoScore.width);
    };
    demo.events.on('demo-score', updateScore);
    this.scene.launch('Match', { ...this.matchConfig(), demo: true });
    this.scene.bringToTop();
    // Expansion requires the original browser click, including touch-generated clicks.
    const expand = (event: MouseEvent) => {
      const pointer = this.input.activePointer;
      if (
        Math.abs(pointer.x - PLAY.x) <= PLAY.w / 2 &&
        Math.abs(pointer.y - PLAY.y) <= PLAY.h / 2
      )
        requestExpandedMode(event, 'game');
    };
    if (inline && context?.postId)
      this.game.canvas.addEventListener('click', expand);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('resize', responsiveLayout);
      this.mobileLobby?.element.remove();
      this.mobileLobby = null;
      this.registry.set('mobileLobby', false);
      this.game.events.emit('layout-mode');
      timer.remove();
      demo.events.off('demo-score', updateScore);
      this.game.canvas.removeEventListener('click', expand);
    });
  }

  private matchConfig() {
    return { ...this.config, difficulty: this.difficulty };
  }

  private restartDemo() {
    this.scene.stop('Match');
    this.scene.launch('Match', { ...this.matchConfig(), demo: true });
    this.scene.bringToTop();
  }

  private play() {
    this.scene.stop('Match');
    this.scene.start('Match', this.matchConfig());
  }

  private async openBoard() {
    const overlay = this.add.container(0, 0).setDepth(20);
    overlay.add(
      this.add.rectangle(640, 360, 1280, 720, PAL.black, 0.85).setInteractive()
    );
    overlay.add(
      this.add
        .rectangle(640, 360, 920, 648, PAL.navy)
        .setStrokeStyle(4, PAL.yellow)
    );
    overlay.add(pixelText(this, 230, 83, "TODAY'S LEADERBOARD", 3, PAL.yellow));
    overlay.add(
      new TextButton(this, 1040, 80, 'X', () => overlay.destroy(), {
        width: 48,
        height: 40,
        textSize: 2,
        fill: PAL.darkGray,
      })
    );
    const rows = this.add.container(0, 0);
    overlay.add(rows);
    rows.add(
      pixelText(
        this,
        230,
        160,
        context?.postId ? 'LOADING...' : 'LEADERBOARD AVAILABLE ON REDDIT',
        2,
        PAL.lightGray
      )
    );
    if (!context?.postId) return;
    try {
      const res = await fetch('/api/daily-leaders?limit=25');
      if (!res.ok) throw new Error('Leaderboard unavailable');
      const data: DailyLeadersResponse = await res.json();
      if (!overlay.active) return;
      let page = 0;
      const draw = () => {
        rows.removeAll(true);
        rows.add(
          pixelText(
            this,
            230,
            133,
            'RANK / PLAYER                            RESULT',
            1.8,
            PAL.lightGray
          )
        );
        const leaders = data.top.slice(page * 8, page * 8 + 8);
        if (!leaders.length)
          rows.add(
            pixelText(
              this,
              230,
              205,
              'NO SCORES YET. SET THE FIRST!',
              2,
              PAL.lightGray
            )
          );
        leaders.forEach((leader, i) => {
          rows.add(
            pixelText(
              this,
              230,
              185 + i * 46,
              `${leader.rank}. ${leader.username.slice(0, 22)}`,
              2.3,
              leader.rank === 1 ? PAL.yellow : PAL.white
            )
          );
          rows.add(
            pixelText(
              this,
              1040,
              185 + i * 46,
              `${leader.goalsFor}-${leader.goalsAgainst}`,
              2.3,
              PAL.green
            ).setOrigin(1, 0)
          );
        });
        rows.add(
          pixelText(
            this,
            230,
            585,
            data.me
              ? `YOUR BEST: #${data.me.rank}  ${data.me.goalsFor}-${data.me.goalsAgainst}`
              : 'YOU: NOT PLAYED TODAY',
            2,
            PAL.lightGray
          )
        );
        if (page > 0)
          rows.add(
            new TextButton(
              this,
              300,
              640,
              'PREV',
              () => {
                page--;
                draw();
              },
              { width: 140, height: 40, textSize: 2 }
            )
          );
        if ((page + 1) * 8 < data.top.length)
          rows.add(
            new TextButton(
              this,
              980,
              640,
              'NEXT',
              () => {
                page++;
                draw();
              },
              { width: 140, height: 40, textSize: 2 }
            )
          );
      };
      draw();
    } catch {
      if (!overlay.active) return;
      rows.removeAll(true);
      rows.add(
        pixelText(
          this,
          230,
          160,
          'SCORES UNAVAILABLE. PLEASE TRY AGAIN.',
          2,
          PAL.lightGray
        )
      );
    }
  }

  private async fillBoard() {
    if (!context?.postId) return;
    try {
      const res = await fetch('/api/daily-leaders');
      if (!res.ok) throw new Error('Leaderboard unavailable');
      const data: DailyLeadersResponse = await res.json();
      if (!this.scene.isActive()) return;
      this.mobileLobby?.setBoard(data);
      this.board.removeAll(true);
      if (!data.top.length)
        this.board.add(
          pixelText(
            this,
            34,
            574,
            'NO SCORES YET. SET THE FIRST!',
            1.8,
            PAL.lightGray
          )
        );
      else
        data.top.forEach((leader, i) => {
          const y = 570 + i * 34;
          this.board.add(
            pixelText(
              this,
              34,
              y,
              `${leader.rank}. ${leader.username.slice(0, 16)}`,
              1.9,
              i === 0 ? PAL.yellow : PAL.white
            )
          );
          this.board.add(
            pixelText(
              this,
              473,
              y,
              `${leader.goalsFor}-${leader.goalsAgainst}`,
              2,
              PAL.green
            ).setOrigin(1, 0)
          );
        });
      this.board.add(
        pixelText(
          this,
          34,
          683,
          data.me
            ? `YOUR BEST: #${data.me.rank}  ${data.me.goalsFor}-${data.me.goalsAgainst}`
            : 'YOU: NOT PLAYED TODAY',
          1.8,
          PAL.lightGray
        ).setOrigin(0, 0.5)
      );
    } catch {
      if (!this.scene.isActive()) return;
      this.mobileLobby?.setBoard('Scores unavailable. Try again soon.');
      this.board.removeAll(true);
      this.board.add(
        pixelText(
          this,
          34,
          575,
          'SCORES UNAVAILABLE. TRY AGAIN SOON.',
          1.7,
          PAL.lightGray
        )
      );
    }
  }
}
