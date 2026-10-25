// tools/data-validate.mjs — KIỂM TRA DỮ LIỆU món ăn (chỉ đọc, exit 1 nếu có lỗi).
// Kiểm: id duy nhất · đủ trường bắt buộc · enum hợp lệ (region, meals, style, art, tier, vung…)
//       · ảnh: URL thumbnail upload.wikimedia.org hợp lệ, không trùng, imageSource khớp tên món
//       · intro đi kèm introSource/wikiUrl/wikiTitle · JSON khớp SQLite (data/dishes.sqlite)
// Dùng: node tools/data-validate.mjs
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { ART_TEMPLATES } from '../art.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const JSON_FILE = ROOT + 'data/dishes.json';
const DB_FILE = ROOT + 'data/dishes.sqlite';

const raw = JSON.parse(await readFile(JSON_FILE, 'utf8'));
const dishes = raw.dishes;
const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));

const errors = [], warnings = [];
const err = (id, m) => errors.push(id + ': ' + m);
const warn = (id, m) => warnings.push(id + ': ' + m);

const REGION = new Set(['tr', 'in', 'vn', 'cn', 'kr', 'mx', 'jp', 'fr', 'th', 'it', 'us']);
const VUNG = new Set(['bac', 'trung', 'nam', 'tay-nam-bo', 'tay-nguyen', 'vn', 'ngoai']);
const VN_REGS = ['bac', 'trung', 'nam', 'tay-nam-bo', 'tay-nguyen'];
const MEALS = new Set(['sang', 'trua', 'xe', 'toi', 'vat', 'khuya']);
const STYLE = new Set(['ngot', 'kho', 'nuong', 'nuoc', 'hap', 'chien', 'cuon', 'lau', 'uong', 'tron', 'song']);
const ART = new Set(ART_TEMPLATES);
const VIA = new Set(['vi-wiki', 'en-wiki', 'commons']);
const PROTEIN_LABEL = new Set(['Thấp', 'Trung bình', 'Vừa', 'Cao', 'Rất cao']);
const FACT_KEYS = new Set(['originCountry', 'cuisine', 'ingredients', 'type', 'namedAfter']);
// vungCo KHÔNG nằm trong danh sách này: món ngoài VN hợp lệ khi vungCo = [] (kiểm riêng bên dưới)
const REQUIRED = ['id', 'name', 'emoji', 'region', 'vung', 'dacSan', 'meals', 'style', 'art', 'c1', 'c2',
  'tags', 'descr', 'price', 'minutes', 'spicy', 'veg', 'weight', 'tier', 'rating', 'stars', 'review', 'calories',
  'protein', 'proteinLabel', 'priceRange', 'fullness', 'bestFor', 'bestTime', 'origin', 'tip', 'kw'];
const IMG_RE = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/.+\/\d+px-.+$/;

// ---------- nội dung dishes.json ----------
if (raw.count !== dishes.length) err('dishes.json', 'count=' + raw.count + ' nhưng có ' + dishes.length + ' món');
if (typeof raw.generatedAt !== 'string') err('dishes.json', 'thiếu generatedAt');

const ids = new Set(), names = new Set();
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter(t => t.length > 1);
const GENERIC = new Set(['va', 'and', 'the', 'mon', 'an', 'food', 'dish', 'cuisine', 'style', 'jpg', 'jpeg', 'png', 'file', 'photo']);
const score = (q, t) => {
  const a = toks(q).filter(x => !GENERIC.has(x)); const b = new Set(toks(t));
  if (!a.length) return 0;
  let h = 0; for (const x of a) if (b.has(x)) h += 1;
  return h / a.length;
};
const imgKey = (u) => String(u).replace(/\/\d+px-/, '/SIZEpx-');
const imgByKey = new Map();
const seenKeys = new Set();

for (const d of dishes) {
  const id = d.id || '(không id)';
  if (!d.id) err(id, 'thiếu id');
  if (ids.has(d.id)) err(id, 'id trùng'); ids.add(d.id);
  if (names.has(norm(d.name))) err(id, 'tên trùng sau chuẩn hoá: ' + d.name); names.add(norm(d.name));
  if (!/^[a-z0-9-]+$/.test(String(d.id))) warn(id, 'id không phải slug ASCII (dữ liệu cũ, giữ nguyên)');
  for (const k of REQUIRED) {
    const v = d[k];
    if (v === undefined || v === null || v === '') err(id, 'thiếu trường ' + k);
    else if (Array.isArray(v) && !v.length) err(id, 'trường ' + k + ' rỗng');
  }
  // khoá lạ
  const OPTIONAL = ['vungCo', 'image', 'imageVia', 'imageSource', 'intro', 'introSource', 'wikiUrl',
    'wikiTitle', 'facts', 'detail', 'introEn'];
  for (const k of Object.keys(d)) if (!REQUIRED.includes(k) && !OPTIONAL.includes(k)) warn(id, 'khoá lạ: ' + k);
  if (!REGION.has(d.region)) err(id, 'region lạ: ' + d.region);
  if (!VUNG.has(d.vung)) err(id, 'vung lạ: ' + d.vung);
  if (typeof d.dacSan !== 'boolean') err(id, 'dacSan phải boolean');
  if (!Array.isArray(d.vungCo)) err(id, 'vungCo phải mảng');
  else {
    if (new Set(d.vungCo).size !== d.vungCo.length) err(id, 'vungCo trùng phần tử');
    for (const v of d.vungCo) if (!VN_REGS.includes(v)) err(id, 'vungCo lạ: ' + v);
    if (d.region !== 'vn' && d.vungCo.length) err(id, 'món ngoài VN phải có vungCo rỗng');
    if (d.region === 'vn' && !d.vungCo.length) err(id, 'món Việt phải có vungCo');
    if (d.dacSan && d.vung !== 'vn' && !d.vungCo.includes(d.vung)) err(id, 'đặc sản phải bán ở vùng gốc ' + d.vung);
  }
  if (!Array.isArray(d.meals) || !d.meals.length) err(id, 'meals phải có ít nhất 1 bữa');
  else for (const m of d.meals) if (!MEALS.has(m)) err(id, 'meals lạ: ' + m);
  if (!STYLE.has(d.style)) err(id, 'style lạ: ' + d.style);
  if (!ART.has(d.art)) err(id, 'art không có trong art.js: ' + d.art);
  for (const c of ['c1', 'c2']) if (!/^#[0-9a-fA-F]{6}$/.test(String(d[c] || ''))) err(id, c + ' không phải mã màu hex: ' + d[c]);
  if (![1, 2, 3, 4].includes(d.price)) err(id, 'price ngoài 1..4: ' + d.price);
  if (![1, 2, 3, 4].includes(d.tier)) err(id, 'tier ngoài 1..4: ' + d.tier);
  if (!Number.isFinite(d.minutes) || d.minutes < 1 || d.minutes > 600) err(id, 'minutes bất thường: ' + d.minutes);
  if (![0, 1, 2, 3].includes(d.spicy)) err(id, 'spicy ngoài 0..3: ' + d.spicy);
  if (![0, 1].includes(d.veg)) err(id, 'veg phải 0/1: ' + d.veg);
  if (!Number.isFinite(d.weight) || d.weight <= 0) err(id, 'weight bất thường: ' + d.weight);
  if (!Number.isFinite(d.rating) || d.rating < 1 || d.rating > 10) err(id, 'rating ngoài 1..10: ' + d.rating);
  if (!Number.isFinite(d.stars) || d.stars < 0 || d.stars > 5) err(id, 'stars ngoài 0..5: ' + d.stars);
  if (!Number.isFinite(d.calories) || d.calories <= 0) err(id, 'calories bất thường: ' + d.calories);
  if (!Number.isFinite(d.protein) || d.protein < 0) err(id, 'protein bất thường: ' + d.protein);
  if (!PROTEIN_LABEL.has(d.proteinLabel)) err(id, 'proteinLabel lạ: ' + d.proteinLabel);
  if (!Number.isInteger(d.fullness) || d.fullness < 1 || d.fullness > 5) err(id, 'fullness ngoài 1..5: ' + d.fullness);
  if (!Array.isArray(d.bestFor) || !d.bestFor.length) err(id, 'bestFor rỗng');
  if (!Array.isArray(d.tags) || !d.tags.length) err(id, 'tags rỗng');
  if (!Array.isArray(d.kw) || !d.kw.length) err(id, 'kw rỗng');

  // ảnh
  if (d.image) {
    if (!IMG_RE.test(d.image)) err(id, 'URL ảnh không phải thumbnail upload.wikimedia.org: ' + d.image);
    if (!VIA.has(d.imageVia)) err(id, 'imageVia lạ: ' + d.imageVia);
    if (!d.imageSource) err(id, 'có ảnh nhưng thiếu imageSource');
    const k = imgKey(d.image);
    if (seenKeys.has(k)) err(id, 'ảnh trùng với ' + imgByKey.get(k)); else { seenKeys.add(k); imgByKey.set(k, id); }
    // tên nguồn phải khớp tên món hoặc alias (ngưỡng 0.5 như audit-images)
    const src = String(d.imageSource || '').replace(/^File:/, '');
    const best = Math.max(0, ...[d.name, ...(ALIASES[d.id] || [])].map(n => score(n, src)));
    // tên nguồn lệch tên món chỉ là CẢNH BÁO (dữ liệu cũ có ảnh Commons tên tiếng Anh)
    if (best < 0.5) warn(id, 'imageSource hơi lệch tên món: "' + d.imageSource + '" (điểm ' + best.toFixed(2) + ')');
  } else {
    if (d.imageVia || d.imageSource) err(id, 'không có image nhưng vẫn còn imageVia/imageSource');
  }

  // giới thiệu
  const introParts = ['intro', 'introSource', 'wikiUrl', 'wikiTitle'].filter(k => d[k]);
  if (introParts.length && introParts.length !== 4) err(id, 'intro phải đi kèm đủ introSource/wikiUrl/wikiTitle (có: ' + introParts.join(',') + ')');
  if (d.wikiUrl && !/^https:\/\/(vi|en)\.wikipedia\.org\/wiki\//.test(d.wikiUrl)) err(id, 'wikiUrl lạ: ' + d.wikiUrl);
  if (d.facts) {
    if (typeof d.facts !== 'object' || Array.isArray(d.facts)) err(id, 'facts phải là object');
    else for (const k of Object.keys(d.facts)) if (!FACT_KEYS.has(k)) warn(id, 'facts có khoá lạ: ' + k);
  }
  if (d.detail) {
    if (!Array.isArray(d.detail) || !d.detail.length) err(id, 'detail phải là mảng không rỗng');
    else for (const s of d.detail) if (!s || !s.t || !s.body) err(id, 'detail thiếu t/body');
  }
}

// ---------- khớp SQLite ----------
let dbRows = [];
if (!existsSync(DB_FILE)) err('sqlite', 'không tìm thấy ' + DB_FILE);
else {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  dbRows = db.prepare('SELECT * FROM dishes').all();
  db.close();
  if (dbRows.length !== dishes.length) err('sqlite', 'số dòng ' + dbRows.length + ' != ' + dishes.length + ' món trong JSON');
  const byId = new Map(dbRows.map(r => [r.id, r]));
  const join = (v, sep) => Array.isArray(v) ? v.join(sep) : (v ?? null);
  for (const d of dishes) {
    const r = byId.get(d.id);
    if (!r) { err(d.id, 'không có trong SQLite'); continue; }
    const pairs = [
      ['name', d.name], ['emoji', d.emoji], ['region', d.region], ['meals', join(d.meals, '|')],
      ['style', d.style], ['art', d.art], ['c1', d.c1], ['c2', d.c2], ['tags', join(d.tags, '|')],
      ['descr', d.descr], ['price', d.price], ['minutes', d.minutes], ['spicy', d.spicy], ['veg', d.veg],
      ['weight', d.weight], ['tier', d.tier], ['image', d.image ?? null], ['imageVia', d.imageVia ?? null],
      ['imageSource', d.imageSource ?? null], ['rating', d.rating], ['stars', d.stars], ['review', d.review],
      ['calories', d.calories], ['protein', d.protein], ['proteinLabel', d.proteinLabel],
      ['priceRange', d.priceRange], ['fullness', d.fullness], ['bestFor', join(d.bestFor, ' | ')],
      ['bestTime', d.bestTime], ['origin', d.origin], ['tip', d.tip], ['intro', d.intro ?? null],
      ['introSource', d.introSource ?? null], ['wikiUrl', d.wikiUrl ?? null], ['wikiTitle', d.wikiTitle ?? null],
      ['facts', d.facts ? JSON.stringify(d.facts) : null], ['detail', d.detail ? JSON.stringify(d.detail) : null],
      ['introEn', d.introEn ?? null], ['vung', d.vung], ['dacSan', d.dacSan ? 1 : 0],
      ['vungCo', JSON.stringify(d.vungCo || [])]
    ];
    for (const [col, want] of pairs) {
      const got = r[col];
      const a = typeof got === 'number' && typeof want === 'number' ? got : String(got ?? '');
      const b = typeof got === 'number' && typeof want === 'number' ? want : String(want ?? '');
      if (a !== b) err(d.id, 'SQLite.' + col + ' lệch: db="' + String(got).slice(0, 60) + '" json="' + String(want).slice(0, 60) + '"');
    }
  }
}

// ---------- độ phủ ----------
const n = dishes.length;
const cov = (f) => dishes.filter(f).length;
const pct = (x) => (x * 100 / n).toFixed(1) + '%';
console.log('=== KIỂM TRA DỮ LIỆU MÓN ĂN ===');
console.log('Tổng món:', n, '| SQLite:', dbRows.length);
const byVung = {};
for (const d of dishes) byVung[d.vung] = (byVung[d.vung] || 0) + 1;
console.log('Theo vùng gốc:', JSON.stringify(byVung));
console.log('Độ phủ ảnh   :', cov(d => d.image) + '/' + n, '(' + pct(cov(d => d.image)) + ') — SVG art:', n - cov(d => d.image));
console.log('Độ phủ intro :', cov(d => d.intro) + '/' + n, '(' + pct(cov(d => d.intro)) + ')');
console.log('Độ phủ facts :', cov(d => d.facts) + '/' + n, '(' + pct(cov(d => d.facts)) + ')');
console.log('Độ phủ detail:', cov(d => d.detail) + '/' + n, '(' + pct(cov(d => d.detail)) + ')');
const via = {};
for (const d of dishes) if (d.image) via[d.imageVia] = (via[d.imageVia] || 0) + 1;
console.log('Nguồn ảnh:', JSON.stringify(via));
console.log('Lỗi:', errors.length, '| Cảnh báo:', warnings.length);
const shown = Number(process.env.WARN_LIMIT || 10);
for (const w of warnings.slice(0, shown)) console.log('  ! ' + w);
if (warnings.length > shown) console.log('  ! … còn ' + (warnings.length - shown) + ' cảnh báo (đặt WARN_LIMIT để xem thêm)');
for (const e of errors.slice(0, 40)) console.log('  ✗ ' + e);
if (errors.length > 40) console.log('  ✗ … còn ' + (errors.length - 40) + ' lỗi');
console.log(errors.length ? 'KẾT QUẢ: THẤT BẠI' : 'KẾT QUẢ: OK');
process.exit(errors.length ? 1 : 0);
