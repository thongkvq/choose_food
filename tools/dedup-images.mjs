// tools/dedup-images.mjs — tách ảnh trùng: mỗi món tìm ảnh RIÊNG trên Commons; cứu các món chưa có ảnh.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UA = 'MonGiDayGacha/1.4 (personal LAN food demo; node)';
const DELAY = Number(process.env.DELAY || 1200);

const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));
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
function matched(query, title) {
  const q = toks(query).filter(t => !GENERIC.has(t));
  const t = new Set(toks(title));
  let hit = 0; for (const tok of q) if (t.has(tok)) hit += 1;
  return hit;
}
function hashIdx(id, n) { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h) % n; }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function getJSON(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const wait = Math.max(0, DELAY - (Date.now() - lastCall));
    if (wait) await sleep(wait);
    lastCall = Date.now();
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 429) {
        const ra = Number(r.headers.get('retry-after')) * 1000 || 5000 * Math.pow(2, i);
        console.error('429 -> backoff ' + Math.round(ra / 1000) + 's'); await sleep(ra); continue;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error('rate-limited');
}
async function commons(query) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=' +
    encodeURIComponent('filetype:bitmap ' + query) + '&prop=imageinfo&iiprop=url|mime&iiurlwidth=900';
  const j = await getJSON(u);
  return Object.values((j.query && j.query.pages) || {}).map(p => {
    const ii = p.imageinfo && p.imageinfo[0];
    return ii ? { title: p.title, url: ii.thumburl || ii.url, mime: ii.mime } : null;
  }).filter(Boolean).filter(f => !f.mime || /jpeg|png|webp/.test(f.mime));
}

const used = new Map();
for (const d of data.dishes) if (d.image) used.set(d.image.replace(/\/\d+px-/, '/SIZEpx-'), d.id);

// nhóm trùng
const groups = new Map();
for (const d of data.dishes) {
  if (!d.image) continue;
  const k = d.image.replace(/\/\d+px-/, '/SIZEpx-');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(d);
}
const todo = [];
for (const [, arr] of groups) if (arr.length > 1) todo.push(...arr.slice(1));
const noImage = data.dishes.filter(d => !d.image);
console.error('cần tách ảnh:', todo.length, '| chưa có ảnh:', noImage.length);

function queriesFor(d) {
  const qs = [d.name, ...(ALIASES[d.id] || [])];
  const extra = [toks(d.name).slice(0, 2).join(' '), toks(d.name).slice(0, 3).join(' ')];
  return [...new Set([...qs, ...extra].filter(q => q && q.length > 2))];
}

async function findDistinct(d) {
  for (const q of queriesFor(d).slice(0, 4)) {
    let files = [];
    try { files = await commons(q); } catch { continue; }
    const scored = files.map(f => {
      const s = Math.max(score(q, f.title), score(d.name, f.title));
      const m = Math.max(matched(q, f.title), matched(d.name, f.title));
      return { ...f, score: s, m };
    }).filter(f => f.score >= 0.6 && f.m >= 1 && !used.has(f.url.replace(/\/\d+px-/, '/SIZEpx-')))
      .sort((a, b) => (b.m - a.m) || (b.score - a.score));
    if (!scored.length) continue;
    const pick = scored[hashIdx(d.id, Math.min(4, scored.length))];
    return { image: pick.url, via: 'commons', source: pick.title, score: +pick.score.toFixed(2), query: q };
  }
  return null;
}

let fixed = 0, kept = 0;
for (const d of todo) {
  const r = await findDistinct(d);
  if (r) {
    used.delete(d.image.replace(/\/\d+px-/, '/SIZEpx-'));
    d.image = r.image; d.imageVia = r.via; d.imageSource = r.source;
    used.set(r.image.replace(/\/\d+px-/, '/SIZEpx-'), d.id);
    fixed++;
  } else kept++;
  if ((fixed + kept) % 10 === 0) console.error('dedup ' + (fixed + kept) + '/' + todo.length + ' fixed=' + fixed);
}
console.error('tách được:', fixed, '| giữ nguyên:', kept);

let saved = 0;
for (const d of noImage) {
  const r = await findDistinct(d);
  if (r) { d.image = r.image; d.imageVia = r.via; d.imageSource = r.source; used.set(r.image, d.id); saved++; }
}
console.error('cứu được món thiếu ảnh:', saved);

await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
const via = data.dishes.reduce((m, d) => { m[d.imageVia || 'svg'] = (m[d.imageVia || 'svg'] || 0) + 1; return m; }, {});
const g2 = new Map();
for (const d of data.dishes.filter(x => x.image)) { const k = d.image.replace(/\/\d+px-/, '/SIZEpx-'); g2.set(k, (g2.get(k) || 0) + 1); }
console.log('Nguồn:', JSON.stringify(via));
console.log('nhóm ảnh trùng còn lại:', [...g2.values()].filter(v => v > 1).length);
console.log('món dùng SVG:', data.dishes.filter(x => !x.image).map(x => x.id).join(',') || 'không');
