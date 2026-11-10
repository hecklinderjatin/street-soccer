import { withoutDailyMode } from '../shared/dailyMode';
import { postFreeKickChallenge } from '../shared/freeKickChallenge';
import { postType } from '../shared/postType';
import { context } from '@devvit/web/client';
import { DEFAULT_MATCH_CONFIG, parseMatchConfig } from '../shared/matchConfig';
import type { MatchConfig } from '../shared/types';

// The custom match a moderator saved on this post (its postData, written by
// server/core/post.ts), so the splash and the game read it without a
// request. A post without one (older posts, a local preview: no context)
// plays the default Classic match. Casual settings are chosen separately.

export type PostChallenge = { config: MatchConfig; description: string };

export function postChallenge(): PostChallenge | null {
  const data: unknown = context?.postData;
  if (typeof data !== 'object' || data === null) return null;
  const config = parseMatchConfig(Reflect.get(data, 'match'));
  if (typeof config === 'string') return null;
  const description: unknown = Reflect.get(data, 'description');
  return {
    config: postType(data) === 'daily' ? config : withoutDailyMode(config),
    description: typeof description === 'string' ? description : '',
  };
}

// The match to download art for and to play first. A Free Kick post's
// kicker and wall kits stand in for home and away, so the same downloads
// fetch them.
export const startingConfig = (): MatchConfig => {
  const data: unknown = context?.postData;
  if (postType(data) === 'freekick') {
    const fk = postFreeKickChallenge(data);
    const d = DEFAULT_MATCH_CONFIG;
    return {
      ...d,
      home: { ...d.home, jersey: fk.kicker },
      away: { ...d.away, jersey: fk.wall },
    };
  }
  return postChallenge()?.config ?? DEFAULT_MATCH_CONFIG;
};

// This Free Kick post's Challenge settings (the default on older posts).
export const freeKickChallenge = () => postFreeKickChallenge(context?.postData);

export const currentPostType = () => postType(context?.postData);
