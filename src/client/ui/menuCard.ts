import { formatClock } from '../../shared/matchConfig';
import { VIEW } from '../../shared/tuning';
import type { MatchConfig, TeamSetup } from '../../shared/types';
import { GLYPHS } from './glyphs';
import { JERSEY_SWATCH, PAL, PX } from './palette';

// The title screen as plain canvas painting, no Phaser: the game's menu
// (MenuScene) and the feed splash (splash.ts) both paint it, so the post in
// the feed shows exactly the screen the game opens with. Coordinates are
// the game's 1280 x 720 view; `offsetX` / `offsetY` place that view inside a
// bigger canvas (the splash fills any card shape, the wall and street just
// reach further).

export type MenuCardInfo = {
  config: MatchConfig | null; // a moderator's locked match, else the default menu
  durationSec: number; // the default match's length (no config)
  username: string | undefined;
};

export const PLAY_BUTTON = { x: VIEW.width / 2, y: 540, w: 320, h: 96 };
const WALL_H = 440; // px of brick wall (in the view) before the pavement starts

export const css = (color: number, alpha = 1) =>
  `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;

// Small deterministic RNG so baked art looks the same every time.
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Brick wall, kerb and dithered street over the whole canvas; the wall's
// foot is at WALL_H in the view (offsetY into the canvas).
export function paintStreetBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetY = 0
) {
  const rand = seededRandom(7);
  const wallH = offsetY + WALL_H;
  const fill = (color: number, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = css(color);
    ctx.fillRect(x, y, w, h);
  };
  // Brick wall: 8x4 art-pixel bricks, every other row offset by half; rows
  // counted up from the wall's foot so the view's bricks never move.
  const bw = 8 * PX;
  const bh = 4 * PX;
  fill(PAL.plum, 0, 0, width, wallH);
  const firstRow = -Math.ceil(offsetY / bh);
  for (let row = firstRow; row * bh + offsetY < wallH; row++) {
    const shift = ((row % 2) + 2) % 2 === 0 ? 0 : -bw / 2;
    for (let x = shift; x < width; x += bw)
      fill(
        rand() < 0.15 ? PAL.darkGray : PAL.brown,
        x + PX,
        row * bh + offsetY + PX,
        bw - PX,
        bh - PX
      );
  }
  // Kerb, then asphalt with a sparse dither of lighter pixels.
  fill(PAL.lightGray, 0, wallH, width, 3 * PX);
  fill(PAL.darkGray, 0, wallH + 3 * PX, width, PX);
  fill(PAL.navy, 0, wallH + 4 * PX, width, height - wallH - 4 * PX);
  const street = height - wallH;
  const specks = Math.round(
    (260 * width * street) / (VIEW.width * (VIEW.height - WALL_H))
  );
  for (let i = 0; i < specks; i++) {
    const x = Math.floor((rand() * width) / PX) * PX;
    const y = wallH + 5 * PX + Math.floor((rand() * street) / PX) * PX;
    fill(PAL.darkGray, x, y, PX, PX);
  }
  // Chalk centre line on the street.
  ctx.fillStyle = css(PAL.white, 0.8);
  for (let x = 0; x < width; x += 16 * PX)
    ctx.fillRect(x, offsetY + 610, 10 * PX, PX);
}

// Pixel text exactly like the game's bitmap font (pixelText): 7 x 9 cells,
// each glyph with a black drop shadow one font pixel down-right; `size` is
// canvas px per font pixel, origin as in Phaser (0.5 = centred).
export function paintText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: number,
  originX = 0.5,
  originY = 0.5
) {
  const chars = [...text.toUpperCase()];
  const left = x - originX * chars.length * 7 * size;
  const top = y - originY * 9 * size;
  for (const [ink, offset] of [
    [PAL.black, size],
    [color, 0],
  ] as const) {
    ctx.fillStyle = css(ink);
    chars.forEach((char, i) =>
      (GLYPHS[char] ?? '').split(' ').forEach((row, gy) =>
        [...row].forEach((cell, gx) => {
          if (cell === '#')
            ctx.fillRect(
              left + (i * 7 + gx) * size + offset,
              top + gy * size + offset,
              size,
              size
            );
        })
      )
    );
  }
}

// A chunky button like TextButton (notched corners, shadow, bevel), centred
// on (x, y); `pressed` sinks the face onto its shadow.
export function paintButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  label: string,
  textSize: number,
  pressed = false
) {
  const stepped = (oy: number, color: number) => {
    ctx.fillStyle = css(color);
    ctx.fillRect(x - w / 2 + PX, y - h / 2 + oy, w - 2 * PX, h);
    ctx.fillRect(x - w / 2, y - h / 2 + PX + oy, w, h - 2 * PX);
  };
  stepped(PX, PAL.black); // shadow
  const fy = y + (pressed ? PX : 0);
  ctx.save();
  ctx.translate(0, fy - y);
  stepped(0, PAL.black);
  ctx.fillStyle = css(fill);
  ctx.fillRect(x - w / 2 + PX, y - h / 2 + PX, w - 2 * PX, h - 2 * PX);
  ctx.fillStyle = css(PAL.white, 0.35);
  ctx.fillRect(x - w / 2 + 2 * PX, y - h / 2 + PX, w - 4 * PX, PX);
  ctx.fillStyle = css(PAL.black, 0.3);
  ctx.fillRect(x - w / 2 + PX, y + h / 2 - 2 * PX, w - 2 * PX, PX);
  ctx.restore();
  paintText(ctx, label, x, fy, textSize, PAL.white);
}

// Everything on the title screen but its buttons: backdrop, title, and the
// match line (default) or the moderator's locked settings.
export function paintMenuCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  info: MenuCardInfo
) {
  paintStreetBackdrop(ctx, width, height, offsetY);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  const cx = VIEW.width / 2;
  // Title with a hard offset shadow, like spray paint on the wall.
  paintText(
    ctx,
    'STREET SOCCER',
    cx + 2 * PX,
    150 + 2 * PX,
    2.5 * PX,
    PAL.black
  );
  paintText(ctx, 'STREET SOCCER', cx, 150, 2.5 * PX, PAL.yellow);

  const who = info.username ? `u/${info.username}` : 'guest';
  const config = info.config;
  if (!config) {
    paintText(
      ctx,
      `5V5 - ${formatClock(info.durationSec)} - ${who}`,
      cx,
      260,
      PX,
      PAL.white
    );
  } else {
    paintText(ctx, `CUSTOM MATCH - ${who}`, cx, 236, PX, PAL.white);
    const team = (setup: TeamSetup, x: number, align: number) => {
      const chipX = align === 0 ? x : x - 24;
      ctx.fillStyle = css(PAL.black);
      ctx.fillRect(chipX - 1, 291, 26, 42);
      ctx.fillStyle = css(JERSEY_SWATCH[setup.jersey]);
      ctx.fillRect(chipX + 1, 293, 22, 38);
      const textX = align === 0 ? x + 40 : x - 40;
      paintText(ctx, setup.name, textX, 300, PX, PAL.white, align);
      paintText(
        ctx,
        setup.formation,
        textX,
        326,
        0.75 * PX,
        PAL.lightGray,
        align
      );
    };
    team(config.home, cx - 400, 0);
    paintText(ctx, 'VS', cx, 312, PX, PAL.yellow);
    team(config.away, cx + 400, 1);
    const start =
      config.startGoalsAgainst > 0
        ? ` - START 0-${config.startGoalsAgainst}`
        : '';
    paintText(
      ctx,
      `${formatClock(config.durationSec)} - ${config.difficulty} AI${start}`,
      cx,
      400,
      PX,
      PAL.white
    );
  }
  ctx.restore();
}
