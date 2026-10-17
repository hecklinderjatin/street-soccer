import { context, reddit, redis } from '@devvit/web/server';
import { removePlayerResults, removeUnavailableAccounts } from './privacyData';

export const RETENTION_SEC = 8 * 24 * 60 * 60;
const BOARDS = 'privacy:boards';
const deletingKey = (username: string) => `privacy:deleting:${username}`;

export const deletionInProgress = async (username: string) =>
  Boolean(await redis.get(deletingKey(username)));

// Register before writing any player data. Members contain only board IDs.
export async function registerBoard(board: string) {
  await redis.zAdd(BOARDS, {
    member: board,
    score: Date.now() + RETENTION_SEC * 1000,
  });
}

// Older versions did not index their boards. Discover their app-authored
// posts before reporting a deletion as complete. Fail closed at Reddit's
// listing cap rather than silently claiming an incomplete deletion succeeded.
async function migrateLegacyBoards() {
  if (await redis.get('privacy:legacy-indexed')) return;
  const app = await reddit.getAppUser();
  if (!app) throw new Error('Cannot discover legacy game posts');
  const posts = await reddit
    .getPostsByUser({
      username: app.username,
      sort: 'new',
      limit: 1000,
      pageSize: 100,
    })
    .all();
  if (posts.length >= 1000)
    throw new Error('Legacy post history needs administrator migration');
  for (const post of posts) {
    if (
      post.subredditName.toLowerCase() !== context.subredditName.toLowerCase()
    )
      continue;
    for (let back = 0; back <= 9; back++) {
      const day = new Date(Date.now() - back * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const board = `daily:${post.id}:${day}`;
      if (await redis.zCard(board)) await registerBoard(board);
    }
  }
  await redis.set('privacy:legacy-indexed', '1');
}

async function activeBoards() {
  await migrateLegacyBoards();
  await redis.zRemRangeByScore(BOARDS, 0, Date.now());
  return redis.zRange(BOARDS, 0, -1, { by: 'rank' });
}

export async function forgetPlayer(username: string) {
  // Also blocks a match completion racing with the deletion request.
  await redis.set(deletingKey(username), '1', {
    expiration: new Date(Date.now() + 60_000),
  });
  await removePlayerResults(
    redis,
    (await activeBoards()).map((b) => b.member),
    username
  );
}

// One board page per tick; the cursor rotates fairly through all boards.
// An unavailable Reddit API is an error, never evidence of account deletion.
export async function cleanupDeletedAccounts() {
  const boards = await activeBoards();
  if (!boards.length) return;
  const index =
    Number((await redis.get('privacy:board-index')) ?? 0) % boards.length;
  const board = boards[index]?.member;
  if (!board) return;
  const cursorKey = `privacy:cursor:${board}`;
  const cursor = Number((await redis.get(cursorKey)) ?? 0);
  const page = await redis.zScan(board, cursor, undefined, 25);
  await removeUnavailableAccounts(
    page.members.map((entry) => entry.member),
    async (username) => Boolean(await reddit.getUserByUsername(username)),
    forgetPlayer
  );
  await redis.set(cursorKey, String(page.cursor), {
    expiration: new Date(Date.now() + RETENTION_SEC * 1000),
  });
  if (page.cursor === 0)
    await redis.set('privacy:board-index', String((index + 1) % boards.length));
}
