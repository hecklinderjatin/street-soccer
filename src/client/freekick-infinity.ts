import { startFreeKickDownloads } from './earlyAssets';
import { showLaunchError } from './ui/launchError';
startFreeKickDownloads();
void import('./freekick/game')
  .then(({ createFreeKickGame }) => createFreeKickGame())
  .catch(showLaunchError);
