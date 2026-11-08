import { startEarlyDownloads } from './earlyAssets';
import { currentPostType, startingConfig } from './challenge';
import { measurePlay } from './playMetrics';
import { journeySettings } from '../shared/journeys';

// The match art starts downloading first; the game code (the big bundle) is
// fetched alongside it, not before it.
startEarlyDownloads();
void import('./game')
  .then(({ createGame }) => createGame())
  .catch((error: unknown) => {
    const type = currentPostType();
    measurePlay(
      'load_failed',
      type === 'casual'
        ? type
        : journeySettings(startingConfig(), type, false).mode
    );
    console.error('Could not load Street Soccer', error);
  });
