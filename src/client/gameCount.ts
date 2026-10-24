import { context } from '@devvit/web/client';
import type { MatchConfig } from '../shared/types';
import type { GamesPlayedResponse } from '../shared/api';

async function send(path: string, body: unknown) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt)
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
      if (response.ok) return true;
      if (response.status < 500 && response.status !== 409) return false;
    } catch {
      /* Retry an interrupted request with the same match ID. */
    }
  }
  return false;
}

// A fresh receipt for every real match, including rematches. Preview scenes
// never call this. Counting cannot delay or interrupt gameplay or rankings.
export function trackGame(config: MatchConfig) {
  if (!context?.postId) return { complete: async () => {} };
  const id = crypto.randomUUID();
  const registered = send('/api/games/start', { id, config });
  let completed = false;
  return {
    async complete() {
      if (completed) return;
      completed = true;
      if (await registered) await send('/api/games/complete', { id });
    },
  };
}

export async function readGamesPlayed(): Promise<number | null> {
  if (!context?.postId) return null;
  const response = await fetch('/api/games', { cache: 'no-store' });
  if (!response.ok) throw new Error('Game count unavailable');
  const data: GamesPlayedResponse = await response.json();
  if (!Number.isSafeInteger(data.gamesPlayed) || data.gamesPlayed < 0)
    throw new Error('Invalid game count');
  return data.gamesPlayed;
}
