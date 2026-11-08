import { startEarlyDownloads } from './earlyAssets';
import { measurePlay } from './playMetrics';

// Free Kick mode (its own expanded entrypoint): the art starts downloading
// at once, alongside the game code.
startEarlyDownloads();
void import('./freekick/game')
  .then(({ createFreeKickGame }) => createFreeKickGame())
  .catch((error: unknown) => {
    measurePlay('load_failed', 'freekick');
    console.error('Could not load Free Kick', error);
  });
