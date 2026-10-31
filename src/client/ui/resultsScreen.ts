import {
  DAILY_LABEL,
  challengeCleared,
  resultLabel,
  survivalLimits,
  survivalRange,
} from '../../shared/dailyMode';
import type {
  DailyLeadersResponse,
  SpeedLeadersResponse,
} from '../../shared/api';
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
  const dailyMode = casual ? undefined : result.config.dailyMode;
  const won = dailyMode
    ? challengeCleared(
        dailyMode,
        result.goalsFor,
        result.goalsAgainst,
        survivalLimits(result.config).goals,
        survivalLimits(result.config).conceded
      )
    : result.goalsFor > result.goalsAgainst;
  const lost = dailyMode ? !won : result.goalsFor < result.goalsAgainst;
  const title = dailyMode
    ? won
      ? 'CLEARED!'
      : 'TRY AGAIN'
    : won
      ? 'YOU WIN!'
      : lost
        ? 'YOU LOSE'
        : 'DRAW';
  const screen = casualScreen(
    title,
    dailyMode === 'survival'
      ? `${result.goalsFor}/${survivalLimits(result.config).goals} GOALS - ${result.goalsAgainst}/${survivalLimits(result.config).conceded} CONCEDED`
      : casual
        ? 'UNRANKED MATCH'
        : 'RANKED MATCH',
    false,
    { compactBelow: 700, minimalBelow: 640 }
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
  pixelLabel(
    mode,
    dailyMode
      ? DAILY_LABEL[dailyMode]
      : casual
        ? 'CASUAL'
        : POST_TYPE_LABEL[type]
  );
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
  pixelLabel(
    difficulty,
    dailyMode === 'survival'
      ? survivalRange(result.config)
      : `${DIFFICULTY_LABEL[result.config.difficulty]} AI`
  );
  const duration = document.createElement('span');
  duration.className = 'results-duration';
  pixelLabel(
    duration,
    formatClock(
      dailyMode
        ? (result.elapsedSec ?? result.config.durationSec)
        : result.config.durationSec
    )
  );
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
  if (result.fastestGoalKmh) {
    const highlight = document.createElement('p');
    highlight.className = 'results-speed-highlight';
    highlight.textContent = `FASTEST GOAL ${result.fastestGoalKmh} KM/H${result.newSpeedBest ? ' · DEVICE BEST!' : ''}`;
    summary.append(highlight);
  }
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
  const tabs = document.createElement('div');
  tabs.className = 'leaderboard-tabs';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Leaderboard category');
  let selected: 'match' | 'speed' = 'match';
  let savedDaily: DailyLeadersResponse | string = 'Loading scores…';
  let savedSpeed: SpeedLeadersResponse | string | null = null;
  let speedRequest = 0;
  const matchTab = document.createElement('button');
  const speedTab = document.createElement('button');
  matchTab.type = speedTab.type = 'button';
  matchTab.textContent =
    dailyMode === 'survival' ? 'FASTEST CLEARS' : 'MATCH RESULTS';
  speedTab.textContent = 'FASTEST GOALS';
  tabs.append(matchTab, speedTab);
  matchTab.onclick = () => {
    selected = 'match';
    drawBoard();
  };
  speedTab.onclick = async () => {
    selected = 'speed';
    if (savedSpeed !== null) {
      drawBoard();
      return;
    }
    const requested = ++speedRequest;
    savedSpeed = 'Loading speeds…';
    drawBoard();
    try {
      const response = await fetch('/api/speed-leaders');
      if (!response.ok) throw new Error('Unavailable');
      const data: SpeedLeadersResponse = await response.json();
      if (requested !== speedRequest) return;
      savedSpeed = data;
    } catch {
      if (requested !== speedRequest) return;
      savedSpeed = 'SPEED BOARD UNAVAILABLE';
    }
    if (screen.element.isConnected) drawBoard();
  };
  board.append(tabs, boardTitle, status, rows, best);
  if (!casual) content.append(board);

  const actions = document.createElement('div');
  actions.className = 'results-actions';
  screen.panel.append(header, content, actions);
  function drawBoard() {
    if (!screen.element.isConnected) return;
    matchTab.setAttribute('aria-pressed', String(selected === 'match'));
    speedTab.setAttribute('aria-pressed', String(selected === 'speed'));
    pixelLabel(
      boardTitle,
      selected === 'match'
        ? dailyMode === 'survival'
          ? 'FASTEST CLEARS'
          : '7-DAY TOP 3'
        : '7-DAY FASTEST'
    );
    const value = savedDaily;
    rows.replaceChildren();
    best.textContent = '';
    status.hidden = false;
    if (selected === 'speed') {
      const data = savedSpeed;
      status.textContent =
        typeof data === 'string' ? data : 'No goals recorded yet';
      status.hidden =
        typeof data === 'object' && data !== null && data.top.length > 0;
      if (data && typeof data !== 'string') {
        for (const leader of data.top.slice(0, 3)) {
          const row = document.createElement('li');
          const rank = document.createElement('span');
          rank.className = 'results-rank';
          rank.textContent = String(leader.rank);
          const name = document.createElement('span');
          name.className = 'results-player';
          name.textContent = `u/${leader.username}`;
          name.title = name.textContent;
          const speed = document.createElement('strong');
          speed.textContent = `${leader.kmh} km/h`;
          row.append(rank, name, speed);
          rows.append(row);
        }
        if (data.me)
          best.textContent = `YOUR BEST: #${data.me.rank} · ${data.me.kmh} km/h`;
      }
      return;
    }

    if (typeof value === 'string') {
      status.textContent = value;
      return;
    }
    status.hidden = value.top.length > 0;
    status.textContent =
      dailyMode === 'survival'
        ? 'No finishers in 7 days'
        : 'No scores in 7 days';
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
      score.textContent = resultLabel(leader);
      row.append(rank, name, score);
      rows.append(row);
    }
    if (
      value.me &&
      !value.top.some((leader) => leader.username === value.me?.username)
    )
      best.textContent = `YOUR BEST: #${value.me.rank} · ${resultLabel(value.me)}`;
  }
  drawBoard();
  return {
    ...screen,
    actions,
    fillBoard(value: DailyLeadersResponse | string) {
      savedDaily = value;
      if (typeof value !== 'string' && value.fastest) {
        speedRequest++;
        savedSpeed = value.fastest;
      }
      drawBoard();
    },
  };
}
