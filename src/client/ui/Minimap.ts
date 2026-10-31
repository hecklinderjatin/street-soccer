import type { PitchGeometry } from '../../shared/chaos';
import Phaser from 'phaser';
import { PITCH, VIEW } from '../../shared/tuning';
import { PAL, PX } from './palette';

// Where everyone is, seen from above: a small pitch at the bottom centre of
// the HUD (between the joystick and the buttons). The far touchline (y = 0)
// is at the top and our goal on the left, like the broadcast view. Lines
// are drawn once; dots are redrawn every frame from the Match scene's
// render positions, so they move as smoothly as the players.

export type MinimapDot = {
  x: number; // world px
  y: number;
  color: number;
  controlled: boolean; // the human's player: bigger, yellow outline (like its arrow)
};

export type MinimapState = {
  dots: MinimapDot[]; // every player, updated in place by the Match scene
  ballX: number;
  ballY: number;
};

const SCALE = 0.1; // screen px per world px
const W = PITCH.width * SCALE; // 264
const H = PITCH.height * SCALE; // 143
const LEFT = (VIEW.width - W) / 2;
const TOP = VIEW.height - H - 16; // 16 px above the bottom edge
const DOT = 2 * PX; // player square
const BALL = PX + 2;

export class Minimap {
  private readonly dots: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, pitch: PitchGeometry = PITCH) {
    const g = scene.add.graphics();
    const goalH = pitch.goalMouth * SCALE;
    const boxW = PITCH.boxDepth * SCALE;
    const boxH = pitch.boxHeight * SCALE;
    // Frame and a translucent pitch, so the match shows through.
    g.fillStyle(PAL.black, 0.55).fillRect(LEFT - 6, TOP - 6, W + 12, H + 12);
    g.fillStyle(PAL.darkGreen, 0.55).fillRect(LEFT, TOP, W, H);
    g.lineStyle(2, PAL.white, 0.45);
    g.strokeRect(LEFT, TOP, W, H);
    g.lineBetween(LEFT + W / 2, TOP, LEFT + W / 2, TOP + H);
    g.strokeCircle(LEFT + W / 2, TOP + H / 2, PITCH.centerCircle * SCALE);
    g.strokeRect(LEFT, TOP + (H - boxH) / 2, boxW, boxH);
    g.strokeRect(LEFT + W - boxW, TOP + (H - boxH) / 2, boxW, boxH);
    // Goals: bright posts-to-post bars just outside each goal line.
    g.fillStyle(PAL.white, 0.9);
    g.fillRect(LEFT - 4, TOP + (H - goalH) / 2, 4, goalH);
    g.fillRect(LEFT + W, TOP + (H - goalH) / 2, 4, goalH);
    this.dots = scene.add.graphics();
  }

  update(state: MinimapState) {
    const g = this.dots.clear();
    const at = (x: number, y: number) => ({
      sx: LEFT + Phaser.Math.Clamp(x, 0, PITCH.width) * SCALE,
      sy: TOP + Phaser.Math.Clamp(y, 0, PITCH.height) * SCALE,
    });
    // The controlled player last, so its outline is never covered.
    for (const pass of [false, true])
      for (const d of state.dots) {
        if (d.controlled !== pass) continue;
        const { sx, sy } = at(d.x, d.y);
        const size = d.controlled ? DOT + 2 : DOT;
        const rim = d.controlled ? 3 : 2;
        g.fillStyle(d.controlled ? PAL.yellow : PAL.black, 1);
        g.fillRect(
          sx - size / 2 - rim,
          sy - size / 2 - rim,
          size + 2 * rim,
          size + 2 * rim
        );
        g.fillStyle(d.color, 1);
        g.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
    const { sx, sy } = at(state.ballX, state.ballY);
    g.fillStyle(PAL.black, 1).fillRect(
      sx - BALL / 2 - 1,
      sy - BALL / 2 - 1,
      BALL + 2,
      BALL + 2
    );
    g.fillStyle(PAL.white, 1).fillRect(
      sx - BALL / 2,
      sy - BALL / 2,
      BALL,
      BALL
    );
  }
}
