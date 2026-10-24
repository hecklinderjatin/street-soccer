import { startEarlyDownloads } from './earlyAssets';
startEarlyDownloads();
void import('./game').then(({ createGame }) => createGame(false, true));
