import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FREE_KICK_GROUND_SIZE,
  paintFreeKickGround,
} from '../src/client/art/groundPaint';
import { writePng } from './png';
import { SoftContext } from './softCanvas';

// Bakes the Free Kick ground texture (art/groundPaint.ts) into the image
// the game loads instead of painting it (public-release/art). Run
// `npm run art:court` after changing the ground painter, the asphalt or
// the court sizes, and commit the image with the change.

const started = Date.now();
const ctx = new SoftContext(
  FREE_KICK_GROUND_SIZE.width,
  FREE_KICK_GROUND_SIZE.height
);
paintFreeKickGround(ctx);
const path = resolve(process.cwd(), 'public-release/art/freekick-ground.png');
writePng(path, ctx.pixels);
console.log(
  `freekick-ground.png ${ctx.pixels.width}x${ctx.pixels.height} ${(statSync(path).size / 1024).toFixed(0)} KiB in ${Date.now() - started} ms`
);
