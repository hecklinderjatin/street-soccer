import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import { parseMatchConfig } from '../../shared/matchConfig';
import {
  CHALLENGE_FORM,
  challengeFormFor,
  challengeFormData,
  readChallenge,
  type ChallengeValues,
} from '../core/challengeForm';
import { parsePostType, POST_TYPE_LABEL } from '../../shared/postType';
import { createPost } from '../core/post';
import { forgetPlayer } from '../core/privacy';

export const forms = new Hono();

forms.post('/delete-data', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username)
      return c.json<UiResponse>({ showToast: 'Log in to delete your data' });
    const body: unknown = await c.req.json();
    if (
      !body ||
      typeof body !== 'object' ||
      Reflect.get(body, 'confirmed') !== true
    )
      return c.json<UiResponse>({
        showToast: 'Check the confirmation box to delete your data',
      });
    await forgetPlayer(username);
    return c.json<UiResponse>({
      showToast:
        'Your saved leaderboard results in this subreddit were deleted. Refresh the game to update the display.',
    });
  } catch (error) {
    console.error('Player data deletion failed:', error);
    return c.json<UiResponse>({
      showToast:
        'Deletion could not finish. Please retry or contact the subreddit moderators.',
    });
  }
});

// Moderators can create posts with fixed match settings.
const isModerator = async () => {
  const user = await reddit.getCurrentUser();
  if (!user || !context.subredditName) return false;
  const permissions = await user.getModPermissionsForSubreddit(
    context.subredditName
  );
  return permissions.length > 0;
};

forms.post('/match-type', async (c) => {
  try {
    if (!(await isModerator()))
      return c.json<UiResponse>({
        showToast: 'Only moderators can create matches',
      });
    const values = await c.req.json<ChallengeValues>();
    const type = parsePostType(values.matchType?.[0]);
    if (!type)
      return c.json<UiResponse>({ showToast: 'Choose a valid match type' });
    return c.json<UiResponse>({
      showForm: {
        name: CHALLENGE_FORM,
        form: challengeFormFor(type),
        data: challengeFormData({
          matchType: [type],
          title: `Street Soccer ${POST_TYPE_LABEL[type].toLowerCase()}`,
        }),
      },
    });
  } catch (error) {
    console.error('Could not open match form:', error);
    return c.json<UiResponse>(
      { showToast: 'Could not open the match form. Please try again.' },
      400
    );
  }
});

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
            form: challengeFormFor(
              parsePostType(values.matchType?.[0]) ?? 'daily'
            ),
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
