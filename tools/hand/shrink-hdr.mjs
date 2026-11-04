// Shrinks a Radiance .hdr light probe (box filter) for the web: node shrink-hdr.mjs in.hdr out.hdr 512
// Uses three.js's own HDR reader; writes an uncompressed-scanline RGBE file the site loads with HDRLoader.
import fs from 'node:fs';
import { FloatType } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const [, , input, output, widthArg] = process.argv;
const loader = new HDRLoader().setDataType(FloatType);
const buf = fs.readFileSync(input);
const src = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const W = Number(widthArg ?? 512);
const k = src.width / W;
const H = Math.round(src.height / k);
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = Math.floor(y * k); sy < Math.floor((y + 1) * k); sy++) {
      for (let sx = Math.floor(x * k); sx < Math.floor((x + 1) * k); sx++) {
        const i = (sy * src.width + sx) * 4;
        r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
      }
    }
    r /= n; g /= n; b /= n;
    // Float to RGBE (shared exponent)
    const m = Math.max(r, g, b);
    const o = (y * W + x) * 4;
    if (m < 1e-32) continue;
    const e = Math.ceil(Math.log2(m) + 1e-9);
    const scale = 256 / 2 ** e;
    out[o] = Math.min(255, Math.floor(r * scale));
    out[o + 1] = Math.min(255, Math.floor(g * scale));
    out[o + 2] = Math.min(255, Math.floor(b * scale));
    out[o + 3] = e + 128;
  }
}
const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`;
fs.writeFileSync(output, Buffer.concat([Buffer.from(header, 'ascii'), out]));
console.log(`${src.width}x${src.height} -> ${W}x${H}, ${(header.length + out.length) / 1024 | 0} KB`);
