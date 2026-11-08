import { Hono } from 'hono';
import { context, reddit, redis } from '@devvit/web/server';
import { postType } from '../../shared/postType';
import {
  freeKickDay,
  freeKickRunId,
  readFreeKickStats,
} from '../../shared/freeKick';
import {
  beginFreeKick,
  finishedFreeKick,
  freeKickLeaders,
  saveFreeKick,
} from '../core/freeKick';
import { scoreThread } from '../core/scoreThread';
import { COMMENT_MAX } from '../core/scoreComment';

export const freeKickApi = new Hono();
freeKickApi.use('*', async (c, next) => {
  if (!context.postId || postType(context.postData) !== 'freekick')
    return c.json({ error: 'Free Kick post required' }, 400);
  c.header('Cache-Control', 'no-store');
  await next();
});
freeKickApi.get('/leaders', async (c) => {
  try {
    return c.json(
      await freeKickLeaders(
        context.postId!,
        (await reddit.getCurrentUsername()) ?? null,
        c.req.query('limit') === '25' ? 25 : 3
      )
    );
  } catch {
    return c.json({ error: 'Leaderboards unavailable' }, 503);
  }
});
for (const action of ['start', 'result', 'post-score'] as const)
  freeKickApi.post(`/${action}`, async (c) => {
    try {
      const username = await reddit.getCurrentUsername();
      if (!username)
        return c.json({ error: 'Log in to rank and share your score' }, 401);
      const body: unknown = await c.req.json();
      if (
        !body ||
        typeof body !== 'object' ||
        Reflect.get(body, 'mode') !== 'play'
      )
        return c.json({ error: 'Ranked Play run required' }, 400);
      const id = freeKickRunId(Reflect.get(body, 'id'));
      if (!id) return c.json({ error: 'Invalid run' }, 400);
      if (action === 'start')
        return c.json(await beginFreeKick(context.postId!, username, id));
      const day = freeKickDay(Reflect.get(body, 'day'));
      if (!day) return c.json({ error: 'Invalid run date' }, 400);
      const run = { id, day };
      if (action === 'result') {
        const stats = readFreeKickStats(Reflect.get(body, 'result'));
        if (!stats)
          return c.json({ error: 'Invalid completed Free Kick run' }, 400);
        await saveFreeKick(context.postId!, username, run, stats);
        return c.json(await freeKickLeaders(context.postId!, username));
      }
      const stats = await finishedFreeKick(context.postId!, username, run);
      if (!stats)
        return c.json(
          { error: 'Save a completed Play run before sharing' },
          400
        );
      const raw: unknown = Reflect.get(body, 'comment');
      const comment = typeof raw === 'string' ? raw.trim() : '';
      const include = Reflect.get(body, 'includeStats') === true;
      if (comment.length > COMMENT_MAX || (!comment && !include))
        return c.json(
          { error: 'Add your comment or include the run details' },
          400
        );
      const key = `cooldown:comment:${context.postId}:${username}`;
      const tx = await redis.watch(key);
      const waiting = await redis.get(key);
      await tx.multi();
      if (waiting) {
        await tx.discard();
        return c.json({ error: 'You posted recently; try again later' }, 429);
      }
      await tx.set(key, '1', { expiration: new Date(Date.now() + 600_000) });
      if ((await tx.exec()).length !== 1)
        return c.json({ error: 'Please retry shortly' }, 429);
      try {
        const detail = `**u/${username}:** Free Kick — ${stats.score} points | ${stats.goals} goals / ${stats.shots} shots | Level ${stats.level} | Best streak ${stats.bestStreak} | Fastest goal ${stats.fastestGoalKmh} km/h`;
        const posted = await reddit.submitComment({
          id: comment ? context.postId! : await scoreThread(context.postId!),
          text: [comment, include ? detail : ''].filter(Boolean).join('\n\n'),
          runAs: 'USER',
        });
        return c.json({ commentId: posted.id });
      } catch {
        await redis.del(key);
        return c.json(
          { error: 'Could not post your score; please retry' },
          502
        );
      }
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : 'Free Kick request failed',
        },
        400
      );
    }
  });
