import { currentPostType } from './challenge';
import { startEarlyDownloads } from './earlyAssets';
import { showFreeKickLobby } from './freekick/lobby';
import { mountMatchLobby } from './ui/matchLobby';
import { watchVisiblePreview } from './ui/visiblePreview';

if (currentPostType() === 'freekick') {
  showFreeKickLobby();
} else {
  const lobby = mountMatchLobby(true, () => preview.startNow());
  const preview = watchVisiblePreview(document.body, async () => {
    startEarlyDownloads();
    const { createGame } = await import('./game');
    return () => createGame(true, false, lobby);
  });
}
