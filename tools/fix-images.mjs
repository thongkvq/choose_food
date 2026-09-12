// tools/fix-images.mjs — sửa ảnh sai/yếu: bắt buộc từ khoá đúng, cấm từ khoá sai; không tìm được thì bỏ ảnh (dùng SVG art).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DELAY = Number(process.env.DELAY || 1200);
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));

// must: phải có ít nhất 1 từ khoá (đã bỏ dấu, chữ thường); ban: cấm nếu xuất hiện
const RULES = {
  'gio-thu': { must: ['gio thu', 'gio'], ban: ['logo', 'map', '.svg'] },
  'sinh-to-xoai': { must: ['sinh to', 'smoothie', 'mango'], ban: ['map', 'location', 'logo', '.svg'] },
  'kem-bo': { must: ['kem bo', 'avocado ice', 'ice cream'], ban: ['persea', 'plant', 'tree', 'leaf'] },
  'kem-tuoi': { must: ['kem', 'ice cream', 'gelato'], ban: ['chantilly', 'cream cake'] },
  'khoai-lang-chien': { must: ['khoai lang', 'sweet potato'], ban: ['plant', 'flower', 'leaf', 'ipomoea', 'field'] },
  'rau-cau-dua': { must: ['rau cau', 'thach', 'agar', 'jelly'], ban: ['youkan', 'wagashi'] },
  'oc-nhoi': { must: ['oc nhoi', 'oc'], ban: ['common snail', 'helix', 'garden snail'] },
  'nuoc-rau-ma': { must: ['rau ma', 'centella', 'pennywort'], ban: ['starr', 'botanical', 'herbarium'] },
  'nuoc-dau': { must: ['dau do', 'dau den', 'red bean'], ban: ['pie', 'paste', 'bun'] },
  'ca-vien-chien': { must: ['ca vien', 'fish ball'], ban: ['clipped', 'process', 'package'] },
  'salad-ca-ngu': { must: ['salad'], ban: ['sandwich', 'lunch', 'school'] },
  'banh-duc': { must: ['banh duc'], ban: ['banh te', 'banh tet', 'chung'] },
  'cha-com': { must: ['cha com', 'com'], ban: ['chalua', 'cha lua', 'gio'] },
  'com-ga-xoi-mo': { must: ['com ga'], ban: ['salad', 'lunch plate'] },
  'xoi-man': { must: ['xoi'], ban: ['khuc'] },
  'ca-ri-chay': { must: ['ca ri chay', 'vegetable curry', 'rau cu', 'tofu curry'], ban: ['lamb', 'chicken', 'beef', 'pork'] },
  'dau-hu-non': { must: ['dau hu non', 'tofu'], ban: ['making', 'spliting', 'splitting', 'factory'] },
  'banh-tieu': { must: ['banh tieu'], ban: ['pepper bun', 'bao'] },
  'pho-chien-phong': { must: ['pho chien', 'crispy noodle'], ban: ['cau giay'] },
  'chao-trai': { must: ['chao trai', 'chao'], ban: ['pack', 'instant'] },
  'mi-ga': { must: ['mi ga', 'noodle soup', 'mi'], ban: ['cup noodle', 'demae'] },
  'banh-trang-nuong': { must: ['banh trang nuong', 'banh trang'], ban: [] },
  'banh-bot-loc': { must: ['bot loc'], ban: ['beo'] },
  'che-ba-mau': { must: ['che ba mau', 'che'], ban: ['do xanh'] },
  'che-thai': { must: ['che thai', 'che'], ban: ['ba ba'] },
  'thit-kho-tau': { must: ['thit kho'], ban: [] },
  'com-trang-trung': { must: ['rice'], ban: ['brown rice', 'half a cup'] },
  'banh-canh-tom': { must: ['banh canh'], ban: [] },
  'mien-tron': { must: ['mien tron', 'mien'], ban: ['dongfen'] },
  'lau-ca-keo': { must: ['lau ca', 'hot pot'], ban: ['copper', 'tong guo'] },
  'nuoc-mia': { must: ['mia', 'sugarcane'], ban: [] },
  'banh-xeo-nhat': { must: ['banh xeo'], ban: [] },
  'pho-mai-que': { must: ['pho mai que', 'mozzarella'], ban: ['394', 'sliced'] }
};

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 .]+/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const w = Math.max(0, DELAY - (Date.now() - lastCall));
    if (w) await sleep(w);
    lastCall = Date.now();
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(url, { headers: { 'user-agent': 'MonGiDayGacha/1.6 (food demo; node)', accept: 'application/json' }, signal: ctl.signal });
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
// chuẩn hoá về URL thumbnail 960px trên upload.wikimedia.org
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
  const cur = d.image ? norm(decodeURIComponent(d.image.split('/').pop()) + ' ' + (d.imageSource || '')) : '';
  const curBad = !cur || rule.ban.some(b => cur.includes(norm(b))) || !rule.must.some(m => cur.includes(norm(m)));
  if (!curBad) { console.error('ok  ' + id); continue; }

  const queries = [d.name, ...(JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'))[id] || [])];
  let chosen = null;
  for (const q of queries.slice(0, 3)) {
    let files = [];
    try { files = await commonsSearch(q); } catch { continue; }
    const good = files.filter(f => {
      const t = norm(decodeURIComponent(f.title));
      if (rule.ban.some(b => t.includes(norm(b)))) return false;
      if (!rule.must.some(m => t.includes(norm(m)))) return false;
      const u = toStdUrl(f.url);
      if (used.has(u)) return false;
      return true;
    });
    if (good.length) { chosen = { title: good[0].title, url: toStdUrl(good[0].url) }; break; }
  }
  if (chosen) {
    if (d.image) used.delete(toStdUrl(d.image));
    d.image = chosen.url; d.imageVia = 'commons'; d.imageSource = chosen.title;
    used.add(chosen.url);
    fixed++;
    console.log('FIX ' + id + ' -> ' + chosen.title);
  } else {
    if (d.image) used.delete(toStdUrl(d.image));
    delete d.image; delete d.imageVia; delete d.imageSource;
    removed++;
    console.log('BỎ ẢNH ' + id + ' (không tìm được ảnh đúng -> dùng SVG art)');
  }
}
// Bỏ mọi ảnh SVG/không phải ảnh chụp
for (const d of data.dishes) {
  if (d.image && /\.svg$/i.test(d.image)) { console.log('BỎ SVG ' + d.id); delete d.image; delete d.imageVia; delete d.imageSource; removed++; }
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
const via = data.dishes.reduce((m, d) => { m[d.imageVia || 'svg'] = (m[d.imageVia || 'svg'] || 0) + 1; return m; }, {});
console.log('sửa:', fixed, '| bỏ ảnh:', removed, '| nguồn:', JSON.stringify(via));
