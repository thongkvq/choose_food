// tools/data-fetch-images.mjs — tra ảnh THẬT cho các món ĐANG THIẾU ảnh.
// Quy trình README "Nguồn ảnh món ăn": Wikipedia vi → en → Commons; tiêu đề nguồn phải
// khớp TRỌN tên món; không dùng lại ảnh của món khác; URL ép về thumbnail
// upload.wikimedia.org 960px. Không tìm được ảnh ĐÚNG thì để trống (app dùng SVG art).
//
// Chạy:  node tools/data-fetch-images.mjs                 (món chưa có ảnh)
//        TARGETS=id1,id2 node tools/data-fetch-images.mjs (tra lại đúng các id này, bỏ ảnh cũ)
//        DRY=1 ... để chỉ in ra, không ghi file.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UA = 'MonGiDayGacha/2.4 (personal LAN food demo; node)';
const DELAY = Number(process.env.DELAY || 900);
const DRY = process.env.DRY === '1';
const WIDTH = 960;
const TARGETS = (process.env.TARGETS || '').split(',').map(s => s.trim()).filter(Boolean);

// Bẫy chuẩn hoá bỏ dấu: "cảnh"->canh, "cáy"->cay, "trẻ"->tre, "Phan Rang"->rang…
// Các tiêu đề dưới đây ĐÃ trùng token với tên món nhưng KHÔNG phải món đó → cấm tuyệt đối.
const DENY_TITLES = [
  'Cửa Việt', 'Demae Itcho', 'Vùng Cùa', 'bình phun', 'Gỏi cá trê', 'Bánh cáy',
  'Iûnn-lâu', 'Nuôi tôm', 'Thuận Hải', 'giao thừa', 'Bánh tằm cà ri', 'Điên điển',
  'Cá trích', 'Cá linh', 'Lươn', 'Atisô',
  // "cốm"~"cơm", "miễn"~"miến", "trọn"~"trộn", "trưng"~"trứng", "cây"~"cay" sau khi bỏ dấu
  'Cơm tấm sườn chả', 'Viettel', 'Bánh mì đặc trưng', 'Bánh ram ngọt', 'Trang trí Tết'
];
// alias quá chung, không dùng để tra ảnh (vẫn giữ trong aliases.json cho việc khác)
const IMG_SKIP_ALIASES = {
  'mi-ga': ['Instant noodle', 'Mì trứng'],
  'ca-linh-chien-gion': ['Cá linh', 'Cá linh chiên'],
  'goi-ca-trich': ['Cá trích'],
  'luon-um-la-nhau': ['Lươn'],
  'banh-tam-bi': ['Bánh tằm'],
  'banh-trang-cuon-thit-heo': ['Bánh tráng'],
  'banh-xeo-tom-nhay': ['Bánh xèo'],
  'banh-ram-it': ['Bánh ít', 'Bánh ram'],
  'banh-bo-thot-not': ['Bánh bò'],
  'rau-muong-xao-toi': ['Rau muống', 'Ipomoea aquatica', 'Water spinach'],
  'tra-atiso-da-lat': ['Atisô'],
  'ga-nuong-ban-don': ['Gà nướng than'],
  'tre-binh-dinh': ['Tré'],
  'tom-rang-me': ['Tôm rang'],
  'canh-cua-rau-day': ['Canh cua'],
  'mam-chung-thit': ['Mắm chưng'],
  'bun-sua-nha-trang': ['Bún sứa']
};

const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter(t => t.length > 1);
const GENERIC = new Set(['va', 'and', 'the', 'mon', 'an', 'food', 'dish', 'cuisine', 'style', 'jpg', 'jpeg', 'png', 'file', 'photo']);
// CHẶT: một tiêu đề chỉ được nhận khi CHỨA TRỌN mọi token của tên món/alias
// (query >= 2 token để tên một chữ như "Phở", "Miến", "Chè" không khớp bừa).
function score(query, title) {
  const q = toks(query).filter(t => !GENERIC.has(t));
  const t = new Set(toks(title));
  if (q.length < 2) return 0;
  let hit = 0; for (const tok of q) if (t.has(tok)) hit += 1;
  return hit / q.length;
}
const queries = (d) => {
  const skip = new Set(IMG_SKIP_ALIASES[d.id] || []);
  return [...new Set([d.name, ...(ALIASES[d.id] || [])].filter(t => t && !skip.has(t)))];
};
const tScore = (d, title) => {
  let best = 0;
  for (const q of queries(d)) best = Math.max(best, score(q, title), score(d.name, title));
  return best;
};
const denied = (title) => DENY_TITLES.some(bad => norm(title).includes(norm(bad)));
function hashIdx(id, n) { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h) % n; }

// URL Wikimedia -> thumbnail upload.wikimedia.org đúng bậc cho phép (bỏ thumb.wikimedia.org + query tracking)
function toThumb(raw) {
  if (!raw) return null;
  const clean = String(raw).split('?')[0];
  const m = clean.match(/^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/([^/]+)\/(.*)$/);
  if (!m) return null;
  const wiki = m[1];
  let segs = m[2].split('/').filter(Boolean);
  if (segs[0] === 'thumb') segs = segs.slice(1);
  if (segs.length < 3) return null;
  const file = segs[2];
  if (/\.svg$/i.test(file)) return null;
  return 'https://upload.wikimedia.org/wikipedia/' + wiki + '/thumb/' + segs[0] + '/' + segs[1] + '/' + file + '/' + WIDTH + 'px-' + file;
}
const dupKey = (u) => String(u).replace(/\/\d+px-/, '/SIZEpx-');

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
        await sleep(ra); continue;
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

async function batchTitles(site, titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const u = 'https://' + site + '/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=1280&titles=' +
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
      if (byTitle.has(r)) out.set(req, byTitle.get(r));
    }
  }
  return out;
}

async function commonsCandidates(query) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=' +
    encodeURIComponent('filetype:bitmap ' + query) + '&prop=imageinfo&iiprop=url|mime&iiurlwidth=1280';
  const j = await getJSON(u);
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  return pages.map(p => {
    const ii = p.imageinfo && p.imageinfo[0];
    return ii ? { title: p.title, url: ii.thumburl || ii.url, mime: ii.mime } : null;
  }).filter(Boolean).filter(f => !f.mime || /jpeg|png|webp/.test(f.mime));
}

/* ---------- mục tiêu ---------- */
let targets = data.dishes.filter(d => !d.image);
if (TARGETS.length) {
  const set = new Set(TARGETS);
  targets = data.dishes.filter(d => set.has(d.id));
  for (const d of targets) { delete d.image; delete d.imageVia; delete d.imageSource; }   // tra lại từ đầu
}
const used = new Map();  // dupKey -> dish id (ảnh của mọi món NGOÀI danh sách mục tiêu)
const targetIds = new Set(targets.map(d => d.id));
for (const d of data.dishes) if (d.image && !targetIds.has(d.id)) used.set(dupKey(d.image), d.id);
console.error('món cần ảnh:', targets.length, '| ảnh đang dùng:', used.size);

const MIN_SCORE = 1;   // phải khớp TRỌN tên món
const results = new Map();
const candidateTitles = (d) => queries(d);

function tryAssign(d, opts, via) {
  // chỉ lấy ảnh CHƯA bị món khác dùng; nếu hết ảnh rảnh thì để trống (thà thiếu còn hơn trùng/sai)
  const free = opts.filter(o => !used.has(dupKey(o.thumb)));
  if (!free.length) return false;
  const pick = free[hashIdx(d.id, free.length)];
  // imageSource PHẢI là tiêu đề của đúng file được chọn (không phải tiêu đề điểm cao nhất)
  results.set(d.id, { image: pick.thumb, via, source: pick.title, score: +pick.score.toFixed(2) });
  used.set(dupKey(pick.thumb), d.id);
  return true;
}

for (const site of ['vi.wikipedia.org', 'en.wikipedia.org']) {
  const pending = targets.filter(d => !results.has(d.id));
  if (!pending.length) break;
  const allTitles = [...new Set(pending.flatMap(candidateTitles))];
  console.error(site + ': tra ' + allTitles.length + ' tiêu đề cho ' + pending.length + ' món');
  const map = await batchTitles(site, allTitles);
  let hit = 0;
  for (const d of pending) {
    const via = site.split('.')[0] + '-wiki';
    const opts = [];
    for (const q of candidateTitles(d)) {
      const h = map.get(q);
      if (!h || !h.url) continue;
      if (denied(h.title)) continue;
      const thumb = toThumb(h.url);
      if (!thumb) continue;
      const sc = Math.max(tScore(d, h.title), score(q, h.title));
      if (sc >= MIN_SCORE) opts.push({ thumb, title: h.title, score: sc, query: q });
    }
    if (!opts.length) continue;
    opts.sort((a, b) => b.score - a.score);
    if (tryAssign(d, opts, via)) hit++;
  }
  console.error(site + ': khớp ' + hit);
}

const misses = targets.filter(d => !results.has(d.id));
if (misses.length) {
  console.error('Commons fallback cho ' + misses.length + ' món');
  let n = 0;
  for (const d of misses) {
    for (const q of candidateTitles(d).slice(0, 4)) {
      let files = [];
      try { files = await commonsCandidates(q); } catch { continue; }
      const scored = files.map(f => ({ thumb: toThumb(f.url), title: f.title, score: Math.max(tScore(d, f.title), score(q, f.title)) }))
        .filter(f => f.thumb && f.score >= MIN_SCORE && !denied(f.title)).sort((a, b) => b.score - a.score);
      if (!scored.length) continue;
      if (tryAssign(d, scored, 'commons')) break;
    }
    if (++n % 10 === 0) console.error('  commons ' + n + '/' + misses.length);
  }
}

/* ---------- ghi ---------- */
let wrote = 0;
for (const d of targets) {
  const r = results.get(d.id);
  if (!r) continue;
  d.image = r.image; d.imageVia = r.via; d.imageSource = r.source;
  wrote++;
  console.log('+' + d.id + ' | ' + r.via + ' | ' + r.score + ' | ' + r.source);
}
if (!DRY) await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
console.log('gán ảnh mới:', wrote, '| còn thiếu:', targets.length - wrote);
console.log('CÒN THIẾU ẢNH:', targets.filter(d => !results.has(d.id)).map(d => d.id).join(', ') || '(không)');
