/**
 * Generates the PWA icons (public/icon-192.png, public/icon-512.png)
 * without any image tooling: a minimal PNG encoder (zlib + CRC32) over a
 * pixel buffer that draws the game's look — black field, white border,
 * cyan and red claimed regions, and the red-and-white diamond marker.
 *
 * Run once: `node scripts/gen-icons.mjs` (outputs are committed).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };
  const rect = (x0, y0, x1, y1, r, g, b) => {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) set(x, y, r, g, b);
  };
  const u = size / 64; // logical 64-unit canvas
  // Black field.
  rect(0, 0, size, size, 0, 0, 0);
  // Cyan fast-claim region (left band) and red slow-claim (bottom-right).
  rect(Math.round(4 * u), Math.round(4 * u), Math.round(20 * u), Math.round(60 * u), 0, 176, 176);
  rect(Math.round(40 * u), Math.round(42 * u), Math.round(60 * u), Math.round(60 * u), 145, 36, 18);
  // White border walls.
  const wall = Math.max(1, Math.round(u * 1.5));
  rect(
    Math.round(4 * u),
    Math.round(4 * u),
    Math.round(60 * u),
    Math.round(4 * u) + wall,
    255,
    255,
    255,
  );
  rect(
    Math.round(4 * u),
    Math.round(60 * u) - wall,
    Math.round(60 * u),
    Math.round(60 * u),
    255,
    255,
    255,
  );
  rect(
    Math.round(4 * u),
    Math.round(4 * u),
    Math.round(4 * u) + wall,
    Math.round(60 * u),
    255,
    255,
    255,
  );
  rect(
    Math.round(60 * u) - wall,
    Math.round(4 * u),
    Math.round(60 * u),
    Math.round(60 * u),
    255,
    255,
    255,
  );
  // Claim boundary lines.
  rect(
    Math.round(20 * u),
    Math.round(4 * u),
    Math.round(20 * u) + wall,
    Math.round(60 * u),
    255,
    255,
    255,
  );
  rect(
    Math.round(40 * u),
    Math.round(42 * u),
    Math.round(60 * u),
    Math.round(42 * u) + wall,
    255,
    255,
    255,
  );
  rect(
    Math.round(40 * u),
    Math.round(42 * u),
    Math.round(40 * u) + wall,
    Math.round(60 * u),
    255,
    255,
    255,
  );
  // Red diamond marker with white core at the boundary junction.
  const cxp = Math.round(20 * u);
  const cyp = Math.round(30 * u);
  const rad = Math.round(6 * u);
  for (let dy = -rad; dy <= rad; dy += 1) {
    for (let dx = -rad; dx <= rad; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) <= rad) set(cxp + dx, cyp + dy, 255, 48, 48);
    }
  }
  const core = Math.round(2 * u);
  rect(cxp - core, cyp - core, cxp + core, cyp + core, 255, 255, 255);
  return encodePng(size, size, px);
}

mkdirSync('public', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, drawIcon(size));
  console.log(`wrote public/icon-${size}.png`);
}
