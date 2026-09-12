// tools/fetch-images.mjs — gán ảnh món ăn THẬT, có kiểm chứng nguồn.
// Cách làm: tra theo LÔ 50 tiêu đề/request (Wikipedia vi -> en) rồi mới tới Commons.
// Chỉ nhận ảnh khi tiêu đề nguồn khớp tên món (token overlap >= 0.6).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UA = 'MonGiDayGacha/1.3 (personal LAN food demo; node)';
const DELAY = Number(process.env.DELAY || 1200);
const OUT = process.env.OUT || 'tools/image-report.json';
const WRITE_JSON = process.env.WRITE_JSON !== '0';
const DO_COMMONS = process.env.DO_COMMONS !== '0';

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
        console.error('429 -> backoff ' + Math.round(ra / 1000) + 's');
        await sleep(ra);
        continue;
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

// Tra 1 lô tối đa 50 tiêu đề -> map: tiêu đề yêu cầu => {title, url}
async function batchTitles(site, titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const u = 'https://' + site + '/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=900&titles=' +
      encodeURIComponent(chunk.join('|'));
    let j;
    try { j = await getJSON(u); } catch (e) { console.error('batch fail ' + site + ': ' + e.message); continue; }
    const normMap = new Map((j.query && j.query.normalized || []).map(x => [x.from, x.to]));
    const redirMap = new Map((j.query && j.query.redirects || []).map(x => [x.from, x.to]));
    const byTitle = new Map();
    for (const p of Object.values((j.query && j.query.pages) || {})) {
      byTitle.set(p.title, p.thumbnail ? { title: p.title, url: p.thumbnail.source } : null);
    }
    for (const req of chunk) {
      const n = normMap.get(req) || req;
      const r = redirMap.get(n) || n;
      const hit = byTitle.get(r);
      if (hit) out.set(req, hit);
    }
  }
  return out;
}

async function commonsCandidates(query) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=' +
    encodeURIComponent('filetype:bitmap ' + query) + '&prop=imageinfo&iiprop=url|mime&iiurlwidth=900';
  const j = await getJSON(u);
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  return pages.map(p => {
    const ii = p.imageinfo && p.imageinfo[0];
    return ii ? { title: p.title, url: ii.thumburl || ii.url, mime: ii.mime } : null;
  }).filter(Boolean).filter(f => !f.mime || /jpeg|png|webp/.test(f.mime));
}

const usedImages = new Map();
const results = new Map();
const dishes = data.dishes;

function candidateTitles(d) {
  const list = [d.name, ...(ALIASES[d.id] || [])].filter(Boolean);
  return [...new Set(list)];
}
function considerBatch(batchMap, site, dish, candidates) {
  const via = site.split('.')[0] + '-wiki';
  const opts = [];
  for (const q of candidates) {
    const hit = batchMap.get(q);
    if (!hit) continue;
    const sc = Math.max(score(q, hit.title), score(dish.name, hit.title));
    if (sc >= 0.6) opts.push({ ...hit, score: sc, via, query: q });
  }
  if (!opts.length) return false;
  opts.sort((a, b) => b.score - a.score);
  const top = opts[0].score;
  let group = opts.filter(o => o.score >= Math.max(0.6, top - 0.15));
  const free = group.filter(o => !usedImages.has(o.url));
  if (free.length) group = free;
  const pick = group[hashIdx(dish.id, group.length)];
  results.set(dish.id, { image: pick.url, via, source: pick.title, score: +pick.score.toFixed(2), query: pick.query });
  usedImages.set(pick.url, dish.id);
  return true;
}

// --- Bước 1 & 2: batch vi + en ---
for (const site of ['vi.wikipedia.org', 'en.wikipedia.org']) {
  const pending = dishes.filter(d => !results.has(d.id));
  const allTitles = [...new Set(pending.flatMap(candidateTitles))];
  console.error(site + ': tra ' + allTitles.length + ' tiêu đề cho ' + pending.length + ' món');
  const map = await batchTitles(site, allTitles);
  let hit = 0;
  for (const d of pending) if (considerBatch(map, site, d, candidateTitles(d))) hit++;
  console.error(site + ': khớp ' + hit);
}

// --- Bước 3: Commons cho các món còn lại ---
let misses = dishes.filter(d => !results.has(d.id));
if (DO_COMMONS && misses.length) {
  console.error('Commons fallback cho ' + misses.length + ' món');
  let n = 0;
  for (const d of misses) {
    const cands = [...new Set([d.name, ...(ALIASES[d.id] || [])])].slice(0, 2);
    let done = false;
    for (const q of cands) {
      let files = [];
      try { files = await commonsCandidates(q); } catch { continue; }
      const scored = files.map(f => ({ ...f, score: Math.max(score(q, f.title), score(d.name, f.title)) }))
        .filter(f => f.score >= 0.6).sort((a, b) => b.score - a.score);
      if (!scored.length) continue;
      const top = scored[0].score;
      let group = scored.filter(s => s.score >= Math.max(0.6, top - 0.15));
      const free = group.filter(s => !usedImages.has(s.url));
      if (free.length) group = free;
      const pick = group[hashIdx(d.id, group.length)];
      results.set(d.id, { image: pick.url, via: 'commons', source: pick.title, score: +pick.score.toFixed(2), query: q });
      usedImages.set(pick.url, d.id);
      done = true;
      break;
    }
    if (++n % 25 === 0) console.error('commons ' + n + '/' + misses.length);
  }
}

// --- Xuất kết quả ---
const list = dishes.map(d => ({ id: d.id, name: d.name, style: d.style, ...(results.get(d.id) || { image: null, via: 'none' }) }));
const stats = list.reduce((m, r) => { m[r.via] = (m[r.via] || 0) + 1; return m; }, {});
console.log('RESOLVED:', JSON.stringify(stats));
if (WRITE_JSON) {
  let changed = 0;
  for (const d of data.dishes) {
    const r = results.get(d.id);
    if (r && r.image) {
      if (d.image !== r.image) changed++;
      d.image = r.image; d.imageVia = r.via; d.imageSource = r.source;
    } else {
      if (d.image) changed++;
      delete d.image; delete d.imageVia; delete d.imageSource;
    }
  }
  await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
  console.log('updated dishes.json, changed:', changed);
}
await writeFile(ROOT + OUT, JSON.stringify({ stats, results: list }, null, 1));
const dups = new Map();
for (const r of list.filter(x => x.image)) { const k = r.image.replace(/\/\d+px-/, '/SIZEpx-'); dups.set(k, (dups.get(k) || 0) + 1); }
console.log('ảnh dùng chung:', [...dups.values()].filter(v => v > 1).length, 'nhóm');
for (const r of list.filter(x => x.image).slice(0, 12)) console.log([r.id, r.via, r.score, r.source].join(' | '));
const missIds = list.filter(x => !x.image).map(x => x.id);
if (missIds.length) console.log('MISSES(' + missIds.length + '):', missIds.join(','));
