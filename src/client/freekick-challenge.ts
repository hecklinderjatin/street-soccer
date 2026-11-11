import { startEarlyDownloads } from './earlyAssets';

// The ranked Free Kick challenge uses the post creator's settings.
// Infinity posts use their own ranked entry; Practice stays unranked.
startEarlyDownloads();
void import('./freekick/game')
  .then(({ createFreeKickGame }) => createFreeKickGame())
  .catch((error: unknown) => {
    console.error('Could not load the Free Kick challenge', error);
  });
