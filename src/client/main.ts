import { startEarlyDownloads } from './earlyAssets';

// The match art starts downloading first; the game code (the big bundle) is
// fetched alongside it, not before it.
startEarlyDownloads();
void import('./game').then(({ createGame }) => createGame());
