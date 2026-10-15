import { context, requestExpandedMode } from '@devvit/web/client';
import { PLAYER_ATLAS_KEYS } from './art/playerSheets';

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
if (username) {
  greetingElement.textContent = `Hey u/${username}, 90-second 5v5 street football. Can you beat the AI?`;
}

// Warm the browser cache for the game while the post sits in the feed, so
// tapping Play opens it without waiting on downloads. Only once the card has
// stayed at least half on screen for PREFETCH_AFTER_MS (not for people just
// scrolling past), and never with data saver on.
const PREFETCH_AFTER_MS = 1500;
const GAME_FILES = [
  '/game.js',
  '/game.css',
  '/art/ball-authored.webp',
  '/art/ball-shot-authored.webp',
  ...PLAYER_ATLAS_KEYS.map((key) => `/art/${key}.webp`),
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
