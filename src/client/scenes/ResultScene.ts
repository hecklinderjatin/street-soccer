import Phaser from 'phaser';
import {
  context,
  exitExpandedMode,
  showForm,
  showToast,
} from '@devvit/web/client';
import type {
  DailyLeadersResponse,
  MatchStats,
  PostScoreRequest,
} from '../../shared/api';
import { type MatchResult } from '../../shared/types';
import { currentPostType } from '../challenge';
import { casualButton } from '../ui/casualScreen';
import { resultsScreen } from '../ui/resultsScreen';
import { pixelLabel } from '../ui/pixelLabel';

// Daily/Classic results save the ranked match once and offer score sharing.
// Casual results stay unranked. Both use the same responsive results card.

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
    const r = this.result;
    const screen = resultsScreen(r, currentPostType());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => screen.destroy());
    if (r.config.mode === 'casual') {
      screen.actions.append(
        casualButton('REMATCH', () => this.scene.start('Match', r.config)),
        casualButton('CHANGE SETTINGS', () => this.scene.start('Casual'), true),
        casualButton(
          'EXIT',
          (event) => {
            if (context?.postId) exitExpandedMode(event);
            else this.scene.start('Menu');
          },
          true
        )
      );
      return;
    }
    const post = casualButton(
      'POST MY SCORE',
      () => void this.postScore(post),
      true
    );
    screen.actions.append(
      casualButton('PLAY AGAIN', () => this.scene.start('Match', r.config)),
      post,
      casualButton('PLAY CASUAL', () => this.scene.start('Casual'), true)
    );
    void this.saveResult(screen.fillBoard);
  }

  private stats(): MatchStats {
    const r = this.result;
    return {
      mode: r.config.mode ?? 'competitive',
      difficulty: r.config.difficulty,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      shots: r.shots,
      passes: r.passes,
      tacklesWon: r.tacklesWon,
    };
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
  private async postScore(button: HTMLButtonElement) {
    if (this.posted || !button.isConnected) return;
    const result = this.result;
    // Outside Reddit (local preview) there is no popup to open.
    if (!context?.postId) {
      pixelLabel(button, 'ONLY ON REDDIT');
      return;
    }
    let form;
    try {
      form = await showForm({
        title: 'Post my score',
        // Devvit Rules: clear that it posts from the player's own account,
        // what appears and where.
        description:
          `Posts a comment on this post from your Reddit account, ` +
          `u/${context.username ?? 'you'}: everyone can see it with your ` +
          `username. Score only: a reply in the pinned Scores comment. ` +
          `With your own words: a comment on the post.`,
        acceptLabel: `Post as u/${context.username ?? 'me'}`,
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
      if (this.alive) pixelLabel(button, 'ONLY ON REDDIT');
      return;
    }
    if (
      form.action !== 'SUBMITTED' ||
      !this.alive ||
      !button.isConnected ||
      this.result !== result
    )
      return;

    const request: PostScoreRequest = {
      comment: form.values.comment ?? '',
      includeStats: form.values.includeStats,
      result: this.stats(),
    };
    button.disabled = true;
    pixelLabel(button, 'POSTING...');
    let error = 'Could not post your score';
    try {
      const res = await fetch('/api/post-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (res.ok) {
        if (this.result === result) this.posted = true;
        showToast({ text: 'Score posted!', appearance: 'success' });
        if (this.alive && button.isConnected) pixelLabel(button, 'POSTED!');
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
    if (!this.alive || !button.isConnected) return;
    button.disabled = false;
    pixelLabel(button, 'POST MY SCORE');
  }
}
