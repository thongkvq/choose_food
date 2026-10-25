// tools/data-enrich-info.mjs — bổ sung THÔNG TIN cho món đang thiếu: intro + introSource
// + wikiUrl + wikiTitle (Wikipedia), facts (Wikidata), detail (mục trong wikitext).
// Chỉ điền vào chỗ TRỐNG, không ghi đè dữ liệu đã có. Bài tiếng Anh được dịch sang tiếng Việt;
// không dịch được thì BỎ TRỐNG (không nhét tiếng Anh vào intro).
// Chạy: node tools/data-enrich-info.mjs   (TARGETS=id1,id2 để giới hạn; DRY=1 để không ghi)
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UA = 'MonGiDayGacha/2.4 (personal LAN food demo; node)';
const DELAY = Number(process.env.DELAY || 1000);
const DRY = process.env.DRY === '1';
const ONLY = (process.env.TARGETS || '').split(',').map(s => s.trim()).filter(Boolean);

const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter(t => t.length > 1);
const GENERIC = new Set(['va', 'and', 'the', 'mon', 'an', 'food', 'dish', 'cuisine', 'style']);
// alias quá chung: khớp được bài Wikipedia KHÁC món -> cấm dùng để tra nội dung.
// (Các bài "chủ đề cha" như Rau muống, Bánh bò, Cá trích… thì VẪN dùng được: wikiTitle ghi rõ
//  bài nào, đúng quy ước sẵn có của dự án — ví dụ banh-trang-nuong mượn bài "Bánh tráng".)
const SKIP = new Set(['Chè', 'Phở', 'Miến', 'Chả', 'Atisô', 'Instant noodle', 'Tôm rang', 'Mắm chưng',
  'Bún sứa', 'Bánh ram', 'Gà nướng than', 'Chè đậu đỏ', 'Ipomoea aquatica', 'Water spinach',
  'Mì trứng', 'Cá linh chiên', 'Hainanese chicken rice', 'Bánh pía Sóc Trăng', 'Atisô Đà Lạt',
  'Bánh tráng', 'Bánh ít']);

// khớp CHẶT: bài viết phải chứa trọn mọi token của tên món/alias (và tên phải có >= 2 token)
function score(query, title) {
  const q = toks(query).filter(t => !GENERIC.has(t));
  const t = new Set(toks(title));
  if (q.length < 2) return 0;
  let hit = 0; for (const tok of q) if (t.has(tok)) hit += 1;
  return hit / q.length;
}
const queriesFor = (d) => [...new Set([d.name, ...(ALIASES[d.id] || [])].filter(t => t && !SKIP.has(t)))];
const titleOk = (d, title) => queriesFor(d).some(q => score(q, title) >= 1);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let last = 0;
async function getJSON(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const w = Math.max(0, DELAY - (Date.now() - last)); if (w) await sleep(w);
    last = Date.now();
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 429) { const ra = Number(r.headers.get('retry-after')) * 1000 || 5000 * 2 ** i; console.error('429 -> ' + Math.round(ra / 1000) + 's'); await sleep(ra); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
  throw new Error('ratelimited');
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

/* ---------- 1. lấy extract + qid + wikitext theo tiêu đề đã xác thực ---------- */
async function fetchArticles(site, titles) {
  const out = new Map();   // tiêu đề yêu cầu -> {title, extract, qid, url}
  for (const part of chunk(titles, 20)) {
    const u = 'https://' + site + '/w/api.php?action=query&format=json&redirects=1&prop=extracts|pageprops|info' +
      '&inprop=url&exintro=1&explaintext=1&exlimit=20&ppprop=wikibase_item&titles=' + encodeURIComponent(part.join('|'));
    let j; try { j = await getJSON(u); } catch (e) { console.error('extract fail ' + site + ' ' + e.message); continue; }
    const q = j.query || {};
    const nm = new Map((q.normalized || []).map(x => [x.from, x.to]));
    const rm = new Map((q.redirects || []).map(x => [x.from, x.to]));
    const byT = new Map();
    for (const p of Object.values(q.pages || {})) {
      if (p.missing !== undefined) continue;
      byT.set(p.title, { title: p.title, extract: p.extract || '', qid: p.pageprops && p.pageprops.wikibase_item, url: p.fullurl });
    }
    for (const req of part) { let k = nm.get(req) || req; k = rm.get(k) || k; const h = byT.get(k); if (h) out.set(req, h); }
  }
  return out;
}
function cleanWiki(t) {
  let s = String(t || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '');
  s = s.replace(/\{\{[\s\S]*?\}\}/g, ' ');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1');
  s = s.replace(/\[\[(?:File|Tập tin|Hình|Image):[^\]]*\]\]/gi, '');
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/\S+\]/g, '');
  s = s.replace(/'''?/g, '').replace(/<[^>]+>/g, ' ');
  s = s.replace(/^\s*[*#:;]+\s*/gm, '- ');
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}
const WANT = [['nguồn gốc', ['nguồn gốc', 'lịch sử', 'xuất xứ']], ['nguyên liệu', ['nguyên liệu', 'thành phần']],
  ['cách làm', ['cách làm', 'chế biến', 'công thức', 'quy trình', 'thực hiện']],
  ['thưởng thức', ['thưởng thức', 'cách dùng', 'cách ăn', 'trình bày']],
  ['biến thể', ['biến thể', 'các loại', 'phiên bản', 'biến tấu']]];
function sectionsFromWikitext(wt) {
  const parts = String(wt || '').split(/\n(?=={2,}[^=])/);
  const out = [];
  for (const p of parts) {
    const m = p.match(/^={2,}\s*([^=\n]+?)\s*={2,}\s*\n([\s\S]*)$/);
    if (!m) continue;
    const head = m[1].trim().toLowerCase();
    const body = cleanWiki(m[2]);
    if (body.length < 60) continue;
    for (const [label, keys] of WANT) {
      if (keys.some(k => head.includes(k))) { out.push({ t: m[1].trim().slice(0, 60), body: body.slice(0, 900) }); break; }
    }
    if (out.length >= 4) break;
  }
  return out;
}

/* ---------- 2. Wikidata ---------- */
const P = { P495: 'country', P2012: 'cuisine', P527: 'parts', P186: 'material', P279: 'subclass', P138: 'namedAfter' };
async function wikidataFacts(qids) {
  const claims = new Map();
  for (const part of chunk(qids, 50)) {
    let j; try { j = await getJSON('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=' + part.join('|')); } catch { continue; }
    for (const [qid, ent] of Object.entries(j.entities || {})) {
      const c = {};
      for (const [prop, key] of Object.entries(P)) {
        const vals = [];
        for (const st of (ent.claims && ent.claims[prop]) || []) {
          const dv = st.mainsnak && st.mainsnak.datavalue;
          if (dv && dv.type === 'wikibase-entityid' && dv.value && dv.value.id) vals.push(dv.value.id);
        }
        if (vals.length) c[key] = vals.slice(0, 6);
      }
      if (Object.keys(c).length) claims.set(qid, c);
    }
  }
  const labelIds = [...new Set([...claims.values()].flatMap(c => Object.values(c).flat()))];
  const labels = new Map();
  for (const part of chunk(labelIds, 50)) {
    let j; try { j = await getJSON('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=vi|en&ids=' + part.join('|')); } catch { continue; }
    for (const [qid, ent] of Object.entries(j.entities || {})) {
      const L = ent.labels || {};
      const name = (L.vi && L.vi.value) || (L.en && L.en.value);
      if (name) labels.set(qid, name);
    }
  }
  const out = new Map();
  for (const [qid, c] of claims) {
    const map = (k) => (c[k] || []).map(q => labels.get(q)).filter(Boolean);
    const f = {};
    const country = map('country'); if (country.length) f.originCountry = country.slice(0, 2).join(', ');
    const cuisine = map('cuisine'); if (cuisine.length) f.cuisine = cuisine.slice(0, 2).join(', ');
    const parts = [...new Set([...map('parts'), ...map('material')])]; if (parts.length) f.ingredients = parts.slice(0, 6);
    const sub = map('subclass'); if (sub.length) f.type = sub.slice(0, 2).join(', ');
    const named = map('namedAfter'); if (named.length) f.namedAfter = named[0];
    if (Object.keys(f).length) out.set(qid, f);
  }
  return out;
}

/* ---------- 3. dịch EN -> VI ---------- */
const cacheFile = ROOT + 'tools/.translate-cache.json';
let cache = {}; try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); } catch {}
async function translate(text) {
  const key = String(text).slice(0, 220);
  if (cache[key]) return cache[key];
  const q = encodeURIComponent(String(text).slice(0, 1800));
  for (let i = 0; i < 3; i++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch('https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=vi&q=' + q,
        { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile' }, signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 429) { await sleep(4000 * (i + 1)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const out = Array.isArray(j) ? (Array.isArray(j[0]) ? j[0][0] : j[0]) : (j && j.sentences ? j.sentences.map(s => s.trans).join('') : null);
      if (out && typeof out === 'string' && out.trim()) { cache[key] = out.trim(); return out.trim(); }
    } catch { await sleep(1500 * (i + 1)); }
  }
  return null;
}

/* ---------- chạy ---------- */
let targets = data.dishes.filter(d => !d.intro || !d.facts || !d.detail);
if (ONLY.length) { const s = new Set(ONLY); targets = data.dishes.filter(d => s.has(d.id)); }
console.error('món cần bổ sung thông tin:', targets.length);

const needIntro = targets.filter(d => !d.intro);
const titleToDishes = new Map();
for (const d of targets) for (const q of queriesFor(d)) {
  if (!titleToDishes.has(q)) titleToDishes.set(q, []);
  titleToDishes.get(q).push(d);
}
const allTitles = [...titleToDishes.keys()];
console.error('tiêu đề sẽ tra:', allTitles.length);

const viHits = await fetchArticles('vi.wikipedia.org', allTitles);
const enTitles = allTitles.filter(t => !viHits.has(t));
const enHits = enTitles.length ? await fetchArticles('en.wikipedia.org', enTitles) : new Map();
console.error('vi-wiki có bài:', viHits.size, '| en-wiki có bài:', enHits.size);

const pickArticle = (d) => {
  for (const q of queriesFor(d)) {
    const v = viHits.get(q);
    if (v && v.extract && v.extract.length > 40 && titleOk(d, v.title)) return { ...v, site: 'vi' };
  }
  for (const q of queriesFor(d)) {
    const e = enHits.get(q);
    if (e && e.extract && e.extract.length > 40 && titleOk(d, e.title)) return { ...e, site: 'en' };
  }
  return null;
};

const qidOf = new Map();
const chosen = new Map();
for (const d of targets) {
  const a = pickArticle(d);
  if (!a) continue;
  chosen.set(d.id, a);
  if (a.qid) qidOf.set(d.id, a.qid);
}
console.error('món có bài khớp tên:', chosen.size, '| có Q-id:', qidOf.size);

const factsByQid = qidOf.size ? await wikidataFacts([...new Set(qidOf.values())]) : new Map();

// wikitext cho các món còn thiếu `detail`
const needDetail = targets.filter(d => !d.detail && chosen.has(d.id));
const sectionsById = new Map();
for (const d of needDetail) {
  const a = chosen.get(d.id);
  const site = a.site === 'vi' ? 'vi.wikipedia.org' : 'en.wikipedia.org';
  try {
    const j = await getJSON('https://' + site + '/w/api.php?action=parse&format=json&redirects=1&prop=wikitext&page=' + encodeURIComponent(a.title));
    const secs = sectionsFromWikitext(j.parse && j.parse.wikitext && j.parse.wikitext['*']);
    if (secs.length) sectionsById.set(d.id, secs);
  } catch (e) { console.error('wikitext fail ' + d.id + ': ' + e.message); }
}
console.error('món lấy được mục chi tiết:', sectionsById.size);

let nIntro = 0, nFacts = 0, nDetail = 0, nWiki = 0, nTrans = 0, failedTrans = [];
for (const d of targets) {
  const a = chosen.get(d.id);
  if (!a) continue;
  if (!d.intro) {
    if (a.site === 'vi') {
      d.intro = a.extract.replace(/\s+/g, ' ').trim().slice(0, 900);
      d.introSource = 'Wikipedia tiếng Việt';
    } else {
      const vi = await translate(a.extract);
      if (vi) { d.introEn = a.extract.replace(/\s+/g, ' ').trim().slice(0, 900); d.intro = vi.replace(/\s+/g, ' ').trim().slice(0, 900); d.introSource = 'Wikipedia tiếng Anh (đã dịch)'; nTrans++; }
      else failedTrans.push(d.id);
    }
    if (d.intro) nIntro++;
  }
  if (!d.wikiUrl) { d.wikiUrl = a.url; d.wikiTitle = a.title; nWiki++; }
  if (!d.facts) { const f = a.qid ? factsByQid.get(a.qid) : null; if (f) { d.facts = f; nFacts++; } }
  if (!d.detail) { const s = sectionsById.get(d.id); if (s && s.length) { d.detail = s; nDetail++; } }
  if (d.introEn) await writeFile(cacheFile, JSON.stringify(cache));
}
await writeFile(cacheFile, JSON.stringify(cache));

if (!DRY) await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
const cov = (k) => data.dishes.filter(d => d[k] && (!Array.isArray(d[k]) || d[k].length) && (!(typeof d[k] === 'object') || Array.isArray(d[k]) || Object.keys(d[k]).length)).length + '/' + data.dishes.length;
console.log('điền intro:', nIntro, '| wikiUrl:', nWiki, '| facts:', nFacts, '| detail:', nDetail, '| dịch EN->VI:', nTrans);
if (failedTrans.length) console.log('không dịch được (để trống):', failedTrans.join(', '));
console.log('ĐỘ PHỦ mới — intro:', cov('intro'), '| facts:', cov('facts'), '| detail:', cov('detail'));
console.log('còn thiếu intro (' + data.dishes.filter(d => !d.intro).length + '):', data.dishes.filter(d => !d.intro).map(d => d.id).join(', ') || 'không');
console.log('còn thiếu facts (' + data.dishes.filter(d => !d.facts).length + '):', data.dishes.filter(d => !d.facts).map(d => d.id).join(', ') || 'không');
console.log('còn thiếu detail (' + data.dishes.filter(d => !d.detail).length + '):', data.dishes.filter(d => !d.detail).map(d => d.id).join(', ') || 'không');
