import { Hono, type Context } from 'hono';
import { reddit } from '@devvit/web/server';
import type {
  PlaygroundSaveResponse,
  PlaygroundSavesResponse,
  PlaygroundShareResponse,
} from '../../shared/api';
import {
  PlaygroundError,
  deletePlayground,
  playgroundSaves,
  savePlayground,
  sharePlayground,
} from '../core/playground';
import { deletionInProgress } from '../core/privacy';

// The Free Kick Playground: a player's saved kicks, and sharing one as a post.
export const playgroundApi = new Hono();

type Handler = (username: string, body: unknown) => Promise<object>;
const route = (handler: Handler) => async (c: Context) => {
  c.header('Cache-Control', 'no-store');
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) return c.json({ error: 'Log in to use the Playground' }, 401);
    if (await deletionInProgress(username))
      return c.json({ error: 'Please retry shortly' }, 429);
    const body: unknown = c.req.method === 'GET' ? {} : await c.req.json();
    return c.json(await handler(username, body));
  } catch (error) {
    if (error instanceof PlaygroundError)
      return c.json({ error: error.message }, error.status);
    console.error('Playground request failed:', error);
    return c.json({ error: 'Playground unavailable. Please retry.' }, 503);
  }
};
const field = (body: unknown, key: string): unknown =>
  typeof body === 'object' && body !== null ? Reflect.get(body, key) : undefined;

playgroundApi.get(
  '/saves',
  route(
    async (username): Promise<PlaygroundSavesResponse> => ({
      saves: await playgroundSaves(username),
    })
  )
);
playgroundApi.post(
  '/save',
  route(
    async (username, body): Promise<PlaygroundSaveResponse> =>
      savePlayground(username, field(body, 'setup'), field(body, 'slot'))
  )
);
playgroundApi.post(
  '/delete',
  route(
    async (username, body): Promise<PlaygroundSavesResponse> => ({
      saves: await deletePlayground(username, field(body, 'slot')),
    })
  )
);
playgroundApi.post(
  '/share',
  route(
    async (username, body): Promise<PlaygroundShareResponse> => ({
      url: await sharePlayground(username, field(body, 'setup')),
    })
  )
);
