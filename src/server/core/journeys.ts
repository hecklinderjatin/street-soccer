import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { TelemetryClient } from '@devvit/analytics/server/reddit';
import {
  readJourneyId,
  readJourneyResult,
  readJourneySettings,
} from '../../shared/journeys';

type Transport = Pick<
  TelemetryClient,
  'appReady' | 'startJourney' | 'journeyInteraction' | 'endJourney'
>;
// Hono adapter with a deliberately smaller vocabulary than the generic SDK
// router. App-supplied identity, arbitrary actions and free text are discarded.
export function createJourneyRoutes(
  sdk: Transport,
  enabled: boolean,
  hasContext: () => boolean
) {
  const routes = new Hono();
  routes.onError((_error, c) => c.body(null, 204));
  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    if (!enabled || !hasContext()) return c.body(null, 204);
    if (Number(c.req.header('content-length')) > 2048) return c.body(null, 413);
    try {
      await next();
    } catch {
      return c.body(null, 204);
    }
  });
  routes.use(
    '*',
    bodyLimit({ maxSize: 2048, onError: (c) => c.body(null, 413) })
  );
  routes.post('/ready', async (c) => {
    await sdk.appReady();
    return c.body(null, 204);
  });
  routes.post('/start', async (c) => {
    const settings = readJourneySettings(await c.req.json());
    if (!settings) return c.body(null, 400);
    const response = await sdk.startJourney();
    if (
      response.receipt.status !== 'JOURNEY_RECEIPT_VALID' ||
      !readJourneyId(response.journeyId)
    )
      return c.json({ journeyId: '' });
    // An optional metadata failure must not lose a successfully started ID.
    await sdk
      .journeyInteraction({
        journeyId: response.journeyId,
        action: settings.rematch ? 'rematch_started' : 'match_started',
        actionDetails: JSON.stringify(settings),
      })
      .catch(() => {});
    return c.json({ journeyId: response.journeyId });
  });
  routes.post('/end', async (c) => {
    const body: unknown = await c.req.json();
    const result = readJourneyResult(body);
    const journeyId =
      body && typeof body === 'object'
        ? readJourneyId(Reflect.get(body, 'journeyId'))
        : null;
    if (!result || !journeyId) return c.body(null, 400);
    await sdk
      .journeyInteraction({
        journeyId,
        action: result.outcome === 'quit' ? 'match_quit' : 'match_completed',
        actionDetails: JSON.stringify(result),
      })
      .catch(() => {});
    await sdk.endJourney({
      journeyId,
      complete: result.outcome !== 'quit',
      ...(result.outcome === 'quit'
        ? {}
        : {
            game: {
              win: result.outcome === 'win' || result.outcome === 'cleared',
              score: result.goalsFor,
            },
          }),
    });
    return c.body(null, 204);
  });
  return routes;
}
