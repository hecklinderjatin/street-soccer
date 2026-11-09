import { freeKickFeedBoard } from './leaderboard';
import { watchFreeKickPreview } from './previewLifecycle';
import { context, requestExpandedMode } from '@devvit/web/client';
import { pixelLabel } from '../ui/pixelLabel';
import { measurePlay } from '../playMetrics';
import { FREE_KICK as FK } from '../../shared/tuning';

let stopBoard: (() => void) | undefined;
let stopPreview: (() => void) | undefined;

export function showFreeKickLobby() {
  const host = document.getElementById('game');
  if (!host) return;
  stopPreview?.();
  stopBoard?.();
  host.classList.add('freekick-post');
  const card = document.createElement('section');
  card.className = 'freekick-lobby';
  card.innerHTML = `
    <div class="freekick-preview preview-stage" aria-hidden="true"></div>
    <header class="mobile-lobby-header"><strong class="freekick-title">STREET SOCCER</strong><div class="preview-match-summary"><strong class="mobile-time freekick-lives">3 LIVES</strong></div></header>
    <div class="freekick-lobby-details mobile-lobby-details">
      <div class="preview-card-top"><div class="mobile-match-tag freekick-mode">FREE KICK</div></div>
      <div class="preview-teams-row"><h1 class="freekick-tagline">PICK YOUR CORNER</h1><div class="mobile-match-facts"><small>LEVEL UP</small><strong class="freekick-progression">2 GOALS</strong></div></div>
      <p class="freekick-description"></p>
      <div class="preview-actions">
        <a class="freekick-play mobile-play" href="freekick.html">PLAY</a>
        <a class="freekick-practice mobile-casual" href="freekick-practice.html">PRACTICE</a>
      </div>
      <p class="freekick-mode-notes preview-activity">Practice: choose a level, unlimited retries.</p>
    </div>`;
  const description = card.querySelector('.freekick-description');
  const data: unknown = context?.postData;
  const value =
    data && typeof data === 'object' ? Reflect.get(data, 'description') : '';
  if (description)
    description.textContent = typeof value === 'string' ? value : '';
  for (const [selector, text, entry] of [
    ['.freekick-play', 'PLAY FREE KICK', 'freekick'],
    ['.freekick-practice', 'PRACTICE', 'freekick-practice'],
  ]) {
    const button = card.querySelector<HTMLAnchorElement>(selector ?? '');
    if (!button || !text || !entry) continue;
    pixelLabel(button, text);
    button.addEventListener('click', (event) => {
      if (entry === 'freekick') measurePlay('play_tap', 'freekick');
      if (!context?.postId) return;
      event.preventDefault();
      requestExpandedMode(event, entry);
    });
  }
  for (const [selector, text] of [
    ['.freekick-title', 'STREET SOCCER'],
    ['.freekick-lives', `${FK.lives} LIVES`],
    ['.freekick-progression', `${FK.goalsPerLevel} GOALS`],
    ['.freekick-mode', 'FREE KICK'],
    ['.freekick-tagline', 'PICK YOUR CORNER'],
  ]) {
    const label = card.querySelector<HTMLElement>(selector ?? '');
    if (label && text) pixelLabel(label, text);
  }
  // The match card's ranking block and full-board sheet (mobileLobby.ts).
  const board = freeKickFeedBoard();
  card.querySelector('.freekick-lobby-details')?.append(board.ranking);
  card.append(board.modal);
  stopBoard = () => board.destroy();
  host.replaceChildren(card);
  const preview = card.querySelector<HTMLElement>('.freekick-preview');
  if (preview) stopPreview = watchFreeKickPreview(preview);
}
