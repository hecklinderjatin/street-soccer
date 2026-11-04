import { startEarlyDownloads } from './earlyAssets';

// Free Kick mode (its own expanded entrypoint): the art starts downloading
// at once, alongside the game code.
startEarlyDownloads();
void import('./freekick/game').then(({ createFreeKickGame }) =>
  createFreeKickGame()
);
