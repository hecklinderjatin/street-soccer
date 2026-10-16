import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import type { Pixels } from '../src/client/art/playerSheets';

// Minimal PNG codec for the art bake: 8-bit RGB / RGBA, non-interlaced in;
// RGBA out. Node's zlib only, no image library.

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function readPng(path: string): Pixels {
  const file = readFileSync(path);
  if (!file.subarray(0, 8).equals(SIGNATURE))
    throw new Error(`${path} is not a PNG`);
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  for (let pos = 8; pos < file.length;) {
    const length = file.readUInt32BE(pos);
    const type = file.toString('ascii', pos + 4, pos + 8);
    const body = file.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const colour = body[9];
      if (depth !== 8 || body[12] !== 0)
        throw new Error(`${path}: only 8-bit non-interlaced PNGs`);
      channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
      if (!channels) throw new Error(`${path}: only RGB / RGBA PNGs`);
    } else if (type === 'IDAT') idat.push(body);
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8ClampedArray(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = new Uint8Array(
      raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    );
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? (line[x - channels] ?? 0) : 0;
      const up = prev[x] ?? 0;
      const upLeft = x >= channels ? (prev[x - channels] ?? 0) : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[x] = ((line[x] ?? 0) + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = line[x * channels] ?? 0;
      data[o + 1] = line[x * channels + 1] ?? 0;
      data[o + 2] = line[x * channels + 2] ?? 0;
      data[o + 3] = channels === 4 ? (line[x * channels + 3] ?? 0) : 255;
    }
    prev = line;
  }
  return { width, height, data };
}

function chunk(type: string, body: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0);
  return Buffer.concat([length, typed, crc]);
}

// RGBA PNG with the up filter on every row (small for sprite atlases).
export function writePng(path: string, pixels: Pixels) {
  const { width, height, data } = pixels;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    raw[o] = 2; // up
    for (let x = 0; x < stride; x++) {
      const v = data[y * stride + x] ?? 0;
      const above = y > 0 ? (data[(y - 1) * stride + x] ?? 0) : 0;
      raw[o + 1 + x] = (v - above) & 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  writeFileSync(
    path,
    Buffer.concat([
      SIGNATURE,
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  );
}
