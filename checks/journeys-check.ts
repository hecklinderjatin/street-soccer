import {
  freeKickJourneySettings,
  freeKickJourneyResult,
} from '../src/shared/freeKickJourneys';
import { FREE_KICK_CHALLENGE_DEFAULT } from '../src/shared/freeKickChallenge';
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

assert.equal(
  journeysEnabled,
  false,
  'non-Vite test bundles safely omit telemetry'
);
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
// Free Kick uses no match clock and bounded numeric settings only.
const fk = freeKickJourneySettings(
  FREE_KICK_CHALLENGE_DEFAULT,
  false,
  3,
  false
);
assert.equal(fk.mode, 'freekick-challenge');
assert.equal(fk.durationSec, 0);
assert.deepEqual(
  readJourneySettings({ ...fk, username: 'private', kit: 'pink' }),
  fk
);
assert.equal(readJourneySettings({ ...fk, durationSec: 60 }), null);
assert.equal(readJourneySettings({ ...fk, level: 11 }), null);
const practice = freeKickJourneySettings(
  FREE_KICK_CHALLENGE_DEFAULT,
  true,
  7,
  true
);
assert.deepEqual(readJourneySettings(practice), practice);
assert.equal(readJourneySettings({ ...practice, lives: 3 }), null);
const cleared = freeKickJourneyResult(false, true, 5, 7, 2400, 600.2, false);
assert.deepEqual(readJourneyResult(cleared), cleared);
assert.equal(cleared.outcome, 'cleared');
assert.equal(cleared.elapsedSec, 601);
assert.equal(
  freeKickJourneyResult(false, false, 1, 4, 300, 400, false).outcome,
  'failed'
);
assert.equal(readJourneyResult({ ...cleared, mode: 'classic' }), null);
assert.equal(
  readJourneyResult({ ...result, elapsedSec: 601 }),
  null,
  'normal match bounds stay unchanged'
);
assert.equal(readJourneyResult({ ...cleared, points: Infinity }), null);
const practiceQuit = freeKickJourneyResult(
  true,
  false,
  120,
  200,
  25000,
  3600,
  true
);
assert.deepEqual(readJourneyResult(practiceQuit), practiceQuit);
assert.equal(readJourneyResult({ ...practiceQuit, outcome: 'cleared' }), null);
const fkAttempt = createMatchJourney(fk, send);
const initialCalls = calls.length;
fkAttempt.start();
fkAttempt.start();
await flush();
fkAttempt.end(cleared);
fkAttempt.end(cleared);
await flush();
const fkEnd = calls.slice(initialCalls).find((c) => c.event === 'end');
assert.ok(fkEnd);
assert.equal(Reflect.get(fkEnd.data ?? {}, 'complete'), true);
assert.equal(
  Reflect.get(Reflect.get(fkEnd.data ?? {}, 'game') ?? {}, 'score'),
  2400
);
const practiceAttempt = createMatchJourney(practice, send);
const practiceCalls = calls.length;
practiceAttempt.start();
await flush();
practiceAttempt.end(practiceQuit);
await flush();
const practiceEnd = calls.slice(practiceCalls).find((c) => c.event === 'end');
assert.ok(practiceEnd);
assert.equal(Reflect.get(practiceEnd.data ?? {}, 'complete'), false);
assert.equal(Reflect.get(practiceEnd.data ?? {}, 'game'), undefined);
const infinityConfig: typeof FREE_KICK_CHALLENGE_DEFAULT = {
  ...FREE_KICK_CHALLENGE_DEFAULT,
  mode: 'infinity',
  goals: 0,
  difficulty: 'easy',
};
const infinitySettings = freeKickJourneySettings(
  infinityConfig,
  false,
  2,
  false
);
assert.equal(infinitySettings.mode, 'freekick-infinity');
assert.deepEqual(readJourneySettings(infinitySettings), infinitySettings);
const infinityResult = freeKickJourneyResult(
  false,
  false,
  20,
  22,
  12000,
  400,
  false,
  true
);
assert.equal(infinityResult.outcome, 'completed');
assert.deepEqual(readJourneyResult(infinityResult), infinityResult);
assert.equal(readJourneyResult({ ...infinityResult, outcome: 'failed' }), null);
assert.equal(readJourneySettings({ ...infinitySettings, lives: 0 }), null);
const infJourney = createMatchJourney(infinitySettings, send);
const beforeInf = calls.length;
infJourney.start();
infJourney.end(infinityResult);
await flush();
const infEnd = calls.slice(beforeInf).find((c) => c.event === 'end');
assert.ok(infEnd);
assert.equal(Reflect.get(infEnd.data ?? {}, 'complete'), true);
assert.deepEqual(Reflect.get(infEnd.data ?? {}, 'game'), {
  win: false,
  score: 12000,
});
console.log(
  'Journeys passed: disabled gate, DTO privacy, Hono/SDK integration, denial/outage, single-end, rematch IDs, delayed starts and explicit quits'
);
