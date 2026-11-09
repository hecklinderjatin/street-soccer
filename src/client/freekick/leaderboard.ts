import type { FreeKickBoard, FreeKickBoards } from '../../shared/freeKick';
import { pixelLabel } from '../ui/pixelLabel';

// Free Kick's two seven-day boards (highest score, fastest goal), drawn
// with the normal match's markup and styles (style.css): the feed card's
// .preview-ranking + .mobile-board-modal (ui/mobileLobby.ts) and the
// results card's .results-board (ui/resultsScreen.ts).

type Kind = 'score' | 'speed';
const TAB_LABEL: Record<Kind, string> = {
  score: 'HIGHEST SCORE',
  speed: 'FASTEST GOALS',
};
const value = (kind: Kind, n: number) =>
  kind === 'score' ? `${n.toLocaleString()} pts` : `${n} km/h`;

async function fetchBoards(limit: number): Promise<FreeKickBoards> {
  const response = await fetch(`/api/freekick/leaders?limit=${limit}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Leaderboard unavailable');
  return response.json();
}

function tabs(onSelect: (kind: Kind) => void) {
  const group = document.createElement('div');
  group.className = 'leaderboard-tabs';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Leaderboard category');
  const buttons = (['score', 'speed'] as const).map((kind) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = TAB_LABEL[kind];
    button.addEventListener('click', () => onSelect(kind));
    group.append(button);
    return { kind, button };
  });
  return {
    group,
    select(kind: Kind) {
      for (const tab of buttons)
        tab.button.setAttribute('aria-pressed', String(tab.kind === kind));
    },
  };
}

// The feed card: 7-DAY TOP 3 (highest score) with ALL >, which opens the
// full seven-day board sheet with both categories, five rows a page.
export function freeKickFeedBoard() {
  const ranking = document.createElement('div');
  ranking.className = 'preview-ranking';
  ranking.innerHTML =
    '<div class="mobile-board-heading"><strong></strong><button type="button" class="mobile-more"></button></div><ol class="mobile-leaders"><li>Leaderboard available on Reddit</li></ol><div class="mobile-best"></div>';
  const modal = document.createElement('div');
  modal.className = 'mobile-board-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '7-day Free Kick leaderboard');
  modal.innerHTML =
    '<div class="mobile-board-sheet"><header><strong></strong><button type="button" class="mobile-board-close" aria-label="Close leaderboard">✕</button></header><ol class="mobile-board-rows"></ol><p class="mobile-board-status" role="status"></p><footer><button type="button" class="mobile-board-prev">‹ PREV</button><button type="button" class="mobile-board-next">NEXT ›</button></footer></div>';
  const get = <T extends HTMLElement>(root: HTMLElement, selector: string) => {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`Missing board element ${selector}`);
    return node;
  };
  pixelLabel(get(ranking, '.mobile-board-heading > strong'), '7-DAY TOP 3');
  const more = get<HTMLButtonElement>(ranking, '.mobile-more');
  pixelLabel(more, 'ALL >');
  const sheetTitle = get(modal, '.mobile-board-sheet header > strong');
  const rows = get(modal, '.mobile-board-rows');
  const status = get(modal, '.mobile-board-status');
  const prev = get<HTMLButtonElement>(modal, '.mobile-board-prev');
  const next = get<HTMLButtonElement>(modal, '.mobile-board-next');
  const close = get<HTMLButtonElement>(modal, '.mobile-board-close');
  let kind: Kind = 'score';
  let page = 0;
  let full: FreeKickBoards | null = null;
  let request = 0;
  let destroyed = false;
  const category = tabs((selected) => {
    kind = selected;
    page = 0;
    drawSheet();
  });
  get(modal, '.mobile-board-sheet header').after(category.group);

  const row = (rank: number, name: string, text: string) => {
    const li = document.createElement('li');
    const who = document.createElement('span');
    who.textContent = `${rank}. ${name}`;
    const score = document.createElement('strong');
    score.textContent = text;
    li.append(who, score);
    return li;
  };

  function drawPreview(data: FreeKickBoard | string) {
    const list = get(ranking, '.mobile-leaders');
    const best = get(ranking, '.mobile-best');
    list.replaceChildren();
    if (typeof data === 'string' || !data.top.length) {
      const li = document.createElement('li');
      li.textContent =
        typeof data === 'string' ? data : 'No scores yet. Set the first!';
      list.append(li);
    } else
      for (const leader of data.top.slice(0, 3))
        list.append(
          row(leader.rank, leader.username, value('score', leader.value))
        );
    best.textContent =
      typeof data !== 'string' && data.me
        ? `Your best: #${data.me.rank} · ${value('score', data.me.value)}`
        : '';
  }

  function drawSheet() {
    pixelLabel(
      sheetTitle,
      kind === 'score' ? '7-DAY LEADERBOARD' : '7-DAY FASTEST GOALS'
    );
    category.select(kind);
    rows.replaceChildren();
    prev.hidden = next.hidden = true;
    if (!full) return;
    const board = full[kind];
    for (const leader of board.top.slice(page * 5, page * 5 + 5))
      rows.append(row(leader.rank, leader.username, value(kind, leader.value)));
    status.textContent = !board.top.length
      ? kind === 'speed'
        ? 'No goals recorded yet'
        : 'No scores yet. Set the first!'
      : board.me
        ? `Your best: #${board.me.rank}`
        : 'You: no score in 7 days';
    prev.hidden = page === 0;
    next.hidden = (page + 1) * 5 >= board.top.length;
  }

  async function open() {
    modal.hidden = false;
    page = 0;
    full = null;
    drawSheet();
    status.textContent = 'Loading...';
    close.focus();
    const current = ++request;
    try {
      const data = await fetchBoards(25);
      if (destroyed || current !== request) return;
      full = data;
      drawSheet();
    } catch {
      if (!destroyed && current === request)
        status.textContent = 'Scores unavailable. Please try again.';
    }
  }
  function hide() {
    modal.hidden = true;
    more.focus();
  }
  // Escape closes the open sheet; Tab keeps focus inside it.
  const onKey = (event: KeyboardEvent) => {
    if (modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    } else if (event.key === 'Tab') {
      const buttons = [
        ...modal.querySelectorAll<HTMLButtonElement>('button'),
      ].filter((button) => !button.hidden && !button.disabled);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };
  more.addEventListener('click', () => void open());
  close.addEventListener('click', hide);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) hide();
  });
  prev.addEventListener('click', () => {
    page--;
    drawSheet();
  });
  next.addEventListener('click', () => {
    page++;
    drawSheet();
  });
  document.addEventListener('keydown', onKey);
  void fetchBoards(3)
    .then((data) => {
      if (!destroyed) drawPreview(data.score);
    })
    .catch(() => {
      if (!destroyed) drawPreview('Leaderboard available on Reddit');
    });
  return {
    ranking,
    modal,
    destroy() {
      destroyed = true;
      document.removeEventListener('keydown', onKey);
      ranking.remove();
      modal.remove();
    },
  };
}

// The results card: category tabs, 7-DAY TOP 3, three ranked rows and the
// player's best, as the match's results board.
export function freeKickResultsBoard() {
  const board = document.createElement('section');
  board.className = 'results-board';
  board.setAttribute('aria-label', '7-day leaderboard');
  const title = document.createElement('h2');
  const status = document.createElement('p');
  status.className = 'results-board-status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Loading scores…';
  const rows = document.createElement('ol');
  const best = document.createElement('p');
  best.className = 'results-best';
  let kind: Kind = 'score';
  let data: FreeKickBoards | string = 'Loading scores…';
  let request = 0;
  const category = tabs((selected) => {
    kind = selected;
    draw();
  });
  board.append(category.group, title, status, rows, best);

  function draw() {
    category.select(kind);
    pixelLabel(title, kind === 'score' ? '7-DAY TOP 3' : '7-DAY FASTEST');
    rows.replaceChildren();
    best.textContent = '';
    if (typeof data === 'string') {
      status.hidden = false;
      status.textContent = data;
      return;
    }
    const current = data[kind];
    status.hidden = current.top.length > 0;
    status.textContent =
      kind === 'score' ? 'No scores in 7 days' : 'No goals recorded yet';
    for (const leader of current.top.slice(0, 3)) {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'results-rank';
      rank.textContent = String(leader.rank);
      const name = document.createElement('span');
      name.className = 'results-player';
      name.textContent = `u/${leader.username}`;
      name.title = name.textContent;
      const score = document.createElement('strong');
      score.textContent = value(kind, leader.value);
      li.append(rank, name, score);
      rows.append(li);
    }
    const me = current.me;
    if (me && !current.top.some((leader) => leader.username === me.username))
      best.textContent = `YOUR BEST: #${me.rank} · ${value(kind, me.value)}`;
  }

  async function refresh() {
    const current = ++request;
    try {
      const value = await fetchBoards(3);
      if (current !== request) return;
      data = value;
    } catch {
      if (current !== request) return;
      data = 'LEADERBOARD ONLY ON REDDIT';
    }
    if (board.isConnected) draw();
  }
  draw();
  return { root: board, refresh };
}
