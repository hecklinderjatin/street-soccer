import type { FreeKickBoards } from '../../shared/freeKick';
import { pixelLabel } from '../ui/pixelLabel';

export function freeKickLeaderboard() {
  const root = document.createElement('section');
  root.className = 'fk-board';
  root.setAttribute('aria-label', 'Seven-day Free Kick leaderboards');
  root.innerHTML =
    '<header><strong>7-DAY LEADERBOARDS</strong><button type="button" class="fk-board-all">ALL</button></header><div class="fk-board-tabs" role="group" aria-label="Leaderboard category"><button type="button" data-board="score">HIGHEST SCORE</button><button type="button" data-board="speed">FASTEST GOAL</button></div><ol></ol><p class="fk-board-me"></p><p class="fk-board-status" role="status"></p>';
  let kind: 'score' | 'speed' = 'score',
    limit = 3,
    closed = false;
  let data: FreeKickBoards | null = null;
  let requestId = 0;
  const rows = root.querySelector('ol'),
    me = root.querySelector<HTMLElement>('.fk-board-me'),
    status = root.querySelector<HTMLElement>('.fk-board-status');
  const all = root.querySelector<HTMLButtonElement>('.fk-board-all');
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
    limit = limit === 3 ? 25 : 3;
    root.classList.toggle('is-expanded', limit === 25);
    if (all) pixelLabel(all, limit === 25 ? 'TOP 3' : 'ALL');
    void refresh();
  });
  if (all) pixelLabel(all, 'ALL');
  render();
  void refresh();
  return {
    root,
    refresh,
    destroy() {
      closed = true;
      root.remove();
    },
  };
}
