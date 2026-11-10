import { startEarlyDownloads } from './earlyAssets';

// Free Kick challenge (its own expanded entrypoint): score a streak within
// a fixed number of kicks. Unranked, so nothing is measured or saved.
startEarlyDownloads();
void import('./freekick/game')
  .then(({ createFreeKickGame }) => createFreeKickGame(false, 1, true))
  .catch((error: unknown) => {
    console.error('Could not load the Free Kick challenge', error);
  });
