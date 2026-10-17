import { reddit } from '@devvit/web/server';
import type { Challenge } from './challengeForm';
import { scoreThread } from './scoreThread';

// A Street Soccer post. With a challenge (a moderator's custom match) its
// settings are saved as the post's postData, which the splash and the game
// read from their context (client/challenge.ts); without one (the install
// post) the game plays the default match with a difficulty picker.
export const createPost = async (challenge?: Challenge) => {
  const post = challenge
    ? await reddit.submitCustomPost({
        title: challenge.title,
        postData: {
          match: challenge.config,
          description: challenge.description,
        },
      })
    : await reddit.submitCustomPost({ title: 'Street Soccer' });
  // The stickied comment score-only shares reply to (Devvit Rules).
  try {
    await scoreThread(post.id);
  } catch (error) {
    console.warn('Could not create the scores comment:', error);
  }
  return post;
};
