import { context, requestExpandedMode } from '@devvit/web/client';
import type { DailyLeadersResponse } from '../../shared/api';
import { journeySettings } from '../../shared/journeys';
import { currentPostType, postChallenge, startingConfig } from '../challenge';
import { readGamesPlayed } from '../gameCount';
import { journeyAppReady } from '../journeys';
import { measurePlay } from '../playMetrics';
import { createMobileLobby } from './mobileLobby';

export function mountMatchLobby(inline: boolean, loadLocalGame?: () => void) {
  const config = startingConfig();
  const type = currentPostType();
  let localPlay: ((casual: boolean) => void) | undefined;
  let pendingPlay: boolean | undefined;
  const play = (event: MouseEvent, casual: boolean) => {
    if (inline && context?.postId) {
      measurePlay(
        'play_tap',
        casual ? 'casual' : journeySettings(config, type, false).mode
      );
      requestExpandedMode(event, casual ? 'casual' : 'game');
    } else if (localPlay) localPlay(casual);
    else {
      pendingPlay = casual;
      loadLocalGame?.();
    }
  };
  const lobby = createMobileLobby(
    config,
    postChallenge()?.description ?? '',
    (event) => play(event, type === 'casual'),
    () => void lobby.showBoard(Boolean(context?.postId)),
    type,
    (event) => play(event, true)
  );
  document.body.append(lobby.element);
  journeyAppReady();
  const refresh = async () => {
    if (document.hidden) return;
    const counter = readGamesPlayed()
      .then((count) => {
        if (lobby.element.isConnected) lobby.setGamesPlayed(count);
      })
      .catch(() => {
        if (lobby.element.isConnected) lobby.setGamesPlayed(null);
      });
    const leaderboard = async () => {
      if (type === 'casual' || !context?.postId) return;
      try {
        const response = await fetch('/api/daily-leaders');
        if (!response.ok) throw new Error('Leaderboard unavailable');
        const board: DailyLeadersResponse = await response.json();
        if (lobby.element.isConnected) lobby.setBoard(board);
      } catch {
        if (lobby.element.isConnected)
          lobby.setBoard('Scores unavailable. Try again soon.');
      }
    };
    await Promise.all([counter, leaderboard()]);
  };
  const onFocus = () => {
    void refresh();
  };
  window.addEventListener('focus', onFocus);
  window.addEventListener('resize', lobby.resizeBoard);
  void refresh();
  const timer = window.setInterval(onFocus, 30_000);
  return {
    element: lobby.element,
    bindLocalPlay(handler: (casual: boolean) => void) {
      localPlay = handler;
      const pending = pendingPlay;
      pendingPlay = undefined;
      if (pending !== undefined) queueMicrotask(() => handler(pending));
    },
    destroy() {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('resize', lobby.resizeBoard);
      lobby.element.remove();
    },
  };
}
