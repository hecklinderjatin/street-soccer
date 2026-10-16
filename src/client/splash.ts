import { context, requestExpandedMode } from '@devvit/web/client';
import { formatClock } from '../shared/matchConfig';
import {
  PLAYER_HAIR_TEXTURE,
  PLAYER_SKIN_TEXTURE,
  playerTexture,
} from './art/playerSheets';
import { postChallenge, startingConfig } from './challenge';

const startButton = document.getElementById(
  'start-button'
) as HTMLButtonElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

const greetingElement = document.getElementById(
  'greeting'
) as HTMLParagraphElement;

// context is only populated inside Reddit; a local preview has none.
const username = context?.username;
const challenge = postChallenge();
if (challenge?.config.locked) {
  // A moderator's custom match: their text, else a summary of the settings.
  const { config, description } = challenge;
  const start =
    config.startGoalsAgainst > 0
      ? `, starting 0-${config.startGoalsAgainst} down`
      : '';
  greetingElement.textContent =
    description ||
    `${config.home.name} vs ${config.away.name}: ${formatClock(config.durationSec)} against the ${config.difficulty} AI${start}.`;
} else if (username) {
  greetingElement.textContent = `Hey u/${username}, 90-second 5v5 street football. Can you beat the AI?`;
}

// Warm the browser cache for the game while the post sits in the feed, so
// tapping Play opens it without waiting on downloads. Only once the card has
// stayed at least half on screen for PREFETCH_AFTER_MS (not for people just
// scrolling past), and never with data saver on.
const PREFETCH_AFTER_MS = 1500;
// The art gameAssets.ts loads, with only the two kits this post's match
// wears (gameAssets itself pulls in Phaser, too heavy for the splash).
const { home, away } = startingConfig();
const GAME_FILES = [
  '/game.js',
  '/game.css',
  '/art/ball-authored.webp',
  '/art/ball-shot-authored.webp',
  ...[
    playerTexture(home.jersey),
    playerTexture(away.jersey),
    playerTexture('homeKeeper'),
    playerTexture('awayKeeper'),
    PLAYER_SKIN_TEXTURE,
    PLAYER_HAIR_TEXTURE,
  ].map((key) => `/art/${key}.webp`),
];

function saveDataOn() {
  const connection: unknown = Reflect.get(navigator, 'connection');
  return (
    typeof connection === 'object' &&
    connection !== null &&
    Reflect.get(connection, 'saveData') === true
  );
}

function prefetchGame() {
  for (const href of GAME_FILES) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    if (href.endsWith('.js')) {
      link.as = 'script';
      link.crossOrigin = 'anonymous';
    }
    document.head.appendChild(link);
  }
}

if (!saveDataOn() && 'IntersectionObserver' in window) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        timer ??= setTimeout(() => {
          observer.disconnect();
          prefetchGame();
        }, PREFETCH_AFTER_MS);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    { threshold: 0.5 }
  );
  observer.observe(document.body);
}
