import Phaser from 'phaser';
import { VIEW } from '../../shared/tuning';
import { paintStreetBackdrop } from './menuCard';

export { seededRandom } from './menuCard';

const KEY = 'backdrop-street';

// Pixel-art street used behind the result screen: a brick wall with a
// pavement kerb and dithered asphalt (menuCard.ts paints it, shared with
// the title screen and the feed splash). Baked into a texture once.
export function addStreetBackdrop(scene: Phaser.Scene) {
  if (!scene.textures.exists(KEY)) {
    const texture = scene.textures.createCanvas(KEY, VIEW.width, VIEW.height);
    if (texture) {
      paintStreetBackdrop(texture.getContext(), VIEW.width, VIEW.height);
      texture.refresh();
    }
  }
  return scene.add.image(0, 0, KEY).setOrigin(0);
}
