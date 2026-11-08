// Match the normal feed preview: load when visible and stop ticking off-screen.
export function watchFreeKickPreview(element: HTMLElement) {
  let game:
    ReturnType<typeof import('./preview').createFreeKickPreview> | undefined;
  let visible = false;
  let loading = false;
  let disposed = false;
  const update = async () => {
    if (disposed) return;
    if (!visible || document.hidden) {
      game?.loop.sleep();
      return;
    }
    if (game) {
      game.loop.wake();
      return;
    }
    if (loading) return;
    loading = true;
    try {
      const { createFreeKickPreview } = await import('./preview');
      if (disposed) return;
      game = createFreeKickPreview(element);
      if (!visible || document.hidden) game.loop.sleep();
    } catch {
      // Keep Play/Practice usable; retry the preview on the next visibility change.
    } finally {
      loading = false;
    }
  };
  const changed = () => {
    void update();
  };
  document.addEventListener('visibilitychange', changed);
  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          ([entry]) => {
            visible = entry?.isIntersecting ?? false;
            changed();
          },
          { threshold: 0.15 }
        )
      : null;
  if (observer) observer.observe(element);
  else {
    visible = true;
    changed();
  }
  return () => {
    disposed = true;
    observer?.disconnect();
    document.removeEventListener('visibilitychange', changed);
    game?.destroy(true);
  };
}
