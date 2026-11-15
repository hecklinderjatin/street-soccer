import { startEarlyDownloads } from './earlyAssets';
import { measurePlay } from './playMetrics';
import { showLaunchError } from './ui/launchError';
startEarlyDownloads();
void import('./game')
  .then(({ createGame }) => createGame(false, true))
  .catch((error: unknown) => {
    showLaunchError(error);
    measurePlay('load_failed', 'casual');
  });
