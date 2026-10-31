import { journeyAppReady } from '../journeys';
import Phaser from 'phaser';
import { context, requestExpandedMode } from '@devvit/web/client';
import type { DailyLeadersResponse } from '../../shared/api';
import { currentPostType, postChallenge, startingConfig } from '../challenge';
import { readGamesPlayed } from '../gameCount';
import { createMobileLobby } from '../ui/mobileLobby';

// One native match card across phone and desktop. Only the stage contains
// the real silent AI preview; viewing the card never registers a game.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const config = startingConfig();
    const type = currentPostType();
    const inline = this.registry.get('inline') === true;
    const play = (event: MouseEvent, casual: boolean) => {
      if (inline && context?.postId) {
        requestExpandedMode(event, casual ? 'casual' : 'game');
        return;
      }
      this.scene.stop('Match');
      this.scene.start(casual ? 'Casual' : 'Match', {
        ...config,
        mode: 'competitive',
      });
    };
    const lobby = createMobileLobby(
      config,
      postChallenge()?.description ?? '',
      (event) => play(event, type === 'casual'),
      () => {
        void lobby.showBoard(Boolean(context?.postId));
      },
      type,
      (event) => play(event, true)
    );
    document.body.append(lobby.element);
    journeyAppReady();
    this.cameras.main.setVisible(false);
    this.registry.set('menuPreview', true);
    const layout = () => {
      lobby.element.classList.toggle(
        'is-portrait',
        window.innerHeight > window.innerWidth
      );
      this.game.events.emit('layout-mode');
    };
    const resize = new ResizeObserver(layout);
    const stage = lobby.element.querySelector('.preview-stage');
    if (stage) resize.observe(stage);
    window.addEventListener('resize', layout);
    layout();

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
    void refresh();
    const timer = this.time.addEvent({
      delay: 30000,
      loop: true,
      callback: onFocus,
    });
    this.scene.launch('Match', { ...config, demo: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      timer.remove();
      resize.disconnect();
      window.removeEventListener('resize', layout);
      window.removeEventListener('focus', onFocus);
      lobby.element.remove();
      this.registry.set('menuPreview', false);
      this.game.events.emit('layout-mode');
    });
  }
}
