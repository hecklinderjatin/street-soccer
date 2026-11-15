import { startFreeKickDownloads } from './earlyAssets';
import { showLaunchError } from './ui/launchError';

// The ranked Free Kick challenge uses the post creator's settings.
// Infinity posts use their own ranked entry; Practice stays unranked.
startFreeKickDownloads();
void import('./freekick/game')
  .then(({ createFreeKickGame }) => createFreeKickGame())
  .catch(showLaunchError);
