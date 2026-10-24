import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';

type Layout = {
  rotated: boolean;
  scale: number;
  centerX: number;
  centerY: number;
};

// Always shows the game in landscape, whatever the phone does. In a portrait
// viewport the whole 1280x720 game box is rotated 90 degrees with CSS, so the
// player just turns the phone sideways.
//
// Phaser's scale manager can't do this: it measures the parent with
// getBoundingClientRect, which a rotated parent breaks. So Phaser runs in
// Scale.NONE at a fixed 1280x720, this module sizes and rotates the box, and
// pointer positions are mapped back into game space here.
export function forceLandscape(
  game: Phaser.Game,
  box: HTMLElement,
  rotatePortrait = true
) {
  let layout: Layout = { rotated: false, scale: 1, centerX: 0, centerY: 0 };
  let lastW = 0;
  let lastH = 0;

  const apply = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    lastW = vw;
    lastH = vh;
    const preview =
      game.registry.get('menuPreview') === true
        ? document.querySelector('.preview-stage')?.getBoundingClientRect()
        : undefined;
    const mobileLobby = game.registry.get('mobileLobby') === true;
    const rotated = rotatePortrait && !mobileLobby && vh > vw;
    const availableW = rotated ? vh : vw;
    const availableH = rotated ? vw : vh;
    const scale = preview
      ? Math.max(preview.width / VIEW.width, preview.height / VIEW.height)
      : mobileLobby
        ? Math.max(availableW / VIEW.width, availableH / VIEW.height)
        : Math.min(availableW / VIEW.width, availableH / VIEW.height);
    layout = {
      rotated: preview ? false : rotated,
      scale,
      centerX: preview ? preview.left + preview.width / 2 : vw / 2,
      centerY: preview ? preview.top + preview.height / 2 : vh / 2,
    };
    box.style.left = `${layout.centerX}px`;
    box.style.top = `${layout.centerY}px`;
    box.style.clipPath = preview
      ? `inset(${Math.max(0, (VIEW.height - preview.height / scale) / 2)}px ${Math.max(0, (VIEW.width - preview.width / scale) / 2)}px)`
      : '';
    box.style.transform = `translate(-50%, -50%) ${layout.rotated ? 'rotate(90deg) ' : ''}scale(${scale})`;
  };

  apply();
  game.events.on('layout-mode', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => {
    apply();
    // Some mobile browsers report the new size a moment after the event.
    window.setTimeout(apply, 250);
  });
  window.visualViewport?.addEventListener('resize', apply);
  // Webviews don't always fire resize events (e.g. when the post expands),
  // so also compare the size every frame; it only re-applies on a change.
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) apply();
  });

  // Map page coordinates to game coordinates ourselves, then let Phaser's
  // own transformPointer store them (keeps its smoothing and bookkeeping).
  game.scale.transformX = (x: number) => x;
  game.scale.transformY = (y: number) => y;
  const transformPointer = game.input.transformPointer.bind(game.input);
  game.input.transformPointer = (pointer, pageX, pageY, wasMove) => {
    const dx = (pageX - layout.centerX) / layout.scale;
    const dy = (pageY - layout.centerY) / layout.scale;
    // CSS rotate(90deg) maps (x, y) to (-y, x); the inverse is (y, -x).
    const localX = layout.rotated ? dy : dx;
    const localY = layout.rotated ? -dx : dy;
    transformPointer(
      pointer,
      localX + VIEW.width / 2,
      localY + VIEW.height / 2,
      wasMove
    );
  };
}
