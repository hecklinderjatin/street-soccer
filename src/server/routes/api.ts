import {
  beginGame,
  finishGame,
  gameId,
  gameDuration,
  gamesPlayed,
  GameCountError,
} from '../core/gamesPlayed';
import { competitiveResultAllowed, postType } from '../../shared/postType';
import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type { DailyLeadersResponse, PostScoreResponse } from '../../shared/api';
import { dailyLeaders, saveResult } from '../core/daily';
import { matchLengthSec, postConfig, readStats } from '../core/matchStats';
import { COMMENT_MAX, scoreComment } from '../core/scoreComment';
import { scoreThread } from '../core/scoreThread';

type SimpleErrorResponse = {
  error: string;
};

export const api = new Hono();

api.get('/games', async (c) => {
  if (!context.postId) return c.json({ error: 'Missing postId' }, 400);
  c.header('Cache-Control', 'no-store');
  try {
    return c.json({ gamesPlayed: await gamesPlayed(redis, context.postId) });
  } catch (error) {
    return c.json(
      { error: 'Game count unavailable' },
      error instanceof GameCountError ? error.status : 503
    );
  }
});

for (const action of ['start', 'complete'] as const) {
  api.post(`/games/${action}`, async (c) => {
    if (!context.postId) return c.json({ error: 'Missing postId' }, 400);
    try {
      const body: unknown = await c.req.json();
      if (!body || typeof body !== 'object')
        return c.json({ error: 'Invalid request' }, 400);
      const id = gameId(Reflect.get(body, 'id'));
      if (action === 'start') {
        await beginGame(
          redis,
          context.postId,
          id,
          gameDuration(Reflect.get(body, 'config'), context.postData)
        );
        return c.json({ registered: true });
      }
      return c.json({
        gamesPlayed: await finishGame(redis, context.postId, id),
      });
    } catch (error) {
      if (error instanceof SyntaxError)
        return c.json({ error: 'Invalid JSON' }, 400);
      if (!(error instanceof GameCountError))
        console.warn('Game count request failed:', error);
      return c.json(
        {
          error:
            error instanceof GameCountError
              ? error.message
              : 'Game count unavailable',
        },
        error instanceof GameCountError ? error.status : 503
      );
    }
  });
}

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

// # Match results: the last 7 days' top 3 per post, and posting a score as a comment
// ##########################################################################

// A finished match: kept if it is the player's best today; returns the
// leaderboard. Guests (no Reddit login) only get the leaderboard.
api.post('/result', async (c) => {
  const { postId } = context;
  if (!postId)
    return c.json<SimpleErrorResponse>({ error: 'Missing postId' }, 400);
  try {
    const config = postConfig(context.postData);
    const body: unknown = await c.req.json();
    if (!competitiveResultAllowed(context.postData, body))
      return c.json<SimpleErrorResponse>(
        { error: 'Casual matches do not submit ranked results' },
        400
      );
    const stats = readStats(body, config);
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
  if (postType(context.postData) === 'casual')
    return c.json<SimpleErrorResponse>(
      { error: 'Casual posts have no leaderboard' },
      400
    );
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
// chose to share them. Posted only from their account.
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
    if (
      !competitiveResultAllowed(context.postData, Reflect.get(body, 'result'))
    )
      return c.json<SimpleErrorResponse>(
        { error: 'Casual matches do not share ranked scores' },
        400
      );
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
      // Devvit Rules: a score shared without the player's own words is a
      // reply to the post's stickied scores comment; with their words it
      // may be a top-level comment.
      const posted = await reddit.submitComment({
        id: comment ? postId : await scoreThread(postId),
        text: scoreComment(comment, includeStats, stats, config),
        runAs: 'USER',
      });
      return c.json<PostScoreResponse>({ commentId: posted.id });
    } catch (error) {
      // Never re-post the player's words from the app account.
      console.warn('Posting as the user failed:', error);
      await redis.del(cooldown); // a failed post doesn't use up the cooldown
      return c.json<SimpleErrorResponse>(
        {
          error: comment
            ? 'Reddit did not accept the comment: try again later'
            : 'Could not verify the pinned Scores comment or share your score. Retry later or contact the subreddit moderators.',
        },
        502
      );
    }
  } catch (error) {
    console.error('POST /api/post-score error:', error);
    return c.json<SimpleErrorResponse>({ error: 'Failed to post' }, 500);
  }
});
