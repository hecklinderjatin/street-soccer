import type Phaser from 'phaser';

const PREVIEW_DELAY_MS = 1000;
const VISIBLE_RATIO = 0.15;

export function watchVisiblePreview(
  element: HTMLElement,
  load: () => Promise<() => Phaser.Game>
) {
  let game: Phaser.Game | undefined;
  let visible = false;
  let loading = false;
  let disposed = false;
  let timer: number | undefined;
  let immediate = false;

  async function start() {
    if (disposed || game || loading) return;
    loading = true;
    try {
      const create = await load();
      if (!disposed && (immediate || (visible && !document.hidden))) {
        game = create();
        if (document.hidden) game.loop.sleep();
      }
    } catch {
      // The native card stays usable if the preview fails to load.
    } finally {
      loading = false;
    }
  }

  const changed = () => {
    window.clearTimeout(timer);
    if (!visible || document.hidden) game?.loop.sleep();
    else if (game) game.loop.wake();
    else timer = window.setTimeout(() => void start(), PREVIEW_DELAY_MS);
  };
  document.addEventListener('visibilitychange', changed);
  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          ([entry]) => {
            visible = Boolean(
              entry?.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO
            );
            changed();
          },
          { threshold: VISIBLE_RATIO }
        )
      : null;
  if (observer) observer.observe(element);
  else {
    visible = true;
    changed();
  }

  return {
    startNow() {
      immediate = true;
      window.clearTimeout(timer);
      void start();
    },
    destroy() {
      disposed = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', changed);
      game?.destroy(true);
    },
  };
}
