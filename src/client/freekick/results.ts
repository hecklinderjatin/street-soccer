import { communityJoin } from '../ui/communityJoin';
import {
  context,
  exitExpandedMode,
  requestExpandedMode,
} from '@devvit/web/client';
import type { FreeKickStats } from '../../shared/freeKick';
import type { FreeKickChallengeConfig } from '../../shared/freeKickChallenge';
import { endlessFreeKick, infinitySkill } from '../../shared/freeKickChallenge';
import { DIFFICULTY_LABEL } from '../../shared/types';
import { casualButton, casualScreen } from '../ui/casualScreen';
import { css, PAL } from '../ui/palette';
import { pixelLabel } from '../ui/pixelLabel';
import type { FreeKickRecords } from './records';
import { freeKickResultsBoard } from './leaderboard';

// The Challenge summary reuses the normal results card. Practice has no
// terminal result screen. Both boards use the post's Challenge records.
export function freeKickResults(
  stats: FreeKickStats,
  records: FreeKickRecords,
  again: () => void,
  challenge: { won: boolean; config: FreeKickChallengeConfig }
) {
  const custom = challenge.config.mode === 'custom';
  const infinity = endlessFreeKick(challenge.config);
  const goalLine = infinity
    ? String(stats.goals)
    : `${stats.goals}/${challenge.config.goals}`;
  const screen = casualScreen(
    custom
      ? challenge.won
        ? 'SCORED!'
        : 'MISSED'
      : infinity
        ? 'RUN COMPLETE'
        : challenge.won
          ? 'CHALLENGE COMPLETE'
          : 'CHALLENGE FAILED',
    custom
      ? `${stats.shots} ${stats.shots === 1 ? 'ATTEMPT' : 'ATTEMPTS'} · ${challenge.config.distanceM} M · ${DIFFICULTY_LABEL[challenge.config.difficulty]}`
      : infinity
        ? `${stats.goals} GOALS · ${challenge.config.lives} LIVES · REACHED ${infinitySkill(stats.goals)}`
        : `${challenge.config.goals} GOALS · ${challenge.config.lives} ${challenge.config.lives === 1 ? 'LIFE' : 'LIVES'} · ${challenge.config.distanceM} M · ${DIFFICULTY_LABEL[challenge.config.difficulty]}`,
    false,
    {
      compactBelow: 700,
      minimalBelow: 640,
      fitToViewport: true,
    }
  );
  screen.element.classList.add('results-screen', 'fk-results-screen');
  screen.element.setAttribute('role', 'dialog');
  screen.panel.classList.add('results-panel');
  screen.panel.dataset.mode = 'ranked';
  screen.panel.style.setProperty(
    '--outcome',
    css(infinity ? PAL.orange : challenge.won ? PAL.green : PAL.red)
  );

  const header = document.createElement('header');
  header.className = 'results-header';
  const mode = document.createElement('span');
  mode.className = 'results-mode';
  pixelLabel(mode, 'FREE KICK');
  const over = document.createElement('span');
  over.textContent = custom
    ? 'PLAYGROUND'
    : infinity
      ? 'INFINITY'
      : 'CHALLENGE';
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
  bestLine.textContent = `GOALS ${goalLine}`;
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
    ['GOALS', goalLine],
    ['XG', xg.toFixed(1)],
    ['FINISHING', `${finishing >= 0 ? '+' : ''}${finishing.toFixed(1)}`],
    ['GREAT SAVES', String(stats.greatSaves)],
    ['BEST STREAK', String(stats.bestStreak)],
    ['LEVEL', String(stats.level)],
  ]) {
    // A challenge has no great saves (every miss costs a life).
    const tileCaption = caption === 'GREAT SAVES' ? 'SHOTS' : caption;
    const tileValue = caption === 'GREAT SAVES' ? String(stats.shots) : value;
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

  const retry = casualButton('RETRY SAVE', () => void save(), true);
  retry.classList.add('results-retry');
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
  actions.append(casualButton('PLAY AGAIN', again));
  for (const { label, entry } of [
    { label: 'PRACTICE', entry: 'freekick-practice' },
    { label: 'PLAYGROUND', entry: 'freekick-playground' },
  ]) {
    const link = document.createElement('a');
    link.className = 'casual-button secondary';
    if (entry === 'freekick-playground') link.classList.add('results-playground');
    link.href = `${entry}.html`;
    pixelLabel(link, label);
    link.addEventListener('click', (event) => {
      if (context?.postId) {
        event.preventDefault();
        requestExpandedMode(event, entry);
      }
    });
    actions.append(link);
  }
  exit.classList.add('fk-results-exit');
  actions.append(exit, retry);
  let closed = false;
  async function save() {
    status.textContent = 'Saving run...';
    try {
      await records.save(stats);
      if (closed) return;
      status.textContent =
        challenge.config.mode !== 'infinity' && !challenge.won
          ? 'Run saved. Only completed challenges rank on the leaderboard.'
          : 'Run saved. Leaderboards updated.';
      retry.hidden = true;
    } catch {
      if (!closed)
        status.textContent = 'Couldn’t save right now. Please try again.';
      retry.hidden = false;
    }
    if (!closed) await board?.refresh();
  }
  const community = communityJoin(screen.element);
  void save();
  return {
    destroy() {
      closed = true;
      community.destroy();
      screen.destroy();
    },
  };
}
