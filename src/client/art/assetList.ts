import type { MatchConfig } from '../../shared/types';
import {
  PLAYER_HAIR_TEXTURE,
  PLAYER_SKIN_TEXTURE,
  playerTexture,
  previewAtlasKey,
} from './playerSheets';

// The files a match downloads (no Phaser here, so the tiny early-download
// script can use it before the game code has arrived; earlyAssets.ts).

export type Asset = { key: string; url: string };

// Source sheets of the ball atlas (art/ballArt.ts builds it from them).
export const AUTHORED_BALL_TEXTURE = 'ball-authored-source';
export const AUTHORED_SHOT_BALL_TEXTURE = 'ball-shot-authored-source';

const atlas = (key: string): Asset => ({ key, url: `/art/${key}.webp` });

// First what every match opens with (the two teams' outfield kits, picked
// by the match settings, and the looks), then the keepers and the ball.
export const firstAssets = (config: MatchConfig): Asset[] => [
  atlas(playerTexture(config.home.jersey)),
  atlas(playerTexture(config.away.jersey)),
  atlas(PLAYER_SKIN_TEXTURE),
  atlas(PLAYER_HAIR_TEXTURE),
];
const FREE_KICK_REST_ASSETS: readonly Asset[] = [
  atlas(playerTexture('awayKeeper')),
  { key: AUTHORED_BALL_TEXTURE, url: '/art/ball-authored.webp' },
  { key: AUTHORED_SHOT_BALL_TEXTURE, url: '/art/ball-shot-authored.webp' },
];
export const REST_ASSETS: readonly Asset[] = [
  atlas(playerTexture('homeKeeper')),
  ...FREE_KICK_REST_ASSETS,
];
export const matchAssets = (config: MatchConfig): Asset[] => [
  ...firstAssets(config),
  ...REST_ASSETS,
];

// The Free Kick feed preview: the same texture keys, from the small
// preview atlases (only the poses the preview draws; playerSheets.ts).
export const freeKickPreviewAssets = (config: MatchConfig): Asset[] =>
  freeKickAssets(config).map((asset) =>
    asset.url.startsWith('/art/player-')
      ? { key: asset.key, url: `/art/${previewAtlasKey(asset.key)}.webp` }
      : asset
  );

export const freeKickAssets = (config: MatchConfig): Asset[] => [
  ...firstAssets(config),
  ...FREE_KICK_REST_ASSETS,
];
