import { watchVisiblePreview } from '../ui/visiblePreview';
import { startFreeKickDownloads } from '../earlyAssets';
import { context, requestExpandedMode } from '@devvit/web/client';
import { pixelLabel } from '../ui/pixelLabel';
import { freeKickChallenge } from '../challenge';
import { DIFFICULTY_LABEL } from '../../shared/types';
import {
  isLegacyPlaygroundDescription,
  PLAYGROUND_DESCRIPTION,
} from '../../shared/freeKickCustom';
import { readGamesPlayed } from '../gameCount';
import { freeKickFeedBoard } from './leaderboard';

let stopPreview: (() => void) | undefined;
let stopBoard: (() => void) | undefined;

// A Free Kick post's card: the live preview with the post's mode tag
// (CHALLENGE, INFINITY or PLAYGROUND) at its top right, the post's
// settings and its buttons: the ranked run, PRACTICE and PLAYGROUND (the
// kick builder). A Playground post is one shot at a player-built kick:
// PLAY and PLAYGROUND only (user request, 2026-11-11).
export function showFreeKickLobby() {
  const host = document.getElementById('game');
  if (!host) return;
  stopPreview?.();
  stopBoard?.();
  stopBoard = undefined;
  host.classList.add('freekick-post');
  const fk = freeKickChallenge();
  const infinity = fk.mode === 'infinity';
  const custom = fk.mode === 'custom' && fk.custom ? fk.custom : null;
  const mode = custom ? 'playground' : infinity ? 'infinity' : 'challenge';
  const lives = custom
    ? 'ONE GOAL'
    : `${fk.lives} ${fk.lives === 1 ? 'LIFE' : 'LIVES'}`;
  const card = document.createElement('section');
  card.className = 'freekick-lobby';
  card.innerHTML = `
    <div class="freekick-preview preview-stage" aria-hidden="true"></div>
    <header class="mobile-lobby-header"><strong class="freekick-title">STREET SOCCER</strong><div class="preview-match-summary"><strong class="mobile-time freekick-lives"></strong><span class="freekick-mode-chip"></span></div></header>
    <div class="freekick-lobby-details mobile-lobby-details">
      <div class="preview-card-top"><div class="mobile-match-tag freekick-mode">FREE KICK</div></div>
      <div class="preview-teams-row"><h1 class="freekick-tagline"></h1><div class="mobile-match-facts"><small>GOALS TO WIN</small><strong class="freekick-progression"></strong></div></div>
      <p class="freekick-description"></p>
      <div class="preview-actions">
        <a class="freekick-challenge mobile-play" href="freekick-challenge.html">CHALLENGE</a>
        <a class="freekick-practice mobile-casual" href="freekick-practice.html">PRACTICE</a>
        <a class="freekick-playground mobile-casual" href="freekick-playground.html">PLAYGROUND</a>
      </div>
      <p class="freekick-mode-notes preview-activity"></p>
    </div>`;
  card.dataset.mode = mode;
  if (custom) card.querySelector('.freekick-practice')?.remove();
  const caption = card.querySelector('.mobile-match-facts small');
  if (caption && (infinity || custom))
    caption.textContent = custom ? 'GOALS TO WIN' : 'ENDLESS GOALS';
  const description = card.querySelector('.freekick-description');
  const data: unknown = context?.postData;
  const value =
    data && typeof data === 'object' ? Reflect.get(data, 'description') : '';
  if (description)
    description.textContent =
      custom && isLegacyPlaygroundDescription(value)
        ? PLAYGROUND_DESCRIPTION
        : typeof value === 'string'
          ? value
          : '';
  const notes = card.querySelector('.freekick-mode-notes');
  if (notes)
    notes.textContent = custom
      ? `Playground kick: ${custom.distanceM} m, ${custom.wallMen}-man wall, ${DIFFICULTY_LABEL[custom.difficulty].toLowerCase()} keeper. Retry until you score; every miss lowers the prize. Playground: build and share your own.`
      : infinity
        ? `Infinity: ${lives.toLowerCase()}. Start at Easy, rise to Pro. Score until lives run out. Practice: unlimited retries.`
        : `Challenge: ${fk.goals} goals, ${lives.toLowerCase()}, spots around ${fk.distanceM} m, wall ${fk.wallGapM} m from the ball. Fixed sequence for everyone; spots move further and wider. Practice any round.`;
  for (const [selector, text, entry] of [
    [
      '.freekick-challenge',
      custom ? 'PLAY' : infinity ? 'INFINITY' : 'CHALLENGE',
      infinity ? 'freekick-infinity' : 'freekick-challenge',
    ],
    ['.freekick-practice', 'PRACTICE', 'freekick-practice'],
    ['.freekick-playground', 'PLAYGROUND', 'freekick-playground'],
  ]) {
    const button = card.querySelector<HTMLAnchorElement>(selector ?? '');
    if (!button || !text || !entry) continue;
    button.href = `${entry}.html`;
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
    ['.freekick-mode-chip', mode.toUpperCase()],
    [
      '.freekick-progression',
      custom ? '1' : infinity ? 'ENDLESS' : String(fk.goals),
    ],
    ['.freekick-mode', 'FREE KICK'],
    [
      '.freekick-tagline',
      custom
        ? `${DIFFICULTY_LABEL[custom.difficulty]}  ${custom.distanceM} M`
        : infinity
          ? 'EASY TO PRO'
          : `${DIFFICULTY_LABEL[fk.difficulty]}  ${fk.distanceM} M`,
    ],
  ]) {
    const label = card.querySelector<HTMLElement>(selector ?? '');
    if (label && text) pixelLabel(label, text);
  }
  addActivity(card);
  host.replaceChildren(card);
  const preview = card.querySelector<HTMLElement>('.freekick-preview');
  if (preview) {
    const lifecycle = watchVisiblePreview(preview, async () => {
      startFreeKickDownloads();
      const { createFreeKickPreview } = await import('./preview');
      return () => createFreeKickPreview(preview);
    });
    stopPreview = lifecycle.destroy;
  }
}

// Every Free Kick card, as a match card: games played (completed runs
// on this post) and the seven-day top 3 with ALL > for both boards.
function addActivity(card: HTMLElement) {
  const details = card.querySelector('.freekick-lobby-details');
  const notes = card.querySelector('.freekick-mode-notes');
  if (!details) return;
  const activity = document.createElement('div');
  activity.className = 'preview-activity freekick-activity';
  activity.innerHTML =
    '<span><i class="activity-icon"></i> GAMES PLAYED</span><strong class="preview-games" aria-label="Games played">—</strong>';
  if (notes) notes.replaceWith(activity);
  else details.append(activity);
  const games = activity.querySelector<HTMLElement>('.preview-games');
  void readGamesPlayed()
    .then((count) => {
      if (!games) return;
      games.textContent = count === null ? '—' : count.toLocaleString();
      games.title =
        count === null
          ? 'Game count unavailable'
          : `${count} completed runs on this post`;
    })
    .catch(() => {
      if (games) games.title = 'Game count unavailable';
    });
  const board = freeKickFeedBoard();
  details.append(board.ranking);
  card.append(board.modal);
  stopBoard = () => board.destroy();
}
