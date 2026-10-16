import { context, requestExpandedMode } from '@devvit/web/client';
import { DEFAULT_MATCH_CONFIG } from '../shared/matchConfig';
import { VIEW } from '../shared/tuning';
import {
  PLAYER_HAIR_TEXTURE,
  PLAYER_SKIN_TEXTURE,
  playerTexture,
} from './art/playerSheets';
import { postChallenge, startingConfig } from './challenge';
import { PLAY_BUTTON, paintButton, paintMenuCard } from './ui/menuCard';
import { PAL, PX } from './ui/palette';

// The feed card shows the game's own title screen (ui/menuCard.ts paints
// it for both): title, the moderator's locked match settings (or the
// default match line) and PLAY, which opens the game. The 1280 x 720 view is
// scaled to fit the card and centred; the wall and street fill the rest.

function cardCanvas(): HTMLCanvasElement {
  const el = document.getElementById('card');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('#card missing');
  return el;
}
const canvas = cardCanvas();
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('no 2d canvas');

const challenge = postChallenge();
const info = {
  config: challenge?.config.locked ? challenge.config : null,
  durationSec: DEFAULT_MATCH_CONFIG.durationSec,
  // context is only populated inside Reddit; a local preview has none.
  username: context?.username,
};
if (challenge?.description) canvas.title = challenge.description;

// The view's placement in the canvas (canvas px = view px: the canvas is
// sized in view units and CSS scales it to the card).
let offsetX = 0;
let offsetY = 0;
let pressed = false;

function draw() {
  const rect = canvas.getBoundingClientRect();
  if (!ctx || rect.width === 0 || rect.height === 0) return;
  const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
  const width = Math.round(rect.width / scale);
  const height = Math.round(rect.height / scale);
  canvas.width = width;
  canvas.height = height;
  offsetX = Math.round((width - VIEW.width) / 2);
  offsetY = Math.round((height - VIEW.height) / 2);
  paintMenuCard(ctx, width, height, offsetX, offsetY, info);
  paintButton(
    ctx,
    offsetX + PLAY_BUTTON.x,
    offsetY + PLAY_BUTTON.y,
    PLAY_BUTTON.w,
    PLAY_BUTTON.h,
    PAL.green,
    'PLAY',
    2 * PX,
    pressed
  );
}

// Is a pointer event on PLAY? (client px -> view px)
function onPlay(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width - offsetX;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height - offsetY;
  return (
    Math.abs(x - PLAY_BUTTON.x) <= PLAY_BUTTON.w / 2 &&
    Math.abs(y - PLAY_BUTTON.y) <= PLAY_BUTTON.h / 2
  );
}

// Sinks on press, opens the game on release over PLAY (like TextButton).
const setPressed = (value: boolean) => {
  if (pressed === value) return;
  pressed = value;
  draw();
};
canvas.addEventListener('pointerdown', (e) => setPressed(onPlay(e)));
canvas.addEventListener('pointerleave', () => setPressed(false));
canvas.addEventListener('pointermove', (e) => {
  canvas.style.cursor = onPlay(e) ? 'pointer' : 'default';
  if (pressed && !onPlay(e)) setPressed(false);
});
canvas.addEventListener('click', (e) => {
  const hit = onPlay(e);
  setPressed(false);
  if (hit) requestExpandedMode(e, 'game');
});
new ResizeObserver(draw).observe(canvas);
draw();

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
