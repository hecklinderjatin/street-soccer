import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostDeleteRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { forgetPost } from '../core/scoreThread';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

// A post was deleted: remove everything the app stored about it (its daily
// leaderboards and scores comment id), as the Devvit Rules require.
triggers.post('/on-post-delete', async (c) => {
  try {
    const input = await c.req.json<OnPostDeleteRequest>();
    if (input.postId) await forgetPost(input.postId);
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  } catch (error) {
    console.error(`Error forgetting a deleted post: ${error}`);
    return c.json<TriggerResponse>(
      { status: 'error', message: 'Failed to forget the post' },
      400
    );
  }
});
