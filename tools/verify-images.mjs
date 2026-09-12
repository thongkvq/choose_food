// tools/verify-images.mjs — kiểm chứng ảnh: URL sống, khớp tên nguồn, mức trùng lặp (chạy chậm, có backoff 429).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DELAY = Number(process.env.DELAY || 350);
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter(t => t.length > 1);
const GENERIC = new Set(['va', 'and', 'the', 'mon', 'an', 'food', 'dish', 'cuisine', 'style', 'jpg', 'jpeg', 'png', 'file', 'photo']);
function score(query, title) {
  const q = toks(query).filter(t => !GENERIC.has(t));
  const t = new Set(toks(title));
  if (!q.length) return 0;
  let hit = 0; for (const tok of q) if (t.has(tok)) hit += 1;
  return hit / q.length;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const withImg = data.dishes.filter(d => d.image);
const noImg = data.dishes.filter(d => !d.image);
console.log('Tổng:', data.dishes.length, '| có ảnh:', withImg.length, '| SVG:', noImg.length, '(' + noImg.map(d => d.id).join(',') + ')');

let weak = withImg.filter(d => !d.imageSource || Math.max(score(d.name, d.imageSource), score(d.imageSource, d.name)) < 0.5);
console.log('Nguồn khớp tên yếu:', weak.length, weak.slice(0, 6).map(d => d.id).join(','));

const byUrl = new Map();
for (const d of withImg) { const k = d.image.replace(/\/\d+px-/, '/SIZEpx-'); byUrl.set(k, (byUrl.get(k) || 0) + 1); }
console.log('Ảnh dùng chung:', [...byUrl.values()].filter(v => v > 1).length, 'nhóm');

let ok = 0; const bad = [];
for (const d of withImg) {
  let done = false;
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    if (attempt) await sleep(3000 * attempt);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(d.image, { headers: { 'user-agent': 'MonGiDayGacha/1.5 (verify; node)', range: 'bytes=0-1024' }, signal: ctl.signal });
      clearTimeout(t);
      const ct = r.headers.get('content-type') || '';
      if (r.status === 429) { await sleep(20000); continue; }
      if ((r.status === 200 || r.status === 206) && /image\//.test(ct)) { ok++; done = true; }
      else { bad.push(d.id + ':' + r.status + ':' + ct.split(';')[0]); done = true; }
    } catch (e) { if (attempt === 3) bad.push(d.id + ':ERR:' + e.message); }
  }
  await sleep(DELAY);
  if ((ok + bad.length) % 40 === 0) console.error('checked ' + (ok + bad.length) + '/' + withImg.length);
}
console.log('URL ảnh OK:', ok + '/' + withImg.length, '| lỗi thật:', bad.length);
if (bad.length) console.log('LỖI:', bad.join(' , '));
const via = withImg.reduce((m, d) => { m[d.imageVia || '?'] = (m[d.imageVia || '?'] || 0) + 1; return m; }, {});
console.log('Nguồn:', JSON.stringify(via));
