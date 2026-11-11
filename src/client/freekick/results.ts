import { communityJoin } from '../ui/communityJoin';
import {
  context,
  exitExpandedMode,
  showForm,
  showToast,
} from '@devvit/web/client';
import type { FreeKickStats } from '../../shared/freeKick';
import type { FreeKickChallengeConfig } from '../../shared/freeKickChallenge';
import { DIFFICULTY_LABEL } from '../../shared/types';
import { casualButton, casualScreen } from '../ui/casualScreen';
import { css } from '../ui/menuCard';
import { PAL } from '../ui/palette';
import { pixelLabel } from '../ui/pixelLabel';
import type { FreeKickRecords } from './records';
import { freeKickResultsBoard } from './leaderboard';

// The run summary, built as the normal match's full-time card
// (ui/resultsScreen.ts, style.css .results-*): mode tag, hero title, the
// score where the scoreboard goes, a row of stat tiles, the fastest-goal
// line, the seven-day board with its category tabs, then PLAY AGAIN (full
// width), POST MY SCORE and EXIT. One column in portrait. A challenge
// shows whether it was won, the post settings and its points. Both run
// types save records and show boards; challenge sharing stays disabled.
export function freeKickResults(
  stats: FreeKickStats,
  best: number,
  records: FreeKickRecords,
  again: () => void,
  challenge?: { won: boolean; config: FreeKickChallengeConfig }
) {
  const newBest = !challenge && stats.score > best;
  const screen = casualScreen(
    challenge
      ? challenge.won
        ? 'CHALLENGE COMPLETE'
        : 'CHALLENGE FAILED'
      : 'RUN COMPLETE',
    challenge
      ? `${challenge.config.goals} GOALS · ${challenge.config.lives} ${challenge.config.lives === 1 ? 'LIFE' : 'LIVES'} · ${challenge.config.distanceM} M · ${DIFFICULTY_LABEL[challenge.config.difficulty]}`
      : `RANKED RUN · LEVEL ${stats.level}`,
    false,
    {
      compactBelow: 700,
      minimalBelow: 640,
    }
  );
  screen.element.classList.add('results-screen', 'fk-results-screen');
  screen.element.setAttribute('role', 'dialog');
  screen.panel.classList.add('results-panel');
  screen.panel.dataset.mode = 'ranked';
  screen.panel.style.setProperty(
    '--outcome',
    css(
      challenge
        ? challenge.won
          ? PAL.green
          : PAL.red
        : newBest
          ? PAL.green
          : PAL.yellow
    )
  );

  const header = document.createElement('header');
  header.className = 'results-header';
  const mode = document.createElement('span');
  mode.className = 'results-mode';
  pixelLabel(mode, 'FREE KICK');
  const over = document.createElement('span');
  over.textContent = challenge ? 'CHALLENGE' : 'RUN OVER';
  header.append(mode, over);

  const content = document.createElement('div');
  content.className = 'results-content';
  const summary = document.createElement('div');
  summary.className = 'results-summary';
  const hero = document.createElement('div');
  hero.className = 'results-hero';
  hero.append(screen.heading, screen.description);
  summary.append(hero);

  // The score in the scoreboard's place: one block, with the device best.
  const scoreboard = document.createElement('div');
  scoreboard.className = 'results-scoreboard fk-results-scoreboard';
  scoreboard.setAttribute('role', 'group');
  scoreboard.setAttribute('aria-label', `${stats.score} points`);
  const block = document.createElement('div');
  block.className = 'results-team';
  block.style.setProperty('--kit', css(PAL.orange));
  const label = document.createElement('strong');
  label.className = 'results-team-name';
  pixelLabel(label, 'POINTS');
  const bestLine = document.createElement('span');
  bestLine.className = 'results-formation';
  bestLine.textContent = challenge
    ? `GOALS ${stats.goals}/${challenge.config.goals}`
    : newBest
      ? 'NEW DEVICE BEST!'
      : `DEVICE BEST: ${best.toLocaleString()}`;
  const points = document.createElement('strong');
  points.className = 'results-goals';
  pixelLabel(points, stats.score.toLocaleString());
  block.append(label, bestLine, points);
  scoreboard.append(block);
  summary.append(scoreboard);

  // Goals against expected goals: finishing above (+) or below (-) the
  // average kicker from the same spots.
  const xg = stats.xg / 100;
  const finishing = stats.goals - xg;
  const tiles = document.createElement('div');
  tiles.className = 'results-stats';
  for (const [caption, value] of [
    ['GOALS', `${stats.goals}/${challenge?.config.goals ?? stats.shots}`],
    ['XG', xg.toFixed(1)],
    ['FINISHING', `${finishing >= 0 ? '+' : ''}${finishing.toFixed(1)}`],
    ['GREAT SAVES', String(stats.greatSaves)],
    ['BEST STREAK', String(stats.bestStreak)],
    ['LEVEL', String(stats.level)],
  ]) {
    // A challenge has no great saves (every miss costs a life).
    const tileCaption =
      challenge && caption === 'GREAT SAVES' ? 'SHOTS' : caption;
    const tileValue =
      challenge && caption === 'GREAT SAVES' ? String(stats.shots) : value;
    const item = document.createElement('div');
    const number = document.createElement('strong');
    pixelLabel(number, tileValue ?? '');
    const text = document.createElement('span');
    text.textContent = tileCaption ?? '';
    item.append(number, text);
    tiles.append(item);
  }
  summary.append(tiles);
  if (stats.fastestGoalKmh) {
    const highlight = document.createElement('p');
    highlight.className = 'results-speed-highlight';
    highlight.textContent = `FASTEST GOAL ${stats.fastestGoalKmh} KM/H`;
    summary.append(highlight);
  }
  content.append(summary);
  const board = freeKickResultsBoard();
  if (board) content.append(board.root);

  const actions = document.createElement('div');
  actions.className = 'results-actions';
  const status = document.createElement('p');
  status.className = 'results-board-status fk-results-status';
  status.setAttribute('role', 'status');
  screen.panel.append(header, content, actions, status);

  const post = casualButton('POST MY SCORE', () => void share(), true);
  post.disabled = true;
  const retry = casualButton('RETRY SAVE', () => void save(), true);
  retry.hidden = true;
  // EXIT leaves the expanded view with the trusted click on Reddit; off
  // Reddit it goes back to the feed card page.
  const exit = document.createElement('a');
  exit.className = 'casual-button secondary';
  exit.href = 'splash.html';
  pixelLabel(exit, 'EXIT');
  exit.addEventListener('click', (event) => {
    if (context?.postId) {
      event.preventDefault();
      exitExpandedMode(event);
    }
  });
  actions.append(
    casualButton('PLAY AGAIN', again),
    ...(challenge ? [] : [post]),
    exit,
    retry
  );

  let saved = false,
    posted = false,
    posting = false,
    closed = false;
  async function save() {
    status.textContent = 'Saving run...';
    try {
      await records.save(stats);
      if (closed) return;
      saved = true;
      post.disabled = false;
      status.textContent = challenge
        ? 'Run saved. Leaderboards updated.'
        : 'Run saved. Sharing is optional.';
      retry.hidden = true;
    } catch (error) {
      if (!closed)
        status.textContent =
          error instanceof Error ? error.message : 'Could not save run';
      retry.hidden = false;
    }
    if (!closed) await board?.refresh();
  }
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
  const community = communityJoin(screen.element, true);
  void save();
  return {
    destroy() {
      closed = true;
      community.destroy();
      screen.destroy();
    },
  };
}
