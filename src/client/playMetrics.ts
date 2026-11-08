import { context } from '@devvit/web/client';
import type { PlayAttempt, PlayEvent, PlayMode } from '../shared/playMetrics';

const device = () => {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
    return 'ios';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop';
  return 'other';
};

export function measurePlay(
  event: PlayEvent,
  mode: PlayMode,
  attempt?: PlayAttempt
) {
  if (!context?.postId) return;
  void fetch('/api/play-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, mode, device: device(), attempt }),
    keepalive: true,
  }).catch(() => {});
}

export function playAttempt(mode: PlayMode, settings?: PlayAttempt) {
  const seen = new Set<PlayEvent>();
  return (event: PlayEvent) => {
    if (seen.has(event)) return;
    seen.add(event);
    measurePlay(event, mode, settings);
  };
}

let ready = false;
export function playReady(mode: PlayMode) {
  if (ready) return;
  ready = true;
  measurePlay('ready', mode);
  const elapsed = performance.now();
  measurePlay(
    elapsed < 2000
      ? 'ready_under_2s'
      : elapsed <= 5000
        ? 'ready_2_to_5s'
        : 'ready_over_5s',
    mode
  );
}
