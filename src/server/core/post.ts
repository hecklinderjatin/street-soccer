import { reddit } from '@devvit/web/server';
import type { Challenge } from './challengeForm';

// A Street Soccer post. With a challenge (a moderator's custom match) its
// settings are saved as the post's postData, which the splash and the game
// read from their context (client/challenge.ts); without one (the install
// post) the game plays the default match with a difficulty picker.
export const createPost = async (challenge?: Challenge) => {
  if (!challenge)
    return await reddit.submitCustomPost({ title: 'Street Soccer' });
  return await reddit.submitCustomPost({
    title: challenge.title,
    postData: { match: challenge.config, description: challenge.description },
  });
};
