import { reddit, redis } from '@devvit/web/server';
import { boardKey, statsKey, today } from './daily';
import { requirePinnedThread } from './pinnedThread';

// Devvit Rules (user actions): a score shared without the player's own words
// must be a reply to a stickied comment, not a top-level comment. Each post
// gets one stickied "Scores" comment from the app, created with the post (or
// the first time someone shares a score), and its id kept in Redis.

const threadKey = (postId: string) => `scorethread:${postId}`;
const THREAD_TEXT =
  '🏆 **Scores**: finish a match and tap **POST MY SCORE** to share yours. ' +
  'Scores are posted from your own Reddit account as replies here; ' +
  'add your own words to post a comment of your own instead.';

// The post's stickied scores comment (made now if it has none).
export async function scoreThread(postId: `t3_${string}`) {
  const key = threadKey(postId);
  return requirePinnedThread(postId, {
    saved: async () =>
      (await redis.get(`${key}:pending`)) ?? (await redis.get(key)),
    pending: async (id) => {
      await redis.set(`${key}:pending`, id);
    },
    published: async (id) => {
      await redis.set(key, id);
      await redis.del(`${key}:pending`);
    },
    fetch: async (id) => {
      try {
        return await reddit.getCommentById(id);
      } catch (error) {
        // The SDK uses this exact error for an absent comment. Network and
        // permission failures must fail closed, without creating duplicates.
        if (error instanceof Error && error.message === 'not found') return null;
        throw error;
      }
    },
    create: () =>
      reddit.submitComment({ id: postId, text: THREAD_TEXT, runAs: 'APP' }),
  });
}

// A deleted post: everything the app keeps about it goes (Devvit Rules,
// user deletions): its daily leaderboards (kept 8 days, so the last 9 UTC
// days cover them all) and its scores comment id. Per-player cooldown keys
// expire on their own within minutes.
export async function forgetPost(postId: string) {
  const keys = [threadKey(postId), `${threadKey(postId)}:pending`];
  const day = new Date(`${today()}T00:00:00Z`);
  for (let back = 0; back <= 9; back++) {
    const date = new Date(day.getTime() - back * 86_400_000)
      .toISOString()
      .slice(0, 10);
    keys.push(boardKey(postId, date), statsKey(postId, date));
  }
  await redis.del(...keys);
}
