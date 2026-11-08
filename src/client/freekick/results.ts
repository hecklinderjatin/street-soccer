import {
  context,
  exitExpandedMode,
  showForm,
  showToast,
} from '@devvit/web/client';
import type { FreeKickStats } from '../../shared/freeKick';
import { pixelLabel } from '../ui/pixelLabel';
import type { FreeKickRecords } from './records';
import { freeKickLeaderboard } from './leaderboard';

export function freeKickResults(
  stats: FreeKickStats,
  best: number,
  records: FreeKickRecords,
  again: () => void
) {
  const root = document.createElement('section');
  root.className = 'fk-results';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Free Kick run results');
  const panel = document.createElement('div');
  panel.className = 'fk-results-panel';
  root.append(panel);
  panel.innerHTML =
    '<span class="mobile-match-tag">FREE KICK</span><h1>RUN COMPLETE</h1><div class="fk-results-score"></div><p class="fk-results-best"></p><div class="fk-results-stats"></div><div class="fk-results-actions"></div><p class="fk-results-status" role="status"></p>';
  const score = panel.querySelector<HTMLElement>('.fk-results-score'),
    bestLabel = panel.querySelector('.fk-results-best'),
    grid = panel.querySelector('.fk-results-stats'),
    actions = panel.querySelector('.fk-results-actions'),
    status = panel.querySelector('.fk-results-status');
  if (score) pixelLabel(score, `${stats.score} POINTS`);
  if (bestLabel)
    bestLabel.textContent =
      stats.score > best ? 'NEW DEVICE BEST!' : `DEVICE BEST: ${best}`;
  for (const [label, value] of [
    ['GOALS', stats.goals],
    ['SHOTS', stats.shots],
    ['LEVEL', stats.level],
    ['BEST STREAK', stats.bestStreak],
    [
      'ACCURACY',
      `${Math.round((stats.goals / Math.max(1, stats.shots)) * 100)}%`,
    ],
    ['FASTEST GOAL', `${stats.fastestGoalKmh} KM/H`],
  ]) {
    const tile = document.createElement('div'),
      caption = document.createElement('small'),
      number = document.createElement('strong');
    caption.textContent = String(label);
    number.textContent = String(value);
    tile.append(caption, number);
    grid?.append(tile);
  }
  const button = (label: string, callback: (event: MouseEvent) => void) => {
    const node = document.createElement('button');
    node.type = 'button';
    pixelLabel(node, label);
    node.addEventListener('click', callback);
    actions?.append(node);
    return node;
  };
  button('PLAY AGAIN', again);
  const post = button('POST MY SCORE', () => {
    void share();
  });
  post.disabled = true;
  const exit = document.createElement('a');
  exit.href = 'splash.html';
  pixelLabel(exit, 'EXIT');
  exit.addEventListener('click', (event) => {
    if (context?.postId) {
      event.preventDefault();
      exitExpandedMode(event);
    }
  });
  actions?.append(exit);
  const board = freeKickLeaderboard();
  panel.append(board.root);
  let saved = false,
    posted = false,
    posting = false,
    closed = false;
  const save = async () => {
    if (status) status.textContent = 'Saving run...';
    try {
      await records.save(stats);
      if (closed) return;
      saved = true;
      post.disabled = false;
      if (status) status.textContent = 'Run saved. Sharing is optional.';
      retry.hidden = true;
      await board.refresh();
    } catch (error) {
      if (!closed && status)
        status.textContent =
          error instanceof Error ? error.message : 'Could not save run';
      retry.hidden = false;
    }
  };
  const retry = button('RETRY SAVE', () => {
    void save();
  });
  retry.hidden = true;
  async function share() {
    if (!saved || posted || posting || closed) return;
    posting = true;
    try {
      const form = await showForm({
        title: 'Post my Free Kick score',
        description: `Posts from your Reddit account, u/${context.username ?? 'you'}, visible with your username. Score only replies to the pinned Scores comment; adding your own words creates a comment on the post.`,
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
            label: 'Include my Free Kick score and run details',
            defaultValue: true,
          },
        ],
      });
      if (form.action !== 'SUBMITTED' || closed) return;
      post.disabled = true;
      pixelLabel(post, 'POSTING...');
      await records.post(
        form.values.comment ?? '',
        form.values.includeStats === true
      );
      posted = true;
      pixelLabel(post, 'POSTED');
      post.disabled = true;
      showToast('Score posted!');
    } catch (error) {
      if (!closed) {
        post.disabled = false;
        pixelLabel(post, 'POST MY SCORE');
      }
      showToast(
        error instanceof Error ? error.message : 'Could not post score'
      );
    } finally {
      posting = false;
    }
  }
  document.getElementById('freekick')?.append(root);
  void save();
  return {
    destroy() {
      closed = true;
      board.destroy();
      root.remove();
    },
  };
}
