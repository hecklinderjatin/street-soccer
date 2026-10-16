import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DailyLeadersResponse,
  InitResponse,
  PostScoreResponse,
  LeaderboardResponse,
  ScoreSubmitRequest,
  ScoreSubmitResponse,
  StateUpsertRequest,
  StoredState,
} from '../../shared/api';
import { dailyLeaders, saveResult } from '../core/daily';
import { postConfig, readStats } from '../core/matchStats';
import { COMMENT_MAX, scoreComment } from '../core/scoreComment';

type ErrorResponse = {
  status: 'error';
  message: string;
};

type SimpleErrorResponse = {
  error: string;
};

export const api = new Hono();

const stateKey = (postId: string, username: string) =>
  `state:${postId}:${username}`;

const leaderboardKey = (postId: string) => `lb:${postId}`;

const getUsername = async (): Promise<string> => {
  const username = await reddit.getCurrentUsername();
  return username ?? 'anonymous';
};

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const username = await reddit.getCurrentUsername();
    const currentUsername = username ?? 'anonymous';

    let snoovatarUrl = '';
    if (username && context.userId) {
      const user = await reddit.getUserById(context.userId);
      if (user) {
        snoovatarUrl = (await user.getSnoovatarUrl()) ?? '';
      }
    }

    const redisKey = `${postId}:${currentUsername}`;
    const previousTime = await redis.get(redisKey);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      username: currentUsername,
      snoovatarUrl: snoovatarUrl,
      previousTime: previousTime ?? '',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

// # DEMO SAMPLE: State + Score + Leaderboard using Redis
// ##########################################################################

api.get('/state', async (c) => {
  try {
    const { postId } = context;
    if (!postId) {
      return c.json<SimpleErrorResponse>(
        { error: 'Missing postId in context' },
        400
      );
    }

    const username = await getUsername();
    const key = stateKey(postId, username);
    const json = await redis.get(key);
    if (!json) {
      return c.json<SimpleErrorResponse>({ error: 'No state found' }, 404);
    }

    return c.json<StoredState>(JSON.parse(json));
  } catch (error) {
    console.error('GET /api/state error:', error);
    return c.json<SimpleErrorResponse>({ error: 'Failed to fetch state' }, 500);
  }
});

api.post('/state', async (c) => {
  try {
    const { postId } = context;
    if (!postId) {
      return c.json<SimpleErrorResponse>(
        { error: 'Missing postId in context' },
        400
      );
    }

    const username = await getUsername();
    if (username === 'anonymous') {
      return c.json<SimpleErrorResponse>({ error: 'Login required' }, 401);
    }

    let body: StateUpsertRequest;
    try {
      body = await c.req.json<StateUpsertRequest>();
    } catch (error) {
      console.error('Invalid JSON body for state', error);
      return c.json<SimpleErrorResponse>({ error: 'Invalid JSON body' }, 400);
    }

    const { level, data } = body ?? {};
    if (level !== undefined && typeof level !== 'number') {
      return c.json<SimpleErrorResponse>(
        { error: 'level must be a number' },
        400
      );
    }
    if (data !== undefined && (typeof data !== 'object' || data === null)) {
      return c.json<SimpleErrorResponse>(
        { error: 'data must be an object' },
        400
      );
    }

    const key = stateKey(postId, username);
    const prevRaw = await redis.get(key);
    const prev = (prevRaw ? JSON.parse(prevRaw) : {}) as Partial<StoredState>;

    const next: StoredState = {
      username,
      updatedAt: Date.now(),
      ...(typeof level === 'number'
        ? { level }
        : prev.level !== undefined
          ? { level: prev.level }
          : {}),
      ...(data !== undefined
        ? { data }
        : prev.data !== undefined
          ? { data: prev.data }
          : {}),
      ...(prev.bestScore !== undefined ? { bestScore: prev.bestScore } : {}),
    };

    await redis.set(key, JSON.stringify(next));
    return c.json<StoredState>(next);
  } catch (error) {
    console.error('POST /api/state error:', error);
    return c.json<SimpleErrorResponse>({ error: 'Failed to save state' }, 500);
  }
});

api.post('/score', async (c) => {
  try {
    const { postId } = context;
    if (!postId) {
      return c.json<SimpleErrorResponse>(
        { error: 'Missing postId in context' },
        400
      );
    }

    const username = await getUsername();
    if (username === 'anonymous') {
      return c.json<SimpleErrorResponse>({ error: 'Login required' }, 401);
    }

    let body: ScoreSubmitRequest;
    try {
      body = await c.req.json<ScoreSubmitRequest>();
    } catch (error) {
      console.error('Invalid JSON body for score', error);
      return c.json<SimpleErrorResponse>({ error: 'Invalid JSON body' }, 400);
    }

    const { score } = body ?? {};
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return c.json<SimpleErrorResponse>(
        { error: 'score must be a finite number' },
        400
      );
    }

    const sanitized = Math.max(0, Math.min(score, 1_000_000_000));
    const lbKey = leaderboardKey(postId);

    const existing = await redis.zScore(lbKey, username);
    const best =
      existing !== undefined && existing !== null
        ? Math.max(Number(existing), sanitized)
        : sanitized;

    await redis.zAdd(lbKey, { score: best, member: username });

    const sKey = stateKey(postId, username);
    const prevRaw = await redis.get(sKey);
    const prev = (prevRaw ? JSON.parse(prevRaw) : {}) as Partial<StoredState>;

    const next: StoredState = {
      username,
      updatedAt: Date.now(),
      ...(prev.level !== undefined ? { level: prev.level } : {}),
      ...(prev.data !== undefined ? { data: prev.data } : {}),
      bestScore: best,
    };

    await redis.set(sKey, JSON.stringify(next));

    return c.json<ScoreSubmitResponse>({
      username,
      score: best,
      updatedAt: next.updatedAt,
    });
  } catch (error) {
    console.error('POST /api/score error:', error);
    return c.json<SimpleErrorResponse>(
      { error: 'Failed to submit score' },
      500
    );
  }
});

api.get('/leaderboard', async (c) => {
  try {
    const { postId } = context;
    if (!postId) {
      return c.json<SimpleErrorResponse>(
        { error: 'Missing postId in context' },
        400
      );
    }

    const username = await getUsername();
    const limitParam = Number(c.req.query('limit') ?? 10);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 10;

    const lbKey = leaderboardKey(postId);
    const entries = await redis.zRange(lbKey, 0, limit - 1);

    const top = entries.map((entry, index) => ({
      rank: index + 1,
      username: entry.member,
      score: Number(entry.score ?? 0),
    }));

    const ascRank = await redis.zRank(lbKey, username);
    const total = Number((await redis.zCard(lbKey)) ?? 0);
    const meRank0 =
      ascRank !== null && ascRank !== undefined && total
        ? total - 1 - Number(ascRank)
        : ascRank;

    const me =
      meRank0 !== undefined && meRank0 !== null
        ? {
            rank: Number(meRank0) + 1,
            username,
            score: Number((await redis.zScore(lbKey, username)) ?? 0),
          }
        : null;

    return c.json<LeaderboardResponse>({
      top,
      me,
      totalPlayers: total,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error('GET /api/leaderboard error:', error);
    return c.json<SimpleErrorResponse>(
      { error: 'Failed to fetch leaderboard' },
      500
    );
  }
});

// # Match results: today's top 3 per post, and posting a score as a comment
// ##########################################################################

// A finished match: kept if it is the player's best today; returns the
// leaderboard. Guests (no Reddit login) only get the leaderboard.
api.post('/result', async (c) => {
  const { postId } = context;
  if (!postId)
    return c.json<SimpleErrorResponse>({ error: 'Missing postId' }, 400);
  try {
    const stats = readStats(await c.req.json(), postConfig(context.postData));
    if (typeof stats === 'string')
      return c.json<SimpleErrorResponse>({ error: stats }, 400);
    const username = await reddit.getCurrentUsername();
    if (username) await saveResult(postId, username, stats);
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
    try {
      const posted = await reddit.submitComment({
        id: postId,
        text: scoreComment(comment, includeStats, stats, config),
        runAs: 'USER',
      });
      return c.json<PostScoreResponse>({ commentId: posted.id, asUser: true });
    } catch (error) {
      console.warn('Posting as the user failed, posting as the app:', error);
      const posted = await reddit.submitComment({
        id: postId,
        text: scoreComment(comment, includeStats, stats, config, username),
        runAs: 'APP',
      });
      return c.json<PostScoreResponse>({ commentId: posted.id, asUser: false });
    }
  } catch (error) {
    console.error('POST /api/post-score error:', error);
    return c.json<SimpleErrorResponse>({ error: 'Failed to post' }, 500);
  }
});
