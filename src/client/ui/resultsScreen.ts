import type { DailyLeadersResponse } from '../../shared/api';
import type { MatchResult } from '../../shared/types';
import { DIFFICULTY_LABEL } from '../../shared/types';
import { formatClock } from '../../shared/matchConfig';
import { POST_TYPE_LABEL, type PostType } from '../../shared/postType';
import { casualScreen } from './casualScreen';
import { pixelLabel } from './pixelLabel';
import { css } from './menuCard';
import { JERSEY_SWATCH, PAL } from './palette';

// One responsive results card for every mode. The page shell measures the
// webview's visual viewport; auto margins centre the card when it fits.
export function resultsScreen(result: MatchResult, type: PostType) {
  const casual = result.config.mode === 'casual';
  const won = result.goalsFor > result.goalsAgainst;
  const lost = result.goalsFor < result.goalsAgainst;
  const title = won ? 'YOU WIN!' : lost ? 'YOU LOSE' : 'DRAW';
  const screen = casualScreen(
    title,
    casual ? 'UNRANKED MATCH' : 'RANKED MATCH',
    false,
    { compactBelow: 700, minimalBelow: 560 }
  );
  screen.element.classList.add('results-screen');
  screen.panel.classList.add('results-panel');
  screen.panel.dataset.mode = casual ? 'casual' : 'ranked';
  screen.panel.style.setProperty(
    '--outcome',
    css(won ? PAL.green : lost ? PAL.red : PAL.yellow)
  );

  const header = document.createElement('header');
  header.className = 'results-header';
  const mode = document.createElement('span');
  mode.className = 'results-mode';
  pixelLabel(mode, casual ? 'CASUAL' : POST_TYPE_LABEL[type]);
  const fulltime = document.createElement('span');
  fulltime.textContent = 'FULL TIME';
  header.append(mode, fulltime);

  const content = document.createElement('div');
  content.className = 'results-content';
  const summary = document.createElement('div');
  summary.className = 'results-summary';
  const hero = document.createElement('div');
  hero.className = 'results-hero';
  hero.append(screen.heading, screen.description);
  summary.append(hero);

  const scoreboard = document.createElement('div');
  scoreboard.className = 'results-scoreboard';
  scoreboard.setAttribute('role', 'group');
  scoreboard.setAttribute(
    'aria-label',
    `${result.config.home.name} ${result.goalsFor} - ${result.goalsAgainst} ${result.config.away.name}`
  );
  for (const side of ['home', 'away'] as const) {
    if (side === 'away') {
      const versus = document.createElement('span');
      versus.className = 'results-versus';
      pixelLabel(versus, 'VS');
      scoreboard.append(versus);
    }
    const team = document.createElement('div');
    team.className = 'results-team';
    team.style.setProperty(
      '--kit',
      css(JERSEY_SWATCH[result.config[side].jersey])
    );
    const name = document.createElement('strong');
    name.className = 'results-team-name';
    pixelLabel(name, result.config[side].name);
    const formation = document.createElement('span');
    formation.className = 'results-formation';
    formation.textContent = result.config[side].formation;
    const goals = document.createElement('strong');
    goals.className = 'results-goals';
    pixelLabel(
      goals,
      String(side === 'home' ? result.goalsFor : result.goalsAgainst)
    );
    team.append(name, formation, goals);
    scoreboard.append(team);
  }
  summary.append(scoreboard);
  const metadata = document.createElement('div');
  metadata.className = 'results-meta';
  const difficulty = document.createElement('span');
  difficulty.className = 'preview-difficulty';
  difficulty.dataset.level = result.config.difficulty;
  pixelLabel(difficulty, `${DIFFICULTY_LABEL[result.config.difficulty]} AI`);
  const duration = document.createElement('span');
  duration.className = 'results-duration';
  pixelLabel(duration, formatClock(result.config.durationSec));
  metadata.append(difficulty, duration);
  summary.append(metadata);

  const stats = document.createElement('div');
  stats.className = 'results-stats';
  for (const [label, value] of [
    ['SHOTS', result.shots],
    ['PASSES', result.passes],
    ['TACKLES WON', result.tacklesWon],
  ]) {
    const item = document.createElement('div');
    const number = document.createElement('strong');
    pixelLabel(number, String(value));
    const caption = document.createElement('span');
    caption.textContent = String(label);
    item.append(number, caption);
    stats.append(item);
  }
  summary.append(stats);
  content.append(summary);

  const board = document.createElement('section');
  board.className = 'results-board';
  board.setAttribute('aria-label', '7-day leaderboard');
  const boardTitle = document.createElement('h2');
  pixelLabel(boardTitle, '7-DAY TOP 3');
  const status = document.createElement('p');
  status.className = 'results-board-status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Loading scores…';
  const rows = document.createElement('ol');
  const best = document.createElement('p');
  best.className = 'results-best';
  board.append(boardTitle, status, rows, best);
  if (!casual) content.append(board);

  const actions = document.createElement('div');
  actions.className = 'results-actions';
  screen.panel.append(header, content, actions);
  return {
    ...screen,
    actions,
    fillBoard(value: DailyLeadersResponse | string) {
      if (!screen.element.isConnected) return;
      rows.replaceChildren();
      best.textContent = '';
      status.hidden = false;
      if (typeof value === 'string') {
        status.textContent = value;
        return;
      }
      status.hidden = value.top.length > 0;
      status.textContent = 'No scores in 7 days';
      for (const leader of value.top.slice(0, 3)) {
        const row = document.createElement('li');
        const rank = document.createElement('span');
        rank.className = 'results-rank';
        rank.textContent = String(leader.rank);
        const name = document.createElement('span');
        name.className = 'results-player';
        name.textContent = `u/${leader.username}`;
        name.title = `u/${leader.username}`;
        const score = document.createElement('strong');
        score.textContent = `${leader.goalsFor}–${leader.goalsAgainst}`;
        row.append(rank, name, score);
        rows.append(row);
      }
      if (
        value.me &&
        !value.top.some((leader) => leader.username === value.me?.username)
      )
        best.textContent = `YOUR BEST: #${value.me.rank} · ${value.me.goalsFor}–${value.me.goalsAgainst}`;
    },
  };
}
