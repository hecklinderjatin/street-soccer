import { startFreeKickDownloads } from './earlyAssets';
startFreeKickDownloads();
void import('./freekick/game')
  .then(({ createFreeKickGame }) => createFreeKickGame())
  .catch(() => {
    const loading = document.getElementById('boot-loading');
    if (loading)
      loading.textContent = 'Couldn’t load the game. Please reopen the post.';
  });
