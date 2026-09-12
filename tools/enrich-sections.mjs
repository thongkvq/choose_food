// tools/enrich-sections.mjs — lấy thêm các MỤC chi tiết (nguyên liệu, cách làm, biến thể…) từ wikitext Wikipedia
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UA = 'MonGiDayGacha/3.0 (personal LAN food demo; node)';
const DELAY = Number(process.env.DELAY || 1200);
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));

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

/* làm sạch wikitext thành văn bản đọc được */
function cleanWiki(t) {
  let s = String(t || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '');
  s = s.replace(/\{\{[\s\S]*?\}\}/g, ' ');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1');
  s = s.replace(/\[\[File:[^\]]*\]\]/gi, '').replace(/\[\[Tập tin:[^\]]*\]\]/gi, '').replace(/\[\[Hình:[^\]]*\]\]/gi, '');
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/\S+\]/g, '');
  s = s.replace(/'''?/g, '').replace(/<[^>]+>/g, ' ');
  s = s.replace(/^\s*[*#:;]+\s*/gm, '- ').replace(/^\s*\{\|[\s\S]*?\|\}\s*$/gm, '');
  s = s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  return s;
}
const WANT = [
  ['nguyên liệu', ['nguyên liệu', 'thành phần', 'nguyên phụ liệu']],
  ['cách làm', ['cách làm', 'cách chế biến', 'chế biến', 'thực hiện', 'quy trình', 'công thức']],
  ['thưởng thức', ['thưởng thức', 'cách dùng', 'cách ăn', 'trình bày']],
  ['biến thể', ['biến thể', 'các loại', 'loại', 'phiên bản', 'biến tấu']],
  ['nguồn gốc', ['nguồn gốc', 'lịch sử', 'xuất xứ', 'đặc điểm']]
];
function sections(articleTitle, wikitext) {
  const parts = String(wikitext || '').split(/\n(?=={2,}[^=])/);
  const out = [];
  for (const p of parts) {
    const m = p.match(/^={2,}\s*([^=\n]+?)\s*={2,}\s*\n([\s\S]*)$/);
    if (!m) continue;
    const head = m[1].trim().toLowerCase();
    const body = cleanWiki(m[2]);
    if (body.length < 60) continue;
    for (const [label, keys] of WANT) {
      if (keys.some(k => head.includes(k))) {
        out.push({ title: m[1].trim().slice(0, 60), label: label, text: body.slice(0, 900) });
        break;
      }
    }
  }
  // gộp theo nhãn, ưu tiên đoạn dài
  const best = new Map();
  for (const s of out) {
    const cur = best.get(s.label);
    if (!cur || s.text.length > cur.text.length) best.set(s.label, s);
  }
  return [...best.values()].slice(0, 4);
}

const pairs = data.dishes.filter(d => d.intro && d.wikiTitle).map(d => ({
  id: d.id, site: /tiếng Anh/.test(d.introSource || '') ? 'en.wikipedia.org' : 'vi.wikipedia.org', title: d.wikiTitle
}));
console.error('số món cần lấy mục chi tiết:', pairs.length);
const bySite = { 'vi.wikipedia.org': pairs.filter(p => p.site === 'vi.wikipedia.org'), 'en.wikipedia.org': pairs.filter(p => p.site === 'en.wikipedia.org') };
const pages = new Map();   // site|title -> wikitext
for (const [site, list] of Object.entries(bySite)) {
  for (const part of chunk([...new Set(list.map(p => p.title))], 20)) {
    const u = 'https://' + site + '/w/api.php?action=query&format=json&redirects=1&prop=revisions&rvslots=main&rvprop=content&titles=' + encodeURIComponent(part.join('|'));
    let j; try { j = await getJSON(u); } catch (e) { console.error('lỗi ' + site + ': ' + e.message); continue; }
    const q = j.query || {};
    const nm = new Map((q.normalized || []).map(x => [x.from, x.to]));
    const rm = new Map((q.redirects || []).map(x => [x.from, x.to]));
    const got = new Map();
    for (const p of Object.values(q.pages || {})) {
      const rev = p.revisions && p.revisions[0];
      const content = rev && rev.slots && rev.slots.main && rev.slots.main['*'];
      if (content) got.set(p.title, content);
    }
    for (const t of part) { let k = nm.get(t) || t; k = rm.get(k) || k; if (got.has(k)) pages.set(site + '|' + t, got.get(k)); }
    console.error(site + ': đã tải ' + pages.size + ' bài');
  }
}

let nSections = 0, nDishes = 0;
for (const p of pairs) {
  const wt = pages.get(p.site + '|' + p.title);
  if (!wt) continue;
  const secs = sections(p.title, wt);
  const d = data.dishes.find(x => x.id === p.id);
  delete d.detail;
  if (secs.length) {
    d.detail = secs.map(s => ({ t: s.title, body: s.text }));
    nSections += secs.length; nDishes++;
  }
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
console.log('món có mục chi tiết:', nDishes + '/' + data.dishes.length, '| tổng số mục:', nSections);
const sample = ['pho-bo', 'banh-mi-thit', 'pizza', 'pad-thai'].map(id => data.dishes.find(x => x.id === id)).filter(Boolean);
for (const d of sample) {
  console.log('\n★ ' + d.name + ' — ' + (d.detail ? d.detail.length + ' mục' : 'không có'));
  (d.detail || []).forEach(s => console.log('   [' + s.t + '] ' + s.body.slice(0, 160) + '…'));
}
