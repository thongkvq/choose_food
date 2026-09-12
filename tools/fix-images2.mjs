// tools/fix-images2.mjs — sửa nốt ảnh nhầm do khớp chuỗi con; khớp theo TỪ (padding space).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DELAY = Number(process.env.DELAY || 1200);
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));
const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));

const RULES = {
  'mi-ga':        { must: ['mi ga', 'noodle soup'], ban: ['egg', 'trimingham', 'raw', 'hen'] },
  'mien-tron':    { must: ['mien tron', 'mien', 'glass noodle'], ban: ['papaver', 'tuinen', 'ruys', 'flower', 'orientale'] },
  'nuoc-dau':     { must: ['nuoc dau', 'dau do', 'dau den', 'red bean soup'], ban: ['bark', 'tree', 'wood', 'dysoxylum', 'plant'] },
  'cha-com':      { must: ['cha com', 'com'], ban: ['festival', 'bolo', 'cuiaba', 'brazil', 'cake', 'tea'] },
  'che-thai':     { must: ['che thai', 'che'], ban: ['bap', 'corn'] },
  'che-ba-mau':   { must: ['che ba mau', 'che'], ban: ['hat luu', 'pomegranate', 'bap'] },
  'sinh-to-xoai': { must: ['sinh to xoai'], ban: ['ca vien', 'fish ball'] }
};

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const padded = (s) => ' ' + norm(s) + ' ';
function hasPhrase(titleNorm, phrase) { return padded(titleNorm).includes(' ' + norm(phrase) + ' '); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const w = Math.max(0, DELAY - (Date.now() - lastCall));
    if (w) await sleep(w);
    lastCall = Date.now();
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(url, { headers: { 'user-agent': 'MonGiDayGacha/1.7 (food demo; node)', accept: 'application/json' }, signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 429) { const ra = Number(r.headers.get('retry-after')) * 1000 || 5000 * 2 ** i; console.error('429 -> ' + Math.round(ra / 1000) + 's'); await sleep(ra); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
  throw new Error('ratelimited');
}
async function commonsSearch(q) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=14&gsrsearch=' +
    encodeURIComponent('filetype:bitmap ' + q) + '&prop=imageinfo&iiprop=url|mime&iiurlwidth=960';
  const j = await getJSON(u);
  return Object.values((j.query && j.query.pages) || {}).map(p => {
    const ii = p.imageinfo && p.imageinfo[0];
    return ii ? { title: p.title, url: ii.thumburl || ii.url, mime: ii.mime } : null;
  }).filter(Boolean).filter(f => f.mime && /jpeg|png|webp/.test(f.mime));
}
function toStdUrl(raw, width = 960) {
  const clean = String(raw).split('?')[0];
  const m = clean.match(/^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/([^/]+)\/(.*)$/);
  if (!m) return clean;
  let segs = m[2].split('/').filter(Boolean);
  if (segs[0] === 'thumb') segs = segs.slice(1);
  if (segs.length < 3) return clean;
  const file = segs[2];
  return 'https://upload.wikimedia.org/wikipedia/' + m[1] + '/thumb/' + segs[0] + '/' + segs[1] + '/' + file + '/' + width + 'px-' + file;
}

const used = new Set(data.dishes.filter(d => d.image).map(d => toStdUrl(d.image)));
let fixed = 0, removed = 0;
for (const [id, rule] of Object.entries(RULES)) {
  const d = data.dishes.find(x => x.id === id);
  if (!d) continue;
  const titleNow = d.image ? decodeURIComponent(d.image.split('/').pop()) : '';
  const curOk = titleNow && rule.must.some(m => hasPhrase(titleNow, m)) && !rule.ban.some(b => hasPhrase(titleNow, b));
  if (curOk) { console.error('ok ' + id); continue; }

  const queries = [d.name, ...(ALIASES[id] || [])];
  let chosen = null;
  for (const q of queries.slice(0, 3)) {
    let files = [];
    try { files = await commonsSearch(q); } catch { continue; }
    for (const f of files) {
      const t = decodeURIComponent(f.title);
      if (rule.ban.some(b => hasPhrase(t, b))) continue;
      if (!rule.must.some(m => hasPhrase(t, m))) continue;
      const u = toStdUrl(f.url);
      if (used.has(u)) continue;
      chosen = { title: f.title, url: u };
      break;
    }
    if (chosen) break;
  }
  if (chosen) {
    if (d.image) used.delete(toStdUrl(d.image));
    d.image = chosen.url; d.imageVia = 'commons'; d.imageSource = chosen.title; used.add(chosen.url);
    fixed++; console.log('FIX ' + id + ' -> ' + chosen.title);
  } else {
    if (d.image) used.delete(toStdUrl(d.image));
    delete d.image; delete d.imageVia; delete d.imageSource;
    removed++; console.log('BỎ ẢNH ' + id + ' -> dùng SVG art');
  }
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
const via = data.dishes.reduce((m, d) => { m[d.imageVia || 'svg'] = (m[d.imageVia || 'svg'] || 0) + 1; return m; }, {});
console.log('sửa:', fixed, '| bỏ:', removed, '| nguồn:', JSON.stringify(via));
