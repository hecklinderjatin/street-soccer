import { Hono } from 'hono';
import { privacyForm } from '../core/privacyForm';
import type { UiResponse } from '@devvit/web/shared';
import { MATCH_TYPE_FORM, matchTypeForm } from '../core/challengeForm';

export const menu = new Hono();

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
