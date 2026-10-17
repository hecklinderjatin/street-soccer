import { reddit, redis } from '@devvit/web/server';
import { boardKey, statsKey, today } from './daily';

// Devvit Rules (user actions): a score shared without the player's own words
// must be a reply to a stickied comment, not a top-level comment. Each post
// gets one stickied "Scores" comment from the app, created with the post (or
// the first time someone shares a score), and its id kept in Redis.

const threadKey = (postId: string) => `scorethread:${postId}`;
const THREAD_TEXT =
  '🏆 **Scores**: finish a match and tap **POST MY SCORE** to share yours. ' +
  'Scores are posted from your own Reddit account as replies here; ' +
  'add your own words to post a comment of your own instead.';

const isCommentId = (id: string): id is `t1_${string}` => id.startsWith('t1_');

// The post's stickied scores comment (made now if it has none).
export async function scoreThread(postId: `t3_${string}`) {
  const saved = await redis.get(threadKey(postId));
  if (saved && isCommentId(saved)) return saved;
  const comment = await reddit.submitComment({
    id: postId,
    text: THREAD_TEXT,
    runAs: 'APP',
  });
  try {
    await comment.distinguish(true); // stickied at the top of the comments
  } catch (error) {
    console.warn('Could not sticky the scores comment:', error);
  }
  await redis.set(threadKey(postId), comment.id);
  return comment.id;
}

// A deleted post: everything the app keeps about it goes (Devvit Rules,
// user deletions): its daily leaderboards (kept 8 days, so the last 9 UTC
// days cover them all) and its scores comment id. Per-player cooldown keys
// expire on their own within minutes.
export async function forgetPost(postId: string) {
  const keys = [threadKey(postId)];
  const day = new Date(`${today()}T00:00:00Z`);
  for (let back = 0; back <= 9; back++) {
    const date = new Date(day.getTime() - back * 86_400_000)
      .toISOString()
      .slice(0, 10);
    keys.push(boardKey(postId, date), statsKey(postId, date));
  }
  await redis.del(...keys);
}
