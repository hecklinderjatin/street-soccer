import { Hono } from 'hono';
import { privacyForm } from '../core/privacyForm';
import type { UiResponse } from '@devvit/web/shared';
import { MATCH_TYPE_FORM, matchTypeForm } from '../core/challengeForm';
import { context } from '@devvit/web/server';
import { playMetricsForm } from '../core/playMetrics';
import { isModerator } from './forms';
import { cleanPlaygroundDescription } from '../core/playground';

export const menu = new Hono();

menu.post('/clean-playground-description', async (c) => {
  c.header('Cache-Control', 'no-store');
  try {
    if (!context.postId || !context.subredditName || !(await isModerator()))
      return c.json<UiResponse>({
        showToast: 'Only moderators can clean up Playground posts',
      });
    const updated = await cleanPlaygroundDescription(
      context.postId,
      context.subredditName
    );
    return c.json<UiResponse>({
      showToast: updated
        ? 'Removed the copied username from the Playground description'
        : 'No old Playground description to clean up',
    });
  } catch {
    return c.json<UiResponse>({
      showToast: 'Could not update the Playground description. Please retry.',
    });
  }
});

menu.post('/play-metrics', async (c) => {
  c.header('Cache-Control', 'no-store');
  try {
    if (!context.postId || !(await isModerator()))
      return c.json<UiResponse>({
        showToast: 'Only moderators can view post analytics',
      });
    return c.json<UiResponse>({
      showForm: {
        name: 'playMetricsForm',
        form: await playMetricsForm(context.postId),
      },
    });
  } catch {
    return c.json<UiResponse>({
      showToast: 'Post analytics are temporarily unavailable',
    });
  }
});

menu.post('/delete-data', (c) =>
  c.json<UiResponse>({
    showForm: { name: 'deleteDataForm', form: privacyForm },
  })
);

// Moderators only (devvit.json): opens the match settings form; the post is
// created when it is submitted (routes/forms.ts).
menu.post('/post-create', (c) =>
  c.json<UiResponse>(
    {
      showForm: {
        name: MATCH_TYPE_FORM,
        form: matchTypeForm,
      },
    },
    200
  )
);
