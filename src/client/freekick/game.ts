import Phaser from 'phaser';
import { FREE_KICK as FK } from '../../shared/tuning';
import { PAL } from '../ui/palette';
import { FreeKickScene } from './FreeKickScene';
import type { PlaygroundLink } from './playgroundLink';

// The Free Kick game: its own portrait canvas (the match is landscape).
// EXPAND keeps the whole 720x1280 view visible and shows more around it on
// taller or wider screens, so the HUD hugs the real edges.
export function createFreeKickGame(
  practice = false,
  level = 1,
  playground: PlaygroundLink | null = null
) {
  const box = document.getElementById('freekick');
  if (!box) throw new Error('#freekick container missing');
  const game = new Phaser.Game({
    type: Phaser.WEBGL, // the court uses Meshes, which need WebGL
    parent: box,
    width: FK.viewWidth,
    height: FK.viewHeight,
    backgroundColor: PAL.navy,
    // Crisp pixel art, unrounded positions (see game.ts).
    antialias: false,
    roundPixels: false,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { activePointers: 2 },
    render: { powerPreference: 'high-performance' },
    callbacks: {
      preBoot: (instance) => {
        instance.registry.set('freekickPractice', practice);
        instance.registry.set('freekickPracticeLevel', level);
        instance.registry.set('freekickPlayground', playground);
      },
    },
    scene: [FreeKickScene],
  });
  // With ?debug, expose the game for checks (as game.ts does).
  if (new URLSearchParams(window.location.search).has('debug'))
    Reflect.set(window, '__game', game);
  return game;
}
