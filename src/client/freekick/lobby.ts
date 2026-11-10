import { watchFreeKickPreview } from './previewLifecycle';
import { context, requestExpandedMode } from '@devvit/web/client';
import { pixelLabel } from '../ui/pixelLabel';
import { freeKickChallenge } from '../challenge';
import { DIFFICULTY_LABEL } from '../../shared/types';

let stopPreview: (() => void) | undefined;

// A Free Kick post's card: the live preview, the post's Challenge settings
// and its two modes, CHALLENGE and PRACTICE (user request, 2026-11-11: the
// ranked Play mode is no longer offered).
export function showFreeKickLobby() {
  const host = document.getElementById('game');
  if (!host) return;
  stopPreview?.();
  host.classList.add('freekick-post');
  const fk = freeKickChallenge();
  const lives = `${fk.lives} ${fk.lives === 1 ? 'LIFE' : 'LIVES'}`;
  const card = document.createElement('section');
  card.className = 'freekick-lobby';
  card.innerHTML = `
    <div class="freekick-preview preview-stage" aria-hidden="true"></div>
    <header class="mobile-lobby-header"><strong class="freekick-title">STREET SOCCER</strong><div class="preview-match-summary"><strong class="mobile-time freekick-lives"></strong></div></header>
    <div class="freekick-lobby-details mobile-lobby-details">
      <div class="preview-card-top"><div class="mobile-match-tag freekick-mode">FREE KICK</div></div>
      <div class="preview-teams-row"><h1 class="freekick-tagline"></h1><div class="mobile-match-facts"><small>GOALS TO WIN</small><strong class="freekick-progression"></strong></div></div>
      <p class="freekick-description"></p>
      <div class="preview-actions">
        <a class="freekick-challenge mobile-play" href="freekick-challenge.html">CHALLENGE</a>
        <a class="freekick-practice mobile-casual" href="freekick-practice.html">PRACTICE</a>
      </div>
      <p class="freekick-mode-notes preview-activity"></p>
    </div>`;
  const description = card.querySelector('.freekick-description');
  const data: unknown = context?.postData;
  const value =
    data && typeof data === 'object' ? Reflect.get(data, 'description') : '';
  if (description)
    description.textContent = typeof value === 'string' ? value : '';
  const notes = card.querySelector('.freekick-mode-notes');
  if (notes)
    notes.textContent = `Challenge: ${fk.goals} goals, ${lives.toLowerCase()}, spots around ${fk.distanceM} m, wall ${fk.wallFromGoalM} m from goal. Every goal: a new angle, one level harder. Practice: any level, unlimited retries.`;
  for (const [selector, text, entry] of [
    ['.freekick-challenge', 'CHALLENGE', 'freekick-challenge'],
    ['.freekick-practice', 'PRACTICE', 'freekick-practice'],
  ]) {
    const button = card.querySelector<HTMLAnchorElement>(selector ?? '');
    if (!button || !text || !entry) continue;
    pixelLabel(button, text);
    button.addEventListener('click', (event) => {
      if (!context?.postId) return;
      event.preventDefault();
      requestExpandedMode(event, entry);
    });
  }
  for (const [selector, text] of [
    ['.freekick-title', 'STREET SOCCER'],
    ['.freekick-lives', lives],
    ['.freekick-progression', String(fk.goals)],
    ['.freekick-mode', 'FREE KICK'],
    ['.freekick-tagline', `${DIFFICULTY_LABEL[fk.difficulty]}  ${fk.distanceM} M`],
  ]) {
    const label = card.querySelector<HTMLElement>(selector ?? '');
    if (label && text) pixelLabel(label, text);
  }
  host.replaceChildren(card);
  const preview = card.querySelector<HTMLElement>('.freekick-preview');
  if (preview) stopPreview = watchFreeKickPreview(preview);
}
