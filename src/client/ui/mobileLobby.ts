import {
  DAILY_LABEL,
  dailyObjective,
  resultLabel,
  survivalLimits,
  survivalRange,
} from '../../shared/dailyMode';
import type {
  DailyLeadersResponse,
  SpeedLeadersResponse,
} from '../../shared/api';
import { POST_TYPE_LABEL, type PostType } from '../../shared/postType';
import { formatClock } from '../../shared/matchConfig';
import { DIFFICULTY_LABEL, type MatchConfig } from '../../shared/types';
import { css } from './menuCard';
import { JERSEY_SWATCH } from './palette';
import { pixelLabel } from './pixelLabel';

// Native-size text and touch targets over the real match canvas. The canvas
// fills the portrait card; settings sit over a gradient at its lower edge.
export function createMobileLobby(
  config: MatchConfig,
  description: string,
  onPlay: (event: MouseEvent) => void,
  onMore: () => void,
  type: PostType,
  onCasual: (event: MouseEvent) => void
) {
  const element = document.createElement('section');
  element.id = 'mobile-lobby';
  element.innerHTML = `
    <div class="preview-stage" aria-label="Live AI match preview"></div>
    <header class="mobile-lobby-header"><strong>STREET SOCCER</strong><div class="preview-match-summary" aria-label="Match settings"><strong class="mobile-time" aria-label="Match duration"></strong><span class="mobile-difficulty preview-difficulty" aria-label="AI difficulty"></span><span class="preview-custom">CUSTOM SETTINGS</span></div></header>
    <div class="mobile-lobby-details">
      <div class="preview-card-top"><div class="mobile-match-tag"></div></div>
      <div class="preview-teams-row"><div class="mobile-teams"><div class="mobile-home"></div><span>VS</span><div class="mobile-away"></div></div>
      <div class="mobile-match-facts"><div><small>START SCORE</small><strong class="mobile-start"></strong></div></div></div>
      <div class="mobile-formations"></div>
      <p class="mobile-challenge"></p>
      <div class="preview-actions"><button class="mobile-play">PLAY MATCH</button><button class="mobile-casual">PLAY CASUAL</button></div>
      <div class="preview-activity"><span><i class="activity-icon"></i> GAMES PLAYED</span><strong class="preview-games" aria-label="Games played">—</strong></div>
      <div class="preview-ranking">
        <div class="mobile-board-heading"><strong>7-DAY TOP 3</strong><button class="mobile-more">ALL ›</button></div>
        <ol class="mobile-leaders"><li>Leaderboard available on Reddit</li></ol>
        <div class="mobile-best"></div>
      </div>
    </div>
    <div class="mobile-board-modal" hidden role="dialog" aria-label="7-day leaderboard">
      <div class="mobile-board-sheet"><header><strong>7-DAY LEADERBOARD</strong><button class="mobile-board-close" aria-label="Close leaderboard">✕</button></header><div class="leaderboard-tabs" role="group" aria-label="Leaderboard category"><button class="mobile-board-match">MATCH RESULTS</button><button class="mobile-board-speed">FASTEST GOALS</button></div><ol class="mobile-board-rows"></ol><p class="mobile-board-status"></p><footer><button class="mobile-board-prev">‹ PREV</button><button class="mobile-board-next">NEXT ›</button></footer></div>
    </div>`;
  const get = (selector: string) => {
    const node = element.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`Missing lobby element ${selector}`);
    return node;
  };
  element.classList.toggle('is-casual', type === 'casual');
  element.classList.toggle('is-daily-template', Boolean(config.dailyMode));
  if (config.dailyMode === 'survival')
    get('.mobile-board-match').textContent = 'FASTEST CLEARS';
  if (config.dailyMode === 'survival')
    get('.mobile-board-heading > strong').textContent = 'FASTEST CLEARS';
  get('.mobile-match-tag').textContent = config.dailyMode
    ? DAILY_LABEL[config.dailyMode]
    : POST_TYPE_LABEL[type];
  get('.mobile-home').textContent = config.home.name;
  get('.mobile-home').style.borderColor = css(
    JERSEY_SWATCH[config.home.jersey]
  );
  get('.mobile-away').textContent = config.away.name;
  get('.mobile-away').style.borderColor = css(
    JERSEY_SWATCH[config.away.jersey]
  );
  get('.mobile-formations').textContent =
    `${config.home.formation}  vs  ${config.away.formation}`;
  get('.mobile-time').textContent = formatClock(config.durationSec);
  get('.mobile-difficulty').textContent =
    config.dailyMode === 'survival'
      ? survivalRange(config)
      : DIFFICULTY_LABEL[config.difficulty];
  get('.mobile-difficulty').dataset.level = config.difficulty;
  get('.mobile-time').hidden = type === 'casual';
  get('.mobile-difficulty').hidden = type === 'casual';
  get('.preview-custom').hidden = type !== 'casual';
  if (config.dailyMode === 'survival')
    get('.mobile-match-facts small').textContent = 'GOALS / LIVES';
  get('.mobile-start').textContent =
    config.dailyMode === 'survival'
      ? `${survivalLimits(config).goals} / ${survivalLimits(config).conceded}`
      : `${config.startGoalsFor ?? 0} – ${config.startGoalsAgainst}`;
  get('.mobile-challenge').textContent =
    [dailyObjective(config), description].filter(Boolean).join(' ') ||
    (type === 'casual'
      ? 'Choose your formations, difficulty and match time.'
      : 'Outplay the opposition. Own the street.');
  get('.mobile-challenge').hidden =
    type !== 'casual' && !description && !config.dailyMode;
  const pixelSelectors = [
    '.mobile-lobby-header > strong',
    '.mobile-match-tag',
    '.mobile-home',
    '.mobile-away',
    '.mobile-time',
    '.mobile-difficulty',
    '.preview-custom',
    '.mobile-start',
    '.mobile-board-heading > strong',
    '.mobile-board-sheet header > strong',
  ];
  pixelSelectors.forEach((selector) => {
    const node = get(selector);
    pixelLabel(node, node.textContent ?? '');
  });
  pixelLabel(
    get('.mobile-play'),
    type === 'casual'
      ? 'PLAY CASUAL'
      : type === 'classic'
        ? 'PLAY CLASSIC'
        : 'PLAY CHALLENGE'
  );
  pixelLabel(get('.mobile-casual'), 'PLAY CASUAL');
  get('.mobile-casual').hidden = type === 'casual';
  get('.mobile-casual').addEventListener('click', onCasual);
  pixelLabel(get('.mobile-more'), 'ALL >');
  get('.mobile-play').addEventListener('click', onPlay);
  get('.mobile-more').addEventListener('click', onMore);
  get('.mobile-board-close').addEventListener('click', () => {
    get('.mobile-board-modal').hidden = true;
  });
  const row = (
    leader:
      DailyLeadersResponse['top'][number] | SpeedLeadersResponse['top'][number]
  ) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${leader.rank}. ${leader.username}`;
    const score = document.createElement('strong');
    score.textContent =
      'kmh' in leader ? `${leader.kmh} km/h` : resultLabel(leader);
    li.append(name, score);
    return li;
  };
  let boardRequest = 0;
  return {
    element,
    setGamesPlayed(count: number | null) {
      get('.preview-games').textContent =
        count === null ? '—' : count.toLocaleString();
      get('.preview-games').title =
        count === null
          ? 'Game count unavailable'
          : `${count} completed matches on this post`;
    },
    setBoard(data: DailyLeadersResponse | string) {
      const list = get('.mobile-leaders');
      list.replaceChildren();
      if (typeof data === 'string' || !data.top.length) {
        const li = document.createElement('li');
        li.textContent =
          typeof data === 'string'
            ? data
            : config.dailyMode === 'survival'
              ? 'No finishers yet. Set the first time!'
              : 'No scores yet. Set the first!';
        list.append(li);
      } else data.top.slice(0, 3).forEach((leader) => list.append(row(leader)));
      get('.mobile-best').textContent =
        typeof data !== 'string' && data.me
          ? `Your best: #${data.me.rank} · ${resultLabel(data.me)}`
          : '';
    },
    async showBoard(onReddit: boolean, category: 'match' | 'speed' = 'match') {
      const speed = category === 'speed';
      pixelLabel(
        get('.mobile-board-sheet header > strong'),
        speed
          ? '7-DAY FASTEST GOALS'
          : config.dailyMode === 'survival'
            ? '7-DAY FASTEST CLEARS'
            : '7-DAY LEADERBOARD'
      );
      get('.mobile-board-match').setAttribute('aria-pressed', String(!speed));
      get('.mobile-board-speed').setAttribute('aria-pressed', String(speed));
      get('.mobile-board-match').onclick = () =>
        void this.showBoard(onReddit, 'match');
      get('.mobile-board-speed').onclick = () =>
        void this.showBoard(onReddit, 'speed');
      const requested = ++boardRequest;
      const modal = get('.mobile-board-modal');
      const list = get('.mobile-board-rows');
      const status = get('.mobile-board-status');
      const prev = get('.mobile-board-prev');
      const next = get('.mobile-board-next');
      modal.hidden = false;
      list.replaceChildren();
      prev.hidden = next.hidden = true;
      status.textContent = onReddit
        ? 'Loading...'
        : 'Leaderboard available on Reddit';
      if (!onReddit) return;
      try {
        const res = await fetch(
          speed ? '/api/speed-leaders?limit=25' : '/api/daily-leaders?limit=25'
        );
        if (!res.ok) throw new Error('Leaderboard unavailable');
        const data: DailyLeadersResponse | SpeedLeadersResponse =
          await res.json();
        if (!element.isConnected || requested !== boardRequest) return;
        let page = 0;
        const draw = () => {
          list.replaceChildren();
          data.top
            .slice(page * 5, page * 5 + 5)
            .forEach((leader) => list.append(row(leader)));
          status.textContent = !data.top.length
            ? speed
              ? 'No goals recorded yet'
              : 'No scores yet. Set the first!'
            : data.me
              ? `Your best: #${data.me.rank}`
              : 'You: no score in 7 days';
          prev.hidden = page === 0;
          next.hidden = (page + 1) * 5 >= data.top.length;
        };
        prev.onclick = () => {
          page--;
          draw();
        };
        next.onclick = () => {
          page++;
          draw();
        };
        draw();
      } catch {
        if (requested === boardRequest && element.isConnected)
          status.textContent = 'Scores unavailable. Please try again.';
      }
    },
  };
}
