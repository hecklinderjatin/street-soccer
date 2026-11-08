import type { Form } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { PLAY_EVENTS, readPlayMetric } from '../../shared/playMetrics';
import { gamesDeletedKey } from './gamesPlayed';

const DAY = 86400;
const RETENTION_DAYS = 30;
const REPORT_DAYS = 7;
const dayAt = (time: number) => new Date(time).toISOString().slice(0, 10);
const keyFor = (postId: string, day: string) => `play-metrics:${postId}:${day}`;

export const playMetrics = new Hono();
playMetrics.use('*', bodyLimit({ maxSize: 1024 }));
playMetrics.post('/', async (c) => {
  const postId = context.postId;
  if (!postId) return c.body(null, 400);
  const input = readPlayMetric(await c.req.json<unknown>().catch(() => null));
  if (!input) return c.body(null, 400);
  const { event, mode, device, attempt } = input;
  const version = /^\d+(?:\.\d+){2,4}$/.test(context.appVersion)
    ? context.appVersion
    : 'unknown';
  const field = [
    version,
    device,
    mode,
    attempt?.difficulty ?? '',
    attempt?.durationSec ?? '',
    attempt ? (attempt.rematch ? 'rematch' : 'initial') : '',
    event,
  ].join(',');
  const day = dayAt(Date.now());
  const key = keyFor(postId, day);
  const deleted = gamesDeletedKey(postId);
  try {
    // Watch only the deletion marker. Concurrent increments can all commit.
    const tx = await redis.watch(deleted);
    try {
      const removed = await redis.get(deleted);
      await tx.multi();
      if (removed) {
        await tx.discard();
        return c.body(null, 204);
      }
      await tx.hIncrBy(key, field, 1);
      const secondsIntoDay = Math.floor((Date.now() - Date.parse(day)) / 1000);
      await tx.expire(key, RETENTION_DAYS * DAY - secondsIntoDay);
      await tx.exec();
    } catch (error) {
      await tx.discard().catch(() => {});
      throw error;
    }
    return c.body(null, 204);
  } catch {
    return c.body(null, 503);
  }
});

export async function forgetPlayMetrics(postId: string) {
  const now = Date.now();
  await redis.del(
    ...Array.from({ length: RETENTION_DAYS + 1 }, (_, i) =>
      keyFor(postId, dayAt(now - i * DAY * 1000))
    )
  );
}

export async function playMetricsForm(postId: string): Promise<Form> {
  const now = Date.now();
  const days = Array.from({ length: REPORT_DAYS }, (_, i) =>
    dayAt(now - i * DAY * 1000)
  );
  const counts = await Promise.all(
    days.map((day) => redis.hGetAll(keyFor(postId, day)))
  );
  const totals = new Map<string, number>();
  const rows = [
    'utc_day,post_id,build,device,mode,difficulty,duration_sec,attempt,event,count',
  ];
  counts.forEach((fields, i) => {
    for (const [field, count] of Object.entries(fields).sort()) {
      const event = field.split(',').at(-1) ?? '';
      totals.set(event, (totals.get(event) ?? 0) + Number(count));
      rows.push(`${days[i]},${postId},${field},${count}`);
    }
  });
  return {
    title: 'Street Soccer post analytics',
    description: `Last ${REPORT_DAYS} UTC days, including today. Event counts include repeat plays. Free Kick kickoff means first valid swipe and completion means the run ended.`,
    acceptLabel: 'Done',
    fields: [
      {
        name: 'totals',
        type: 'paragraph',
        label: 'Event totals',
        disabled: true,
        defaultValue: totals.size
          ? PLAY_EVENTS.map(
              (event) =>
                `${event.replaceAll('_', ' ')}: ${totals.get(event) ?? 0}`
            ).join('\n')
          : 'No analytics have been recorded for this post in this window.',
      },
      {
        name: 'csv',
        type: 'paragraph',
        label: 'Copy the daily breakdown (CSV)',
        helpText:
          'Build, device, mode, difficulty, match length and rematch. Blank settings apply to entry events or Free Kick. Edits here are discarded.',
        defaultValue: rows.join('\n'),
      },
    ],
  };
}
