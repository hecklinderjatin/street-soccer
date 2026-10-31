import assert from 'node:assert/strict';
import { createJourneyRoutes } from '../src/server/core/journeys';
import {
  createMatchJourney,
  type JourneySender,
} from '../src/client/matchJourney';
import {
  journeySettings,
  journeyResult,
  readJourneySettings,
  readJourneyResult,
  journeysEnabled,
} from '../src/shared/journeys';
import { DEFAULT_MATCH_CONFIG } from '../src/shared/matchConfig';

assert.equal(journeysEnabled, false, 'unconfigured builds default off');
const settings = journeySettings(
  { ...DEFAULT_MATCH_CONFIG, dailyMode: 'survival' },
  'daily',
  false
);
assert.equal(settings.mode, 'rampage');
assert.equal(settings.difficulty, 'rising');
assert.equal(
  journeySettings(
    { ...DEFAULT_MATCH_CONFIG, dailyMode: 'hold-lead' },
    'daily',
    false
  ).mode,
  'shield'
);
assert.equal(
  journeySettings({ ...DEFAULT_MATCH_CONFIG, mode: 'casual' }, 'daily', false)
    .mode,
  'casual'
);
assert.equal(readJourneySettings({ ...settings, mode: 'u/person' }), null);
assert.equal(readJourneySettings({ ...settings, durationSec: 99999 }), null);
assert.deepEqual(
  readJourneySettings({
    ...settings,
    username: 'private',
    teamName: 'free text',
  }),
  settings
);
const result = journeyResult(
  { ...DEFAULT_MATCH_CONFIG, dailyMode: 'survival' },
  5,
  1,
  42.4
);
assert.equal(result.outcome, 'cleared');
assert.equal(result.elapsedSec, 43);
assert.equal(
  journeyResult({ ...DEFAULT_MATCH_CONFIG, dailyMode: 'survival' }, 4, 0, 300)
    .outcome,
  'failed'
);
assert.equal(readJourneyResult({ ...result, outcome: 'anything' }), null);
assert.equal(readJourneyResult({ ...result, goalsFor: -1 }), null);
assert.equal(readJourneyResult({ ...result, elapsedSec: Infinity }), null);
assert.deepEqual(readJourneyResult({ ...result, comment: 'private' }), result);

type Transport = Parameters<typeof createJourneyRoutes>[0];
const calls: { event: string; data?: unknown }[] = [];
let denied = false,
  fail = false,
  serial = 0;
const accepted = {
  receipt: { status: 'JOURNEY_RECEIPT_VALID' as const, message: '' },
};
const sdk: Transport = {
  async appReady() {
    calls.push({ event: 'ready' });
    if (fail) throw new Error('offline');
    return accepted;
  },
  async startJourney() {
    calls.push({ event: 'start' });
    if (fail) throw new Error('offline');
    return {
      journeyId: `journey_${++serial}`,
      receipt: {
        status: denied
          ? 'JOURNEY_RECEIPT_DENIED_NOT_ALLOWLISTED'
          : 'JOURNEY_RECEIPT_VALID',
        message: '',
      },
    };
  },
  async journeyInteraction(data) {
    if (fail) throw new Error('offline');
    calls.push({ event: 'interaction', data });
    return accepted;
  },
  async endJourney(data) {
    if (fail) throw new Error('offline');
    calls.push({ event: 'end', data });
    return accepted;
  },
};
const routes = createJourneyRoutes(sdk, true, () => true);
const request = (path: string, body: unknown, target = routes) =>
  target.request(`http://local${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
for (const target of [
  createJourneyRoutes(sdk, false, () => true),
  createJourneyRoutes(sdk, true, () => false),
]) {
  assert.equal((await request('/ready', {}, target)).status, 204);
  assert.equal((await request('/start', settings, target)).status, 204);
}
assert.equal(calls.length, 0, 'disabled/no Reddit context never calls SDK');
assert.equal((await request('/ready', {})).status, 204);
assert.deepEqual(
  calls.map((v) => v.event),
  ['ready'],
  'ready never starts a journey'
);
calls.length = 0;
assert.equal(
  (await request('/start', { ...settings, mode: 'arbitrary text' })).status,
  400
);
assert.equal(
  (await request('/end', { ...result, journeyId: 'bad/id' })).status,
  400
);
assert.equal(
  (await request('/start', { payload: 'x'.repeat(3000) })).status,
  413
);
assert.equal(calls.length, 0);
denied = true;
assert.deepEqual(await (await request('/start', settings)).json(), {
  journeyId: '',
});
assert.deepEqual(
  calls.map((v) => v.event),
  ['start'],
  'not allowlisted: no follow-up events'
);
denied = false;
fail = true;
assert.equal(
  (await request('/start', settings)).status,
  204,
  'SDK outage returns an empty nonblocking response'
);
fail = false;
calls.length = 0;
const send: JourneySender = async (path, body) => {
  const response = await request(path, body);
  return response.status === 204 ? null : response.json();
};
const flush = async () => {
  for (let i = 0; i < 20; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
};
const match = createMatchJourney(settings, send);
await flush();
assert.equal(
  calls.length,
  0,
  'constructing a match/preview does not start tracking'
);
match.start();
match.start();
match.end(result);
match.end(result);
await flush();
assert.deepEqual(
  calls.map((v) => v.event),
  ['start', 'interaction', 'interaction', 'end']
);
const startMetadata = JSON.parse(
  Reflect.get(calls[1]?.data ?? {}, 'actionDetails')
);
assert.deepEqual(startMetadata, settings);
assert.equal(Reflect.get(calls[3]?.data ?? {}, 'complete'), true);
assert.deepEqual(Reflect.get(calls[3]?.data ?? {}, 'game'), {
  win: true,
  score: 5,
});
const quit = createMatchJourney({ ...settings, rematch: true }, send);
quit.start();
quit.end({ ...result, outcome: 'quit' });
await flush();
assert.equal(Reflect.get(calls[5]?.data ?? {}, 'action'), 'rematch_started');
assert.equal(Reflect.get(calls[7]?.data ?? {}, 'complete'), false);
assert.equal(Reflect.get(calls[7]?.data ?? {}, 'game'), undefined);
assert.notEqual(
  Reflect.get(calls[7]?.data ?? {}, 'journeyId'),
  Reflect.get(calls[3]?.data ?? {}, 'journeyId')
);

// Delayed old start responses must retain their own end, even after a rematch.
const ends: unknown[] = [];
let release: (value: unknown) => void = () => {};
const delayed: JourneySender = (path, body) =>
  path === '/start'
    ? new Promise((resolve) => {
        release = resolve;
      })
    : Promise.resolve(ends.push(body));
const old = createMatchJourney(settings, delayed);
old.start();
old.end(result);
await flush();
const next = createMatchJourney(settings, send);
next.start();
next.end(result);
await flush();
release({ journeyId: 'old_match' });
await flush();
assert.equal(Reflect.get(ends[0] ?? {}, 'journeyId'), 'old_match');
const neverStarted = createMatchJourney(settings, send);
const before = calls.length;
neverStarted.end(result);
await flush();
assert.equal(calls.length, before);
const unavailable = createMatchJourney(settings, async () => {
  throw new Error('network');
});
unavailable.start();
unavailable.end(result);
await flush(); // no rejection escapes
const neverResponds = createMatchJourney(settings, () => new Promise(() => {}));
neverResponds.start();
neverResponds.end(result); // returns immediately
console.log(
  'Journeys passed: default-off, DTO privacy, Hono/SDK integration, denial/outage, single-end, rematch IDs, delayed starts and explicit quits'
);
