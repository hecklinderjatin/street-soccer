import { startEarlyDownloads } from './earlyAssets';
import { measurePlay } from './playMetrics';
startEarlyDownloads();
void import('./game')
  .then(({ createGame }) => createGame(false, true))
  .catch((error: unknown) => {
    measurePlay('load_failed', 'casual');
    console.error('Could not load Street Soccer', error);
  });
