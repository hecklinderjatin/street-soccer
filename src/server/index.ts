import { telemetry } from '@devvit/analytics/server/reddit';
import { journeysEnabled } from '../shared/journeys';
import { createJourneyRoutes } from './core/journeys';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort, context } from '@devvit/web/server';
import { api } from './routes/api';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';
import { cleanupDeletedAccounts } from './core/privacy';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);
internal.post('/scheduler/privacy-cleanup', async (c) => {
  await cleanupDeletedAccounts();
  return c.json({ status: 'success' });
});

app.route(
  '/api/journeys',
  createJourneyRoutes(telemetry, journeysEnabled, () => Boolean(context.postId))
);
app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
