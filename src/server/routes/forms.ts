import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import { parseMatchConfig } from '../../shared/matchConfig';
import {
  CHALLENGE_FORM,
  challengeForm,
  challengeFormData,
  readChallenge,
  type ChallengeValues,
} from '../core/challengeForm';
import { createPost } from '../core/post';

export const forms = new Hono();

// Moderators can create posts with fixed match settings.
const isModerator = async () => {
  const user = await reddit.getCurrentUser();
  if (!user || !context.subredditName) return false;
  const permissions = await user.getModPermissionsForSubreddit(
    context.subredditName
  );
  return permissions.length > 0;
};

// The match settings form (menu: Create Street Soccer match). Invalid
// answers reopen the form with them filled in and the reason in a toast.
forms.post('/challenge-submit', async (c) => {
  try {
    if (!(await isModerator()))
      return c.json<UiResponse>(
        { showToast: 'Only moderators can create matches' },
        200
      );
    const values = await c.req.json<ChallengeValues>();
    const challenge = readChallenge(values, parseMatchConfig);
    if (typeof challenge === 'string')
      return c.json<UiResponse>(
        {
          showToast: challenge,
          showForm: {
            name: CHALLENGE_FORM,
            form: challengeForm,
            data: challengeFormData(values),
          },
        },
        200
      );
    const post = await createPost(challenge);
    return c.json<UiResponse>(
      {
        showToast: { text: 'Match created', appearance: 'success' },
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating match post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});
