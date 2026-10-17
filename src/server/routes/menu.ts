import { Hono } from 'hono';
import { privacyForm } from '../core/privacyForm';
import type { UiResponse } from '@devvit/web/shared';
import {
  CHALLENGE_FORM,
  challengeForm,
  challengeFormData,
} from '../core/challengeForm';

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
        name: CHALLENGE_FORM,
        form: challengeForm,
        data: challengeFormData(),
      },
    },
    200
  )
);
