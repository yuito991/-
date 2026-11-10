const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function icon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let coverage = 0;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const px = (x + (dx + .5) / 4) / size;
          const py = (y + (dy + .5) / 4) / size;
          if (px >= .36 && px <= .70 && Math.abs(py - .5) <= (.70 - px) * .66) coverage++;
        }
      }
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      const background = [18, 59, 115];
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(background[channel] + (255 - background[channel]) * coverage / 16);
      pixels[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const directory = path.join(__dirname, '..', 'icons');
fs.mkdirSync(directory, { recursive: true });
for (const [name, size] of [['app-192.png', 192], ['app-512.png', 512], ['app-maskable-512.png', 512]]) {
  fs.writeFileSync(path.join(directory, name), icon(size));
}
console.log('Generated 192px and 512px app icons');
