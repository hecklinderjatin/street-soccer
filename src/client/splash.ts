import { context, requestExpandedMode } from '@devvit/web/client';

// Load the real match renderer only once the post is visible. It runs in
// silent demo mode, sleeps off-screen, and never creates player results.
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
    const status = document.getElementById('preview-status');
    if (status) status.textContent = 'PREVIEW UNAVAILABLE - TAP PLAY';
  }
}

function updateVisibility() {
  if (visible && !document.hidden) {
    if (!instance) void startPreview();
    else instance.loop.wake();
  } else instance?.loop.sleep();
}

document.getElementById('loading-play')?.addEventListener('click', (event) => {
  if (context?.postId) requestExpandedMode(event, 'game');
});
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
