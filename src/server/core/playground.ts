import { reddit, redis } from '@devvit/web/server';
import type { PlaygroundSave } from '../../shared/api';
import {
  parseCustomSetup,
  isLegacyPlaygroundDescription,
  PLAYGROUND_DESCRIPTION,
  type CustomSetup,
} from '../../shared/freeKickCustom';
import { FREE_KICK as FK } from '../../shared/tuning';
import { scoreThread } from './scoreThread';

// A player's saved Playground kicks: one hash per player, a field per slot,
// deleted FK.customSaveDays after the last save and on a data deletion
// request (privacy.ts forgetPlayer).
export const playgroundSavesKey = (username: string) =>
  `playground:saves:${username}`;
export const PLAYGROUND_OWNERS = 'privacy:playground-owners';
export const playgroundCooldownKey = (username: string) =>
  `cooldown:playground:${username}`;
// Shares today (UTC), at most FK.customSharesPerDay; kept two days.
export const playgroundSharesKey = (username: string, day = today()) =>
  `playground:shares:${username}:${day}`;
const today = () => new Date().toISOString().slice(0, 10);

export async function cleanPlaygroundDescription(
  postId: `t3_${string}`,
  subredditName: string
) {
  const post = await reddit.getPostById(postId);
  if (post.subredditName.toLowerCase() !== subredditName.toLowerCase())
    return false;
  const data = await post.getPostData();
  const kick = data?.freeKick;
  if (
    data?.matchType !== 'freekick' ||
    !kick ||
    typeof kick !== 'object' ||
    Reflect.get(kick, 'mode') !== 'custom' ||
    !isLegacyPlaygroundDescription(data.description)
  )
    return false;
  await post.mergePostData({ description: PLAYGROUND_DESCRIPTION });
  return true;
}

export class PlaygroundError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 429 = 400
  ) {
    super(message);
  }
}

export async function playgroundSaves(
  username: string
): Promise<PlaygroundSave[]> {
  const fields = await redis.hGetAll(playgroundSavesKey(username));
  const saves: PlaygroundSave[] = [];
  for (const [field, value] of Object.entries(fields)) {
    const slot = Number(field);
    if (!Number.isInteger(slot) || slot < 0 || slot >= FK.customSaveSlots)
      continue;
    try {
      const raw: unknown = JSON.parse(value);
      if (typeof raw !== 'object' || raw === null) continue;
      const setup = parseCustomSetup(Reflect.get(raw, 'setup'), true);
      const savedAt: unknown = Reflect.get(raw, 'savedAt');
      if (typeof setup === 'string' || typeof savedAt !== 'number') continue;
      saves.push({ slot, setup, savedAt });
    } catch {
      // an unreadable slot reads as empty and is overwritten by the next save
    }
  }
  return saves.sort((a, b) => b.savedAt - a.savedAt);
}

// Saves into `slot`, or the first free slot when none is given.
export async function savePlayground(
  username: string,
  raw: unknown,
  slot: unknown
) {
  const setup = parseCustomSetup(raw, true);
  if (typeof setup === 'string') throw new PlaygroundError(setup);
  const key = playgroundSavesKey(username);
  const guard = `privacy:deleting:${username}`;
  const retentionSec = FK.customSaveDays * 86_400;
  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await redis.watch(key, guard);
    let queued = false;
    try {
      if (await redis.get(guard))
        throw new PlaygroundError('Please retry shortly', 429);
      const saves = await playgroundSaves(username);
      const target =
        typeof slot === 'number' &&
        Number.isInteger(slot) &&
        slot >= 0 &&
        slot < FK.customSaveSlots
          ? slot
          : Array.from({ length: FK.customSaveSlots }, (_, i) => i).find(
              (i) => !saves.some((save) => save.slot === i)
            );
      if (target === undefined)
        throw new PlaygroundError(
          `All ${FK.customSaveSlots} save slots are full. Delete one first.`
        );
      const savedAt = Date.now();
      await tx.multi();
      queued = true;
      await tx.hSet(key, {
        [String(target)]: JSON.stringify({ setup, savedAt }),
      });
      await tx.expire(key, retentionSec);
      await tx.zAdd(PLAYGROUND_OWNERS, {
        member: username,
        score: savedAt + retentionSec * 1000,
      });
      if ((await tx.exec()).length === 3)
        return { slot: target, saves: await playgroundSaves(username) };
    } catch (error) {
      if (!queued) await tx.multi().catch(() => {});
      await tx.discard().catch(() => {});
      throw error;
    }
  }
  throw new PlaygroundError('Saves are busy. Please retry.', 429);
}

export async function deletePlayground(username: string, slot: unknown) {
  if (typeof slot !== 'number' || !Number.isInteger(slot))
    throw new PlaygroundError('Invalid save slot');
  await redis.hDel(playgroundSavesKey(username), [String(slot)]);
  return playgroundSaves(username);
}

// Posts the kick to the current community as the player.
export async function sharePlayground(username: string, raw: unknown) {
  const setup: CustomSetup | string = parseCustomSetup(raw);
  if (typeof setup === 'string') throw new PlaygroundError(setup);
  const key = playgroundCooldownKey(username);
  if (await redis.get(key))
    throw new PlaygroundError(
      'You shared a kick recently. Try again in a few minutes.',
      429
    );
  // A daily cap per player: count first, give the share back if over.
  const shares = playgroundSharesKey(username);
  const count = await redis.incrBy(shares, 1);
  await redis.expire(shares, 2 * 86_400);
  if (count > FK.customSharesPerDay) {
    await redis.incrBy(shares, -1);
    throw new PlaygroundError(
      `You can share ${FK.customSharesPerDay} kicks a day. Try again tomorrow (UTC).`,
      429
    );
  }
  await redis.set(key, '1', {
    expiration: new Date(Date.now() + FK.customShareCooldownSec * 1000),
  });
  const freeKick = {
    mode: 'custom',
    custom: setup.kick,
    kicker: setup.kicker,
    wall: setup.wall,
  };
  try {
    const post = await reddit.submitCustomPost({
      title: setup.title,
      runAs: 'USER',
      userGeneratedContent: {
        text: ['freekick', setup.title, JSON.stringify(freeKick)].join('\n\n'),
      },
      postData: {
        matchType: 'freekick',
        freeKick,
        description: PLAYGROUND_DESCRIPTION,
      },
    });
    try {
      await scoreThread(post.id);
    } catch (error) {
      console.warn('Could not create the scores comment:', error);
    }
    return post.url;
  } catch (error) {
    await redis.del(key);
    await redis.incrBy(shares, -1); // a failed post uses no share
    throw error;
  }
}
