import { redis } from '@devvit/web/server';
import { boardExpiry, registerBoard } from './privacy';
import { gamesDeletedKey } from './gamesPlayed';
import { saveSpeed } from './speedBoard';

// Each run has its own immutable server receipt; only its best time ranks.
export async function savePlaygroundFinish(
  post: string,
  username: string,
  day: string,
  elapsedMs: number
) {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0)
    throw new Error('Invalid finish time');
  const key = `fk-finish:${post}:${day}`;
  await registerBoard(key, day);
  await saveSpeed(
    redis,
    key,
    username,
    elapsedMs,
    boardExpiry(day),
    [`privacy:deleting:${username}`, gamesDeletedKey(post)],
    Date.now(),
    true
  );
}
