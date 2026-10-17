import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type { DailyLeadersResponse, PostScoreResponse } from '../../shared/api';
import { dailyLeaders, saveResult } from '../core/daily';
import { matchLengthSec, postConfig, readStats } from '../core/matchStats';
import { COMMENT_MAX, scoreComment } from '../core/scoreComment';

type SimpleErrorResponse = {
  error: string;
};

export const api = new Hono();

// Abuse limits, per player and post (Redis keys that expire): a result is
// saved at most once per real match length (so a script can't flood the
// leaderboard), and a score comment at most every COMMENT_COOLDOWN_SEC.
const COMMENT_COOLDOWN_SEC = 10 * 60;
const resultCooldownKey = (postId: string, username: string) =>
  `cooldown:result:${postId}:${username}`;
const commentCooldownKey = (postId: string, username: string) =>
  `cooldown:comment:${postId}:${username}`;

// True (and starts the cooldown) if the player may act now.
async function takeCooldown(key: string, sec: number) {
  if (await redis.get(key)) return false;
  await redis.set(key, '1');
  await redis.expire(key, Math.max(1, Math.round(sec)));
  return true;
}

// # Match results: today's top 3 per post, and posting a score as a comment
// ##########################################################################

// A finished match: kept if it is the player's best today; returns the
// leaderboard. Guests (no Reddit login) only get the leaderboard.
api.post('/result', async (c) => {
  const { postId } = context;
  if (!postId)
    return c.json<SimpleErrorResponse>({ error: 'Missing postId' }, 400);
  try {
    const config = postConfig(context.postData);
    const stats = readStats(await c.req.json(), config);
    if (typeof stats === 'string')
      return c.json<SimpleErrorResponse>({ error: stats }, 400);
    const username = await reddit.getCurrentUsername();
    // Saved at most once per real match length (0.8 of it: some slack).
    if (
      username &&
      (await takeCooldown(
        resultCooldownKey(postId, username),
        matchLengthSec(config) * 0.8
      ))
    )
      await saveResult(postId, username, stats);
    return c.json<DailyLeadersResponse>(
      await dailyLeaders(postId, username ?? null)
    );
  } catch (error) {
    console.error('POST /api/result error:', error);
    return c.json<SimpleErrorResponse>({ error: 'Failed to save result' }, 500);
  }
});

api.get('/daily-leaders', async (c) => {
  const { postId } = context;
  if (!postId)
    return c.json<SimpleErrorResponse>({ error: 'Missing postId' }, 400);
  try {
    const username = await reddit.getCurrentUsername();
    return c.json<DailyLeadersResponse>(
      await dailyLeaders(
        postId,
        username ?? null,
        Number(c.req.query('limit') ?? 3)
      )
    );
  } catch (error) {
    console.error('GET /api/daily-leaders error:', error);
    return c.json<SimpleErrorResponse>(
      { error: 'Failed to fetch leaderboard' },
      500
    );
  }
});

// The player's comment on this post, with their score and stats if they
// chose to share them. Posted from their account; if Reddit refuses that,
// from the app account with their name on it.
api.post('/post-score', async (c) => {
  const { postId } = context;
  if (!postId)
    return c.json<SimpleErrorResponse>({ error: 'Missing postId' }, 400);
  try {
    const username = await reddit.getCurrentUsername();
    if (!username)
      return c.json<SimpleErrorResponse>({ error: 'Log in to post' }, 401);
    const body: unknown = await c.req.json();
    if (typeof body !== 'object' || body === null)
      return c.json<SimpleErrorResponse>({ error: 'Invalid request' }, 400);
    const config = postConfig(context.postData);
    const stats = readStats(Reflect.get(body, 'result'), config);
    if (typeof stats === 'string')
      return c.json<SimpleErrorResponse>({ error: stats }, 400);
    const raw: unknown = Reflect.get(body, 'comment');
    const comment = typeof raw === 'string' ? raw.trim() : '';
    const includeStats = Reflect.get(body, 'includeStats') === true;
    if (comment.length > COMMENT_MAX)
      return c.json<SimpleErrorResponse>(
        { error: `Comment: at most ${COMMENT_MAX} characters` },
        400
      );
    if (!comment && !includeStats)
      return c.json<SimpleErrorResponse>(
        { error: 'Write a comment or share your score' },
        400
      );
    const cooldown = commentCooldownKey(postId, username);
    if (!(await takeCooldown(cooldown, COMMENT_COOLDOWN_SEC)))
      return c.json<SimpleErrorResponse>(
        { error: 'You posted recently: try again in a few minutes' },
        429
      );
    try {
      const posted = await reddit.submitComment({
        id: postId,
        text: scoreComment(comment, includeStats, stats, config),
        runAs: 'USER',
      });
      return c.json<PostScoreResponse>({ commentId: posted.id });
    } catch (error) {
      // Never re-post the player's words from the app account.
      console.warn('Posting as the user failed:', error);
      await redis.del(cooldown); // a failed post doesn't use up the cooldown
      return c.json<SimpleErrorResponse>(
        { error: 'Reddit did not accept the comment: try again later' },
        502
      );
    }
  } catch (error) {
    console.error('POST /api/post-score error:', error);
    return c.json<SimpleErrorResponse>({ error: 'Failed to post' }, 500);
  }
});
