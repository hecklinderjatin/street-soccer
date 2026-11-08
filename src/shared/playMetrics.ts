import { JOURNEY_MODES, type JourneySettings } from './journeys';
import { DIFFICULTIES } from './types';
import { DURATION_CHOICES } from './matchConfig';

export const PLAY_MODES = [...JOURNEY_MODES, 'freekick'] as const;
export const PLAY_DEVICES = ['android', 'ios', 'desktop', 'other'] as const;
export const PLAY_EVENTS = [
  'play_tap',
  'ready',
  'ready_under_2s',
  'ready_2_to_5s',
  'ready_over_5s',
  'load_failed',
  'kickoff',
  'first_shot',
  'first_goal',
  'completed',
  'quit',
  'rematch_tap',
  'share_tap',
  'share_succeeded',
] as const;

export type PlayMode = (typeof PLAY_MODES)[number];
export type PlayEvent = (typeof PLAY_EVENTS)[number];
export type PlayAttempt = Pick<
  JourneySettings,
  'difficulty' | 'durationSec' | 'rematch'
>;

export function readPlayMetric(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const event = PLAY_EVENTS.find((item) => item === Reflect.get(body, 'event'));
  const mode = PLAY_MODES.find((item) => item === Reflect.get(body, 'mode'));
  const device = PLAY_DEVICES.find(
    (item) => item === Reflect.get(body, 'device')
  );
  if (!event || !mode || !device) return null;
  const input: unknown = Reflect.get(body, 'attempt');
  if (input === undefined) return { event, mode, device };
  if (!input || typeof input !== 'object' || mode === 'freekick') return null;
  const difficulty = [...DIFFICULTIES, 'rising'].find(
    (item) => item === Reflect.get(input, 'difficulty')
  );
  const durationSec = DURATION_CHOICES.find(
    (item) => item === Reflect.get(input, 'durationSec')
  );
  const rematch: unknown = Reflect.get(input, 'rematch');
  if (!difficulty || durationSec === undefined || typeof rematch !== 'boolean')
    return null;
  return { event, mode, device, attempt: { difficulty, durationSec, rematch } };
}
