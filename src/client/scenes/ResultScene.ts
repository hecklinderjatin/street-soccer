import Phaser from 'phaser';
import { context, showForm, showToast } from '@devvit/web/client';
import type {
  DailyLeader,
  DailyLeadersResponse,
  MatchStats,
  PostScoreRequest,
} from '../../shared/api';
import { VIEW } from '../../shared/tuning';
import type { MatchResult } from '../../shared/types';
import { addStreetBackdrop } from '../ui/backdrop';
import { PAL, PX } from '../ui/palette';
import { pixelText } from '../ui/pixelFont';
import { TextButton } from '../ui/TextButton';

// Full time: the score and stats, today's top 3 on this post (the result
// is saved first, POST /api/result: each player's best match of the UTC
// day), PLAY AGAIN (same settings) and POST MY SCORE: a Reddit popup with a
// comment box and a "share my score and stats" box that posts a comment on
// the post. Outside Reddit (local preview) there is no server: the board
// says so and posting is unavailable.

const PANEL = { y: 300, w: 760, h: 180 }; // today's top 3, centred
const ROW_Y = [370, 408, 446];

const outcome = (s: MatchStats) =>
  s.goalsFor > s.goalsAgainst ? 'W' : s.goalsFor < s.goalsAgainst ? 'L' : 'D';

export class ResultScene extends Phaser.Scene {
  private result!: MatchResult;
  private alive = false; // false once the scene has left (late replies are ignored)
  private posted = false;

  constructor() {
    super('Result');
  }

  init(data: MatchResult) {
    this.result = data;
    this.posted = false;
  }

  create() {
    this.alive = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));
    const cx = VIEW.width / 2;
    const r = this.result;
    const won = r.goalsFor > r.goalsAgainst;
    const lost = r.goalsFor < r.goalsAgainst;
    const headline = won ? 'YOU WIN!' : lost ? 'YOU LOSE' : 'DRAW';
    const color = won ? PAL.green : lost ? PAL.red : PAL.yellow;

    addStreetBackdrop(this);

    pixelText(
      this,
      cx + 2 * PX,
      92 + 2 * PX,
      headline,
      2.5 * PX,
      PAL.black
    ).setOrigin(0.5);
    pixelText(this, cx, 92, headline, 2.5 * PX, color).setOrigin(0.5);
    pixelText(
      this,
      cx,
      190,
      `${r.config.home.name} ${r.goalsFor} - ${r.goalsAgainst} ${r.config.away.name}`,
      1.5 * PX
    ).setOrigin(0.5);
    pixelText(
      this,
      cx,
      250,
      `VS ${r.config.difficulty} AI | SHOTS ${r.shots} | PASSES ${r.passes} | TACKLES ${r.tacklesWon}`,
      0.75 * PX
    ).setOrigin(0.5);

    const board = this.buildBoard();

    new TextButton(
      this,
      cx - 176,
      600,
      'PLAY AGAIN',
      () => this.scene.start('Match', r.config), // the same match, settings and all
      { width: 320, fill: PAL.green }
    );
    const post: TextButton = new TextButton(
      this,
      cx + 176,
      600,
      'POST MY SCORE',
      () => void this.postScore(post),
      { width: 320, fill: PAL.blue, textSize: 0.75 * PX }
    );

    void this.saveResult(board);
  }

  private stats(): MatchStats {
    const r = this.result;
    return {
      difficulty: r.config.difficulty,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      shots: r.shots,
      passes: r.passes,
      tacklesWon: r.tacklesWon,
    };
  }

  // The panel and its status line; returns a function that fills it.
  private buildBoard() {
    const cx = VIEW.width / 2;
    this.add
      .rectangle(cx, PANEL.y + PANEL.h / 2, PANEL.w, PANEL.h, PAL.black, 0.92)
      .setStrokeStyle(4, PAL.black);
    pixelText(
      this,
      cx,
      PANEL.y + 28,
      "TODAY'S TOP 3",
      PX,
      PAL.yellow
    ).setOrigin(0.5);
    const status = pixelText(
      this,
      cx,
      408,
      'LOADING...',
      0.75 * PX,
      PAL.lightGray
    ).setOrigin(0.5);
    return (board: DailyLeadersResponse | string) => {
      if (typeof board === 'string') {
        status.setText(board);
        return;
      }
      if (board.top.length === 0) {
        status.setText('NO SCORES YET TODAY');
        return;
      }
      status.setVisible(false);
      board.top.forEach((l, i) => this.leaderRow(l, ROW_Y[i] ?? 0));
      // Not in the top 3: your own best under the panel.
      const me = board.me;
      if (me && !board.top.some((l) => l.username === me.username))
        pixelText(
          this,
          cx,
          PANEL.y + PANEL.h + 22,
          `YOUR BEST: RANK ${me.rank}  ${me.goalsFor}-${me.goalsAgainst}`,
          0.75 * PX,
          PAL.lightGray
        ).setOrigin(0.5);
    };
  }

  // "1  U/NAME ............ 3-1 W  5 SHOTS" (names cut to fit the column)
  private leaderRow(l: DailyLeader, y: number) {
    const left = VIEW.width / 2 - PANEL.w / 2 + 32;
    const right = VIEW.width / 2 + PANEL.w / 2 - 32;
    const color = l.rank === 1 ? PAL.yellow : PAL.white;
    pixelText(this, left, y, `${l.rank}`, 0.75 * PX, color).setOrigin(0, 0.5);
    const name =
      l.username.length > 13 ? `${l.username.slice(0, 12)}.` : l.username;
    pixelText(this, left + 40, y, `u/${name}`, 0.75 * PX, color).setOrigin(
      0,
      0.5
    );
    pixelText(
      this,
      right,
      y,
      `${l.goalsFor}-${l.goalsAgainst} ${outcome(l)}  ${l.shots} SHOTS`,
      0.75 * PX,
      PAL.lightGray
    ).setOrigin(1, 0.5);
  }

  // Saves this match (the server keeps it if it is your best today) and
  // shows the board it returns.
  private async saveResult(
    fill: (board: DailyLeadersResponse | string) => void
  ) {
    let board: DailyLeadersResponse | string;
    try {
      const res = await fetch('/api/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.stats()),
      });
      board = res.ok ? await res.json() : 'LEADERBOARD ONLY ON REDDIT';
    } catch {
      board = 'LEADERBOARD ONLY ON REDDIT';
    }
    if (this.alive) fill(board);
  }

  // The Reddit popup: a comment and whether to add the score and stats.
  private async postScore(button: TextButton) {
    if (this.posted) return;
    // Outside Reddit (local preview) there is no popup to open.
    if (!context?.postId) {
      button.setLabel('ONLY ON REDDIT');
      return;
    }
    let form;
    try {
      form = await showForm({
        title: 'Post my score',
        description: 'Adds a comment to this post.',
        acceptLabel: 'Post',
        fields: [
          {
            type: 'paragraph',
            name: 'comment',
            label: 'Your comment',
            helpText: 'Up to 1000 characters',
          },
          {
            type: 'boolean',
            name: 'includeStats',
            label: 'Share my score and match stats',
            defaultValue: true,
          },
        ],
      });
    } catch {
      // No Reddit client around (local preview).
      if (this.alive) button.setLabel('ONLY ON REDDIT');
      return;
    }
    if (form.action !== 'SUBMITTED' || !this.alive) return;

    const request: PostScoreRequest = {
      comment: form.values.comment ?? '',
      includeStats: form.values.includeStats,
      result: this.stats(),
    };
    button.setEnabled(false);
    button.setLabel('POSTING...');
    let error = 'Could not post your score';
    try {
      const res = await fetch('/api/post-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (res.ok) {
        this.posted = true;
        showToast({ text: 'Score posted!', appearance: 'success' });
        if (this.alive) button.setLabel('POSTED!');
        return;
      }
      const body: unknown = await res.json();
      const message =
        typeof body === 'object' && body !== null
          ? Reflect.get(body, 'error')
          : null;
      if (typeof message === 'string') error = message;
    } catch {
      // keep the generic message
    }
    showToast(error);
    if (!this.alive) return;
    button.setEnabled(true);
    button.setLabel('POST MY SCORE');
  }
}
