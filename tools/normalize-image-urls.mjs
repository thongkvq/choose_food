// tools/normalize-image-urls.mjs — chuẩn hoá URL ảnh Wikimedia về thumbnail đúng kích thước, bỏ query tracking.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WIDTH = Number(process.env.WIDTH || 960);   // chỉ 320/500/640/800/960/1280 được Wikimedia phục vụ
const DRY = process.env.DRY === '1';
const ONLY_MISSING = process.env.ONLY_MISSING === '1';
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));

function toThumb(raw, width) {
  if (!raw) return raw;
  const clean = String(raw).split('?')[0];
  const m = clean.match(/^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/([^/]+)\/(.*)$/);
  if (!m) return clean;
  const wiki = m[1];
  let segs = m[2].split('/').filter(Boolean);
  if (segs[0] === 'thumb') segs = segs.slice(1);          // bỏ tiền tố 'thumb' nếu có
  if (segs.length < 3) return clean;
  const file = segs[2];
  if (/\.svg$/i.test(file)) return 'https://upload.wikimedia.org/wikipedia/' + wiki + '/' + segs.slice(0, 3).join('/');
  return 'https://upload.wikimedia.org/wikipedia/' + wiki + '/thumb/' + segs[0] + '/' + segs[1] + '/' + file + '/' + width + 'px-' + file;
}

let changed = 0, bad = 0;
for (const d of data.dishes) {
  if (!d.image) continue;
  const after = toThumb(d.image, WIDTH);
  if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/.+\/\d+px-.+$/.test(after)) bad++;
  if (after !== d.image) changed++;
  d.image = after;
}
if (!DRY) await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
console.log('đổi URL:', changed, '| URL không đúng dạng thumb:', bad, '| tổng ảnh:', data.dishes.filter(d => d.image).length);
console.log('mẫu:', data.dishes.filter(d => d.image).slice(0, 3).map(d => d.image).join('\n'));
