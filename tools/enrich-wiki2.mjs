// tools/enrich-wiki2.mjs — vá: ưu tiên tiếng Việt, lấp 19 món thiếu bằng alias; dọn nhãn nhiễu
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UA = 'MonGiDayGacha/2.1 (personal LAN food demo; node)';
const DELAY = Number(process.env.DELAY || 1200);
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));
const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let last = 0;
async function getJSON(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const w = Math.max(0, DELAY - (Date.now() - last)); if (w) await sleep(w);
    last = Date.now();
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
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
async function extracts(site, titles) {
  const out = new Map();
  for (const part of chunk(titles, 20)) {
    const u = 'https://' + site + '/w/api.php?action=query&format=json&redirects=1&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exlimit=20&titles=' + encodeURIComponent(part.join('|'));
    let j; try { j = await getJSON(u); } catch { continue; }
    const q = j.query || {};
    const nm = new Map((q.normalized || []).map(x => [x.from, x.to]));
    const rm = new Map((q.redirects || []).map(x => [x.from, x.to]));
    const byT = new Map();
    for (const p of Object.values(q.pages || {})) if (p.missing === undefined) byT.set(p.title, { extract: p.extract || '', url: p.fullurl });
    for (const t of part) { let k = nm.get(t) || t; k = rm.get(k) || k; const h = byT.get(k); if (h && h.extract) out.set(t, { ...h, resolved: k }); }
  }
  return out;
}

/* 1) món đang dùng bài tiếng Anh -> thử lại tiếng Việt */
const enIntro = data.dishes.filter(d => d.introSource === 'Wikipedia tiếng Anh' && d.wikiTitle);
console.error('đang dùng bài tiếng Anh:', enIntro.length);
const viTry = await extracts('vi.wikipedia.org', [...new Set(enIntro.map(d => d.wikiTitle))]);
let upgraded = 0;
for (const d of enIntro) {
  const hit = viTry.get(d.wikiTitle);
  if (hit && hit.extract && hit.extract.length > 40) {
    d.intro = hit.extract.replace(/\s+/g, ' ').trim().slice(0, 900);
    d.introSource = 'Wikipedia tiếng Việt';
    d.wikiUrl = hit.url || d.wikiUrl; d.wikiTitle = hit.resolved || d.wikiTitle;
    upgraded++;
  }
}
console.error('nâng lên bản tiếng Việt:', upgraded);

/* 2) món chưa có giới thiệu -> thử lần lượt các alias */
const missing = data.dishes.filter(d => !d.intro);
console.error('còn thiếu giới thiệu:', missing.length);
const tryMap = new Map();
for (const d of missing) {
  const list = [d.name, ...(ALIASES[d.id] || [])].filter(Boolean);
  for (const t of list) if (!tryMap.has(t)) tryMap.set(t, []);
  for (const t of list) tryMap.get(t).push(d.id);
}
const allTitles = [...tryMap.keys()];
const viF = await extracts('vi.wikipedia.org', allTitles);
const enF = await extracts('en.wikipedia.org', allTitles.filter(t => !viF.has(t)));
let filled = 0;
for (const d of missing) {
  const list = [d.name, ...(ALIASES[d.id] || [])].filter(Boolean);
  let done = false;
  for (const t of list) {
    const hit = viF.get(t) || enF.get(t);
    if (hit && hit.extract && hit.extract.length > 60) {
      d.intro = hit.extract.replace(/\s+/g, ' ').trim().slice(0, 900);
      d.introSource = viF.get(t) ? 'Wikipedia tiếng Việt' : 'Wikipedia tiếng Anh';
      d.wikiUrl = hit.url; d.wikiTitle = hit.resolved || t;
      filled++; done = true; break;
    }
  }
  if (!done) console.error('  vẫn thiếu:', d.id);
}
console.error('đã lấp:', filled);

/* 3) dọn nhãn nhiễu + dịch nhãn tiếng Anh hay gặp */
const DROP = new Set(['món ăn', 'thực phẩm', 'thực phẩm thiết yếu', 'baked good', 'finished good', 'dish', 'food', 'staple food', 'convenience food', 'prepared food']);
const TRANS = {
  "baker's yeast": 'men nở', 'chicken egg': 'trứng gà', 'peanut': 'đậu phộng', 'soy sauce': 'nước tương',
  'raw fish': 'cá sống', 'sumeshi': 'cơm giấm', 'rice': 'gạo', 'noodles': 'mì', 'wheat flour': 'bột mì',
  'sugar': 'đường', 'salt': 'muối', 'water': 'nước', 'egg': 'trứng', 'cheese': 'phô mai', 'tomato': 'cà chua',
  'onion': 'hành tây', 'garlic': 'tỏi', 'ginger': 'gừng', 'coconut milk': 'nước cốt dừa', 'chili pepper': 'ớt',
  'lime': 'chanh', 'fish sauce': 'nước mắm', 'mint': 'bạc hà', 'coriander': 'ngò', 'basil': 'húng quế',
  'lemongrass': 'sả', 'turmeric': 'nghệ', 'potato': 'khoai tây', 'beef': 'thịt bò', 'chicken': 'thịt gà',
  'pork': 'thịt heo', 'duck': 'vịt', 'squid': 'mực', 'crab': 'cua', 'clam': 'nghêu', 'oyster': 'hàu',
  'mushroom': 'nấm', 'cabbage': 'bắp cải', 'carrot': 'cà rốt', 'cucumber': 'dưa leo', 'pineapple': 'thơm',
  'mango': 'xoài', 'banana': 'chuối', 'coconut': 'dừa', 'sesame': 'mè', 'bean': 'đậu', 'mung bean': 'đậu xanh',
  'rice paper': 'bánh tráng', 'vermicelli': 'bún', 'quail egg': 'trứng cút', 'tamarindus indica': 'me',
  'rice noodle': 'bún', 'rice noodles': 'bún', 'shrimp': 'tôm', 'tofu': 'đậu hũ', 'flour': 'bột',
  'chicken dish': 'món gà', 'pork dish': 'món heo', 'beef dish': 'món bò', 'fish dish': 'món cá',
  'noodle soup': 'món nước', 'noodle dish': 'món mì', 'rice dish': 'món cơm', 'soup': 'món nước',
  'dessert': 'tráng miệng', 'pastry': 'bánh ngọt', 'bread': 'bánh mì', 'cake': 'bánh ngọt', 'salad': 'gỏi',
  'spring roll': 'chả giò', 'dumpling': 'bánh bao/há cảo', 'pancake': 'bánh xèo/bánh kếp',
  'pasta': 'mì Ý', 'seafood': 'hải sản', 'vegetable': 'rau củ', 'fruit': 'trái cây', 'meat': 'thịt'
};
const tr = (s) => TRANS[String(s).toLowerCase()] || s;
let cleaned = 0;
for (const d of data.dishes) {
  if (!d.facts) continue;
  const f = d.facts;
  if (f.ingredients) { f.ingredients = [...new Set(f.ingredients.map(tr))].filter(x => x && x.length < 40).slice(0, 6); if (!f.ingredients.length) delete f.ingredients; }
  if (f.type) { f.type = [...new Set(f.type.split(', ').map(tr))].filter(x => !DROP.has(String(x).toLowerCase())).slice(0, 3).join(', '); if (!f.type) delete f.type; }
  if (f.originCountry && /Đế quốc Ottoman/.test(f.originCountry)) f.originCountry = 'Thổ Nhĩ Kỳ (Ottoman)';
  if (f.cuisine) f.cuisine = f.cuisine.split(', ').slice(0, 2).join(', ');
  cleaned++;
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
const has = (k) => data.dishes.filter(d => d[k]).length;
console.log('giới thiệu:', has('intro') + '/' + data.dishes.length, '| facts:', has('facts') + ' | xuất xứ:', data.dishes.filter(d => d.facts && d.facts.originCountry).length, '| nguyên liệu:', data.dishes.filter(d => d.facts && d.facts.ingredients).length);
console.log('còn thiếu giới thiệu:', data.dishes.filter(d => !d.intro).map(d => d.id).join(', ') || 'không');
