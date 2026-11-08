import type { FreeKickBoards } from '../../shared/freeKick';
import { pixelLabel } from '../ui/pixelLabel';

export function freeKickLeaderboard(compact = false) {
  const root = document.createElement('section');
  root.className = 'fk-board';
  root.setAttribute('aria-label', 'Seven-day Free Kick leaderboards');
  root.innerHTML =
    '<header><strong>7-DAY LEADERBOARDS</strong><button type="button" class="fk-board-all">ALL</button></header><div class="fk-board-tabs" role="group" aria-label="Leaderboard category"><button type="button" data-board="score">HIGHEST SCORE</button><button type="button" data-board="speed">FASTEST GOAL</button></div><ol></ol><p class="fk-board-me"></p><p class="fk-board-status" role="status"></p>';
  if (compact) {
    root.classList.add('fk-board-compact');
    const sheet = document.createElement('div');
    sheet.className = 'fk-board-sheet';
    sheet.append(...root.childNodes);
    const headingLabel = sheet.querySelector<HTMLElement>('header strong');
    if (headingLabel) pixelLabel(headingLabel, '7-DAY LEADERBOARDS');
    const dialog = document.createElement('div');
    dialog.className = 'fk-board-modal';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Seven-day Free Kick leaderboards');
    dialog.append(sheet);
    const heading = document.createElement('header');
    heading.className = 'fk-board-preview-heading';
    const title = document.createElement('strong');
    pixelLabel(title, '7-DAY TOP 3');
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'fk-board-more';
    pixelLabel(more, 'ALL >');
    heading.append(title, more);
    const preview = document.createElement('ol');
    preview.className = 'fk-board-preview';
    root.append(heading, preview, dialog);
  }
  let kind: 'score' | 'speed' = 'score',
    limit = 3,
    closed = false;
  let data: FreeKickBoards | null = null;
  let requestId = 0;
  const rows = root.querySelector(compact ? '.fk-board-sheet ol' : 'ol'),
    me = root.querySelector<HTMLElement>('.fk-board-me'),
    status = root.querySelector<HTMLElement>('.fk-board-status');
  const all = root.querySelector<HTMLButtonElement>('.fk-board-all');
  const modal = root.querySelector<HTMLElement>('.fk-board-modal');
  const more = root.querySelector<HTMLButtonElement>('.fk-board-more');
  const preview = root.querySelector('.fk-board-preview');
  const tabs = root.querySelectorAll<HTMLButtonElement>('[data-board]');
  for (const tab of tabs) {
    pixelLabel(
      tab,
      tab.dataset.board === 'score' ? 'HIGHEST SCORE' : 'FASTEST GOAL'
    );
    tab.addEventListener('click', () => {
      kind = tab.dataset.board === 'score' ? 'score' : 'speed';
      render();
    });
  }
  const format = (value: number) =>
    kind === 'score' ? `${value} PTS` : `${value} KM/H`;
  function render() {
    for (const tab of tabs)
      tab.setAttribute('aria-pressed', String(tab.dataset.board === kind));
    rows?.replaceChildren();
    if (!data) return;
    const board = data[kind];
    if (preview) {
      preview.replaceChildren();
      for (const entry of data.score.top.slice(0, 3)) {
        const li = document.createElement('li'),
          name = document.createElement('span'),
          value = document.createElement('strong');
        name.textContent = `${entry.rank}. ${entry.username}`;
        value.textContent = `${entry.value} PTS`;
        li.append(name, value);
        preview.append(li);
      }
    }
    for (const entry of board.top) {
      const li = document.createElement('li');
      const player = document.createElement('span'),
        value = document.createElement('strong');
      player.textContent = `${entry.rank}. u/${entry.username}`;
      value.textContent = format(entry.value);
      li.append(player, value);
      rows?.append(li);
    }
    if (me)
      me.textContent = board.me
        ? `YOUR BEST: #${board.me.rank} / ${format(board.me.value)}`
        : '';
    if (status)
      status.textContent = board.top.length
        ? ''
        : 'No records yet. Complete a Play run to rank.';
  }
  async function refresh() {
    const current = ++requestId;
    if (status) status.textContent = 'Loading leaderboards...';
    try {
      const response = await fetch(`/api/freekick/leaders?limit=${limit}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error();
      const value: FreeKickBoards = await response.json();
      if (closed || current !== requestId) return;
      data = value;
      render();
    } catch {
      if (!closed && current === requestId && status)
        status.textContent = 'Leaderboards unavailable. Please try again.';
    }
  }
  all?.addEventListener('click', () => {
    if (compact) {
      close();
      return;
    }
    limit = limit === 3 ? 25 : 3;
    root.classList.toggle('is-expanded', limit === 25);
    if (all) pixelLabel(all, limit === 25 ? 'TOP 3' : 'ALL');
    void refresh();
  });
  function close() {
    if (!modal) return;
    modal.hidden = true;
    more?.focus();
  }
  const escape = (event: KeyboardEvent) => {
    if (!modal || modal.hidden) return;
    if (event.key === 'Tab') {
      const buttons = modal.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)'
      );
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  more?.addEventListener('click', () => {
    if (!modal) return;
    modal.hidden = false;
    limit = 25;
    root.classList.add('is-expanded');
    all?.focus();
    void refresh();
  });
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  if (compact) document.addEventListener('keydown', escape);
  if (all) pixelLabel(all, compact ? 'CLOSE' : 'ALL');
  render();
  void refresh();
  return {
    root,
    refresh,
    destroy() {
      closed = true;
      if (compact) document.removeEventListener('keydown', escape);
      root.remove();
    },
  };
}
