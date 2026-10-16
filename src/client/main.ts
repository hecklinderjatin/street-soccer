import Phaser from 'phaser';
import { VIEW } from '../shared/tuning';
import { BootScene } from './scenes/BootScene';
import { MatchScene } from './scenes/MatchScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import { HudScene } from './scenes/HudScene';
import { forceLandscape } from './ui/landscape';
import { PAL } from './ui/palette';
import { markTiming } from './ui/timing';

markTiming('game code');

const box = document.getElementById('game');
if (!box) throw new Error('#game container missing');

const game = new Phaser.Game({
  type: Phaser.WEBGL, // the perspective court uses Meshes, which need WebGL
  parent: box,
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: PAL.navy,
  // Crisp pixel-art textures (nearest-neighbour filtering), but positions are
  // NOT rounded to whole pixels: with a moving perspective camera, rounding
  // each sprite and ground vertex separately made everything shimmer and
  // step against each other. (pixelArt: true would force roundPixels on.)
  antialias: false,
  roundPixels: false,
  disableContextMenu: true, // long-press must not open a menu
  scale: {
    // Sizing and rotation are handled by forceLandscape, not Phaser.
    mode: Phaser.Scale.NONE,
  },
  input: {
    activePointers: 3, // joystick thumb + button thumb + spare
  },
  render: {
    powerPreference: 'high-performance',
  },
  scene: [BootScene, MenuScene, MatchScene, ResultScene, HudScene], // Hud last so it draws on top
});

forceLandscape(game, box);

// Testing hook: with ?debug in the URL, expose the game for inspection from
// the console or automated checks (window.__game). Off in normal play.
if (new URLSearchParams(window.location.search).has('debug'))
  Reflect.set(window, '__game', game);
