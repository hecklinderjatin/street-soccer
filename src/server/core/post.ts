import { reddit } from '@devvit/web/server';
import { DAILY_LABEL, dailyObjective } from '../../shared/dailyMode';
import { FREE_KICK_CHALLENGE_DEFAULT } from '../../shared/freeKickChallenge';
import type { Challenge } from './challengeForm';
import { gamePostFallback, playgroundPostFallback } from './postFallback';
import { scoreThread } from './scoreThread';

function postFallback(challenge?: Challenge) {
  switch (challenge?.matchType) {
    case 'daily': {
      const mode = challenge.config.dailyMode;
      return gamePostFallback(
        mode ? `Daily Challenge · ${DAILY_LABEL[mode]}` : 'Daily Challenge',
        dailyObjective(challenge.config) || 'Outscore the AI in a 5v5 match.',
        'Play Challenge'
      );
    }
    case 'casual':
      return gamePostFallback(
        'Custom Match',
        'Choose your kits, formations, difficulty and match length, then try to beat the AI.',
        'Play Custom'
      );
    case 'freekick': {
      const kick = challenge.freeKick ?? FREE_KICK_CHALLENGE_DEFAULT;
      const lives = `${kick.lives} ${kick.lives === 1 ? 'life' : 'lives'}`;
      if (kick.mode === 'custom' && kick.custom)
        return playgroundPostFallback(kick.custom.distanceM);
      if (kick.mode === 'infinity')
        return gamePostFallback(
          'Free Kick Infinity',
          `Start with ${lives} and score as many free kicks as you can before you run out.`,
          'Play Infinity'
        );
      return gamePostFallback(
        'Free Kick Challenge',
        `Score ${kick.goals} ${kick.goals === 1 ? 'goal' : 'goals'} before losing all ${lives}.`,
        'Play Challenge'
      );
    }
    default:
      return gamePostFallback(
        'Classic',
        'Outscore the AI in a 5v5 street football match.',
        'Play Classic'
      );
  }
}

// A Street Soccer post. With a challenge (a moderator's custom match) its
// settings are saved as the post's postData, which the splash and the game
// read from their context (client/challenge.ts); without one (the install
// post) the game plays the default Classic match. Casual posts have no ranked scores.
export const createPost = async (challenge?: Challenge, flairId?: string) => {
  const textFallback = postFallback(challenge);
  const post = challenge
    ? await reddit.submitCustomPost({
        title: challenge.title,
        textFallback,
        runAs: 'USER',
        ...(flairId ? { flairId } : {}),
        userGeneratedContent: {
          text: [
            challenge.matchType,
            challenge.title,
            challenge.description,
            JSON.stringify(
              challenge.matchType === 'freekick'
                ? (challenge.freeKick ?? {})
                : challenge.config
            ),
          ].join('\n\n'),
        },
        postData: {
          matchType: challenge.matchType,
          ...(challenge.matchType === 'freekick'
            ? challenge.freeKick
              ? { freeKick: challenge.freeKick }
              : {}
            : { match: challenge.config }),
          description: challenge.description,
        },
      })
    : await reddit.submitCustomPost({ title: 'Street Soccer', textFallback });
  // The stickied comment score-only shares reply to (Devvit Rules).
  try {
    if (challenge?.matchType !== 'casual') await scoreThread(post.id);
  } catch (error) {
    console.warn('Could not create the scores comment:', error);
  }
  return post;
};
