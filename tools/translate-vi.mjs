// tools/translate-vi.mjs — dịch nội dung tiếng Anh (giới thiệu, mục chi tiết, nhãn) sang tiếng Việt
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DELAY = Number(process.env.DELAY || 1200);
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));
const cacheFile = ROOT + 'tools/.translate-cache.json';
let cache = {};
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); } catch {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let last = 0;
async function translate(text) {
  const key = String(text).slice(0, 220);
  if (cache[key]) return cache[key];
  const w = Math.max(0, DELAY - (Date.now() - last)); if (w) await sleep(w); last = Date.now();
  const q = encodeURIComponent(String(text).slice(0, 1800));
  // 1) Google (dict-chrome-ex)
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
    } catch (e) { await sleep(1500 * (i + 1)); }
  }
  // 2) MyMemory dự phòng
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch('https://api.mymemory.translated.net/get?langpair=en|vi&q=' + q, { headers: { 'user-agent': 'MonGiDay/3.1' }, signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    const out = j && j.responseData && j.responseData.translatedText;
    if (out && out.trim() && !/^MYMEMORY WARNING/i.test(out)) { cache[key] = out.trim(); return out.trim(); }
  } catch (e) {}
  return null;
}
function saveCache() { return writeFile(cacheFile, JSON.stringify(cache)); }

/* 1) giới thiệu tiếng Anh */
const enIntro = data.dishes.filter(d => d.intro && /tiếng Anh/.test(d.introSource || ''));
console.error('giới thiệu cần dịch:', enIntro.length);
let doneIntro = 0;
for (const d of enIntro) {
  const vi = await translate(d.intro);
  if (vi) { d.introEn = d.intro; d.intro = vi; d.introSource = 'Wikipedia tiếng Anh (đã dịch)'; doneIntro++; }
  if (doneIntro % 10 === 0) { await saveCache(); console.error('  đã dịch ' + doneIntro + '/' + enIntro.length); }
}

/* 2) mục chi tiết của bài tiếng Anh */
const enDetail = data.dishes.filter(d => Array.isArray(d.detail) && /tiếng Anh/.test(d.introSource || ''));
console.error('món có mục chi tiết tiếng Anh:', enDetail.length);
let doneSec = 0;
for (const d of enDetail) {
  for (const s of d.detail) {
    const vi = await translate(s.body);
    if (vi) { s.bodyEn = s.body; s.body = vi; doneSec++; }
  }
  await saveCache();
}

/* 3) nhãn facts còn tiếng Anh */
const isEnglish = (s) => /^[\x00-\x7F]+$/.test(String(s)) && /[a-z]{3}/.test(String(s)) && !/\b(pho|banh|bun|com|mi|cha|nem|goi|xoi|che|ca|thit|ga|bo|heo|tom|cua|muc)\b/.test(String(s).toLowerCase());
const labels = new Set();
for (const d of data.dishes) {
  const f = d.facts; if (!f) continue;
  (f.ingredients || []).forEach(x => { if (isEnglish(x)) labels.add(x); });
  if (f.type && isEnglish(f.type)) f.type.split(', ').forEach(x => { if (isEnglish(x)) labels.add(x); });
  if (f.cuisine && isEnglish(f.cuisine)) labels.add(f.cuisine);
  if (f.originCountry && isEnglish(f.originCountry)) labels.add(f.originCountry);
}
console.error('nhãn tiếng Anh cần dịch:', labels.size);
const map = {};
for (const lab of labels) { const vi = await translate(lab); if (vi) map[lab] = vi; }
for (const d of data.dishes) {
  const f = d.facts; if (!f) continue;
  if (f.ingredients) f.ingredients = [...new Set(f.ingredients.map(x => map[x] || x))];
  if (f.type) f.type = [...new Set(f.type.split(', ').map(x => map[x] || x))].join(', ');
  if (f.cuisine && map[f.cuisine]) f.cuisine = map[f.cuisine];
  if (f.originCountry && map[f.originCountry]) f.originCountry = map[f.originCountry];
}

await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
await saveCache();
const stillEn = data.dishes.filter(d => /tiếng Anh/.test(d.introSource || '')).length;
console.log('đã dịch giới thiệu:', doneIntro, '| mục chi tiết:', doneSec, '| nhãn:', Object.keys(map).length);
console.log('còn lại tiếng Anh:', stillEn, '| tổng giới thiệu tiếng Việt:', data.dishes.filter(d => d.intro && /tiếng Việt|đã dịch/.test(d.introSource || '')).length + '/' + data.dishes.filter(d => d.intro).length);
const s = data.dishes.filter(d => d.introEn).slice(0, 3);
for (const d of s) console.log('\n★ ' + d.name + '\n   EN: ' + d.introEn.slice(0, 100) + '\n   VI: ' + d.intro.slice(0, 130));
