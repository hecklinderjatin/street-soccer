import { startEarlyDownloads } from './earlyAssets';

// The feed card is the live lobby: the real match renderer in silent demo
// mode (an AI-vs-AI match beside the match info and PLAY). No loading
// screen or placeholder on top: the court appears as soon as the game code
// runs and the players join when their art is in. The match art starts
// downloading at once, alongside the game code. The renderer sleeps while
// the card is off-screen and never creates player results.
startEarlyDownloads();

let instance: ReturnType<typeof import('./game').createGame> | undefined;
let loading = false;
let visible = false;

async function startPreview() {
  if (loading || instance) return;
  loading = true;
  try {
    const { createGame } = await import('./game');
    instance = createGame(true);
    if (!visible || document.hidden) instance.loop.sleep();
  } catch {
    loading = false; // try again the next time the card is shown
  }
}

function updateVisibility() {
  if (visible && !document.hidden) {
    if (instance) instance.loop.wake();
    else void startPreview();
  } else instance?.loop.sleep();
}

document.addEventListener('visibilitychange', updateVisibility);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? false;
      updateVisibility();
    },
    { threshold: 0.15 }
  ).observe(document.body);
} else {
  visible = true;
  updateVisibility();
}
