import { startEarlyDownloads } from './earlyAssets';

// The ranked Free Kick challenge uses the post creator's settings.
// Practice is the only other Free Kick mode.
startEarlyDownloads();
void import('./freekick/game')
  .then(({ createFreeKickGame }) => createFreeKickGame())
  .catch((error: unknown) => {
    console.error('Could not load the Free Kick challenge', error);
  });
