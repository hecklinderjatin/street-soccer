import { context } from '@devvit/web/client';
import { journeysEnabled } from '../shared/journeys';
import type { JourneySender } from './matchJourney';

// Only Reddit's SDK-backed local route is used. No third-party collector.
// These promises are never awaited by gameplay. No retries or unload handlers.
export const sendJourney: JourneySender = async (path, body) => {
  if (!journeysEnabled || !context?.postId) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`/api/journeys${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      keepalive: true,
    });
    return response.ok && response.status !== 204
      ? await response.json()
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
let ready = false;
export function journeyAppReady() {
  if (ready) return;
  ready = true;
  void sendJourney('/ready', {});
}
