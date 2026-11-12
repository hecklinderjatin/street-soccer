import type { Pixels } from '../src/client/art/playerSheets';

// Just enough of a 2D canvas context, in software, to run the court
// painters in Node (scripts/bake-court.ts): fillRect with a '#rrggbb'
// fillStyle and globalAlpha (source-over, partly covered edge pixels
// blended by coverage, as the browser's antialiased fill), and
// createImageData / putImageData.

type ImageDataLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export class SoftContext {
  fillStyle = '#000000';
  globalAlpha = 1;
  imageSmoothingEnabled = false;
  readonly pixels: Pixels;

  constructor(width: number, height: number) {
    // Canvas sizes are whole pixels (the browser truncates).
    const w = Math.trunc(width);
    const h = Math.trunc(height);
    this.pixels = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }

  fillRect(x: number, y: number, w: number, h: number) {
    if (w < 0) {
      x += w;
      w = -w;
    }
    if (h < 0) {
      y += h;
      h = -h;
    }
    const color = /^#([0-9a-f]{6})$/i.exec(this.fillStyle);
    if (!color?.[1]) throw new Error(`Unsupported fillStyle ${this.fillStyle}`);
    const rgb = Number.parseInt(color[1], 16);
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    const { width, height, data } = this.pixels;
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(width, Math.ceil(x + w));
    const y1 = Math.min(height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      const cy = Math.min(py + 1, y + h) - Math.max(py, y);
      for (let px = x0; px < x1; px++) {
        const cx = Math.min(px + 1, x + w) - Math.max(px, x);
        const a = this.globalAlpha * cx * cy;
        if (a <= 0) continue;
        const i = (py * width + px) * 4;
        const da = (data[i + 3] ?? 0) / 255;
        const oa = a + da * (1 - a);
        const mix = (src: number, dst: number) =>
          oa === 0 ? 0 : (src * a + dst * da * (1 - a)) / oa;
        data[i] = Math.round(mix(r, data[i] ?? 0));
        data[i + 1] = Math.round(mix(g, data[i + 1] ?? 0));
        data[i + 2] = Math.round(mix(b, data[i + 2] ?? 0));
        data[i + 3] = Math.round(oa * 255);
      }
    }
  }

  createImageData(width: number, height: number): ImageDataLike {
    const w = Math.trunc(width);
    const h = Math.trunc(height);
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }

  putImageData(image: ImageDataLike, dx: number, dy: number) {
    const { width, height, data } = this.pixels;
    const ox = Math.trunc(dx);
    const oy = Math.trunc(dy);
    for (let y = 0; y < image.height; y++) {
      const ty = oy + y;
      if (ty < 0 || ty >= height) continue;
      for (let x = 0; x < image.width; x++) {
        const tx = ox + x;
        if (tx < 0 || tx >= width) continue;
        const s = (y * image.width + x) * 4;
        const t = (ty * width + tx) * 4;
        for (let c = 0; c < 4; c++) data[t + c] = image.data[s + c] ?? 0;
      }
    }
  }
}
