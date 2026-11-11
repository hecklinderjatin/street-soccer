import Phaser from 'phaser';
import { startingConfig } from '../challenge';
import { mountMatchLobby } from '../ui/matchLobby';

// The inline entry can mount the card before Phaser is downloaded. Local
// expanded menus still mount the same card here.
export class MenuScene extends Phaser.Scene {
  constructor(private feedLobby?: ReturnType<typeof mountMatchLobby>) {
    super('Menu');
  }

  create() {
    const config = startingConfig();
    const lobby =
      this.feedLobby ?? mountMatchLobby(this.registry.get('inline') === true);
    this.feedLobby = undefined;
    lobby.bindLocalPlay((casual) => {
      this.scene.stop('Match');
      this.scene.start(casual ? 'Casual' : 'Match', {
        ...config,
        mode: 'competitive',
      });
    });
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
    this.scene.launch('Match', { ...config, demo: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      resize.disconnect();
      window.removeEventListener('resize', layout);
      lobby.destroy();
      this.registry.set('menuPreview', false);
      this.game.events.emit('layout-mode');
    });
  }
}
