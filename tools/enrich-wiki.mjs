// tools/enrich-wiki.mjs — thu thập thông tin THẬT từng món từ Wikipedia + Wikidata (tra theo lô, có backoff 429)
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UA = 'MonGiDayGacha/2.0 (personal LAN food demo; node)';
const DELAY = Number(process.env.DELAY || 1200);

const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));
const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let last = 0;
async function getJSON(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const w = Math.max(0, DELAY - (Date.now() - last));
    if (w) await sleep(w);
    last = Date.now();
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 429) { const ra = Number(r.headers.get('retry-after')) * 1000 || 5000 * 2 ** i; console.error('429 -> ' + Math.round(ra / 1000) + 's'); await sleep(ra); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
  throw new Error('ratelimited');
}
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

// 1) tiêu đề bài viết cho từng món: ưu tiên tiêu đề đã dùng để lấy ảnh, rồi alias, rồi tên món
const titleOf = (d) => {
  const fromImage = d.imageSource && /^(vi|en)-wiki$/.test(d.imageVia || '') ? String(d.imageSource).replace(/^File:/, '') : null;
  return fromImage || (ALIASES[d.id] || [])[0] || d.name;
};

/* ---------- 1. Lấy Q-id (Wikidata) + đoạn giới thiệu (extract) từ Wikipedia ---------- */
async function fetchWiki(site, items) {
  const out = new Map();   // title -> { qid, extract, pageUrl }
  for (const part of chunk(items, 20)) {
    const titles = part.map(x => x.title);
    const u = 'https://' + site + '/w/api.php?action=query&format=json&redirects=1&prop=extracts|pageprops|info&inprop=url' +
      '&exintro=1&explaintext=1&exlimit=20&ppprop=wikibase_item&titles=' + encodeURIComponent(titles.join('|'));
    let j;
    try { j = await getJSON(u); } catch (e) { console.error(site + ' lỗi: ' + e.message); continue; }
    const q = j.query || {};
    const normMap = new Map((q.normalized || []).map(x => [x.from, x.to]));
    const redirMap = new Map((q.redirects || []).map(x => [x.from, x.to]));
    const byTitle = new Map();
    for (const p of Object.values(q.pages || {})) {
      if (p.missing !== undefined) continue;
      byTitle.set(p.title, {
        qid: p.pageprops && p.pageprops.wikibase_item,
        extract: p.extract || '',
        pageUrl: p.fullurl || null
      });
    }
    for (const it of part) {
      let t = normMap.get(it.title) || it.title;
      t = redirMap.get(t) || t;
      const hit = byTitle.get(t);
      if (hit && (hit.extract || hit.qid)) out.set(it.id, { ...hit, requestedTitle: it.title, resolvedTitle: t, site });
    }
    console.error(site + ': ' + out.size + '/' + items.length + ' món có dữ liệu');
  }
  return out;
}

const wanted = data.dishes.map(d => ({ id: d.id, title: titleOf(d) }));
const wiki = new Map();
// vi trước
const viHits = await fetchWiki('vi.wikipedia.org', wanted);
for (const [id, v] of viHits) wiki.set(id, v);
// en cho những món chưa có (hoặc extract quá ngắn)
const needEn = data.dishes.filter(d => {
  const v = wiki.get(d.id);
  return !v || !v.extract || v.extract.length < 80;
}).map(d => ({ id: d.id, title: titleOf(d) }));
console.error('cần tra tiếng Anh:', needEn.length);
const enHits = await fetchWiki('en.wikipedia.org', needEn);
for (const [id, v] of enHits) {
  const cur = wiki.get(id);
  if (!cur || (v.extract || '').length > (cur.extract || '').length) wiki.set(id, v);
}

/* ---------- 2. Wikidata: xuất xứ, ẩm thực, nguyên liệu, loại món ---------- */
const P = { P495: 'country', P2012: 'cuisine', P527: 'parts', P186: 'material', P279: 'subclass', P361: 'partOf', P138: 'namedAfter' };
const qids = [...new Set([...wiki.values()].map(v => v.qid).filter(Boolean))];
console.error('Q-id cần lấy:', qids.length);
const claims = new Map();   // qid -> { prop: [qid,...] }
for (const part of chunk(qids, 50)) {
  const u = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=' + part.join('|');
  let j;
  try { j = await getJSON(u); } catch (e) { console.error('wikidata lỗi: ' + e.message); continue; }
  for (const [qid, ent] of Object.entries(j.entities || {})) {
    const c = {};
    for (const [prop, key] of Object.entries(P)) {
      const arr = (ent.claims && ent.claims[prop]) || [];
      const vals = [];
      for (const st of arr) {
        const dv = st.mainsnak && st.mainsnak.datavalue;
        if (dv && dv.type === 'wikibase-entityid' && dv.value && dv.value.id) vals.push(dv.value.id);
      }
      if (vals.length) c[key] = vals.slice(0, 6);
    }
    if (Object.keys(c).length) claims.set(qid, c);
  }
}
// nhãn cho tất cả Q-id liên quan
const labelIds = [...new Set([...claims.values()].flatMap(c => Object.values(c).flat()))];
console.error('Q-id cần nhãn:', labelIds.length);
const labels = new Map();
for (const part of chunk(labelIds, 50)) {
  const u = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=vi|en&ids=' + part.join('|');
  let j;
  try { j = await getJSON(u); } catch (e) { console.error('labels lỗi: ' + e.message); continue; }
  for (const [qid, ent] of Object.entries(j.entities || {})) {
    const L = ent.labels || {};
    const name = (L.vi && L.vi.value) || (L.en && L.en.value);
    if (name) labels.set(qid, name);
  }
}

/* ---------- 3. Ghép vào dishes.json ---------- */
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
let nIntro = 0, nFacts = 0;
for (const d of data.dishes) {
  const w = wiki.get(d.id);
  delete d.intro; delete d.introSource; delete d.wikiUrl; delete d.facts;
  if (w && w.extract && w.extract.length > 40) {
    d.intro = clean(w.extract).slice(0, 900);
    d.introSource = w.site === 'vi.wikipedia.org' ? 'Wikipedia tiếng Việt' : 'Wikipedia tiếng Anh';
    d.wikiUrl = w.pageUrl || ('https://' + w.site + '/wiki/' + encodeURIComponent(w.resolvedTitle || w.requestedTitle));
    d.wikiTitle = w.resolvedTitle || w.requestedTitle;
    nIntro++;
  }
  const c = w && w.qid ? claims.get(w.qid) : null;
  if (c) {
    const map = (k) => (c[k] || []).map(q => labels.get(q)).filter(Boolean);
    const facts = {};
    const country = map('country'); if (country.length) facts.originCountry = country.slice(0, 2).join(', ');
    const cuisine = map('cuisine'); if (cuisine.length) facts.cuisine = cuisine.slice(0, 2).join(', ');
    const parts = [...new Set([...map('parts'), ...map('material')])]; if (parts.length) facts.ingredients = parts.slice(0, 6);
    const sub = map('subclass'); if (sub.length) facts.type = sub.slice(0, 2).join(', ');
    const named = map('namedAfter'); if (named.length) facts.namedAfter = named[0];
    if (Object.keys(facts).length) { d.facts = facts; nFacts++; }
  }
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
console.log('KẾT QUẢ: có giới thiệu Wikipedia:', nIntro + '/' + data.dishes.length, '| có dữ liệu Wikidata:', nFacts);
const hasFacts = data.dishes.filter(d => d.facts);
const withIngredients = data.dishes.filter(d => d.facts && d.facts.ingredients && d.facts.ingredients.length);
const withCountry = data.dishes.filter(d => d.facts && d.facts.originCountry);
console.log('  có xuất xứ:', withCountry.length, '| có nguyên liệu:', withIngredients.length);
for (const id of ['pho-bo', 'banh-mi-thit', 'sushi', 'pad-thai', 'pizza', 'bun-bo-hue']) {
  const d = data.dishes.find(x => x.id === id);
  console.log('\n★ ' + d.name + ' [' + (d.wikiTitle || 'không có bài') + ']');
  console.log('   giới thiệu: ' + (d.intro ? d.intro.slice(0, 150) + '…' : '(không có)'));
  console.log('   facts: ' + JSON.stringify(d.facts || {}));
}
