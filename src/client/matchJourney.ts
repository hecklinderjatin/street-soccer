import type { JourneySettings, JourneyResult } from '../shared/journeys';
import { readJourneyId } from '../shared/journeys';

export type JourneySender = (path: string, body: unknown) => Promise<unknown>;
// Each attempt owns its ID and pending start. A slow reply can never attach an
// old match's end to a rematch. No persistent storage and no implicit starts.
export function createMatchJourney(
  settings: JourneySettings,
  send: JourneySender
) {
  let started = false,
    ended = false;
  let pending: Promise<string | null> | null = null;
  return {
    start() {
      if (started || ended) return;
      started = true;
      pending = Promise.resolve()
        .then(() => send('/start', settings))
        .then((response) =>
          response && typeof response === 'object'
            ? readJourneyId(Reflect.get(response, 'journeyId'))
            : null
        )
        .catch(() => null);
    },
    end(result: JourneyResult) {
      if (!started || ended) return;
      ended = true;
      void pending
        ?.then(async (journeyId) => {
          if (journeyId) await send('/end', { journeyId, ...result });
        })
        .catch(() => {});
    },
  };
}
