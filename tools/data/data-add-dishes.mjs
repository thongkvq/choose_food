// tools/data/data-add-dishes.mjs — gộp món mới (tools/data/data-new-dishes.json) vào data/dishes.json.
// Idempotent: món đã có id (hoặc tên chuẩn hoá đã tồn tại) thì bỏ qua.
// Sau script này PHẢI chạy: node tools/data/enrich-vung.mjs  (để tính vung/dacSan/vungCo)
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FILE = ROOT + 'data/dishes.json';
const SRC = ROOT + 'tools/data/data-new-dishes.json';

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const data = JSON.parse(await readFile(FILE, 'utf8'));
const incoming = JSON.parse(await readFile(SRC, 'utf8'));

const haveIds = new Set(data.dishes.map(d => d.id));
const haveNames = new Set(data.dishes.map(d => norm(d.name)));

// khoá gốc của một món (không tính vung/dacSan/vungCo do enrich-vung sinh ra)
const KEY_ORDER = ['id', 'name', 'emoji', 'region', 'meals', 'style', 'art', 'c1', 'c2', 'tags', 'descr',
  'price', 'minutes', 'spicy', 'veg', 'weight', 'tier', 'image', 'imageVia', 'imageSource',
  'rating', 'stars', 'review', 'calories', 'protein', 'proteinLabel', 'priceRange', 'fullness',
  'bestFor', 'bestTime', 'origin', 'tip', 'intro', 'introSource', 'wikiUrl', 'wikiTitle',
  'facts', 'kw', 'detail'];

let added = 0, skipped = 0;
const log = [];
for (const raw of incoming) {
  if (haveIds.has(raw.id)) { skipped++; log.push('bỏ qua (đã có id): ' + raw.id); continue; }
  if (haveNames.has(norm(raw.name))) { skipped++; log.push('bỏ qua (trùng tên): ' + raw.id + ' ~ ' + raw.name); continue; }
  // kiểm tra đủ trường bắt buộc trước khi ghi
  const missing = ['id', 'name', 'emoji', 'region', 'meals', 'style', 'art', 'c1', 'c2', 'tags', 'descr',
    'price', 'minutes', 'spicy', 'veg', 'weight', 'tier', 'rating', 'stars', 'review', 'calories',
    'protein', 'proteinLabel', 'priceRange', 'fullness', 'bestFor', 'bestTime', 'origin', 'tip', 'kw']
    .filter(k => raw[k] === undefined || raw[k] === '' || (Array.isArray(raw[k]) && !raw[k].length));
  if (missing.length) throw new Error(raw.id + ' thiếu trường: ' + missing.join(', '));
  if (raw.region !== 'vn') throw new Error(raw.id + ': món mới phải có region="vn"');
  const out = {};
  for (const k of KEY_ORDER) if (raw[k] !== undefined) out[k] = raw[k];
  const extra = Object.keys(raw).filter(k => !KEY_ORDER.includes(k));
  if (extra.length) throw new Error(raw.id + ' có khoá lạ: ' + extra.join(', '));
  data.dishes.push(out);
  haveIds.add(raw.id);
  haveNames.add(norm(raw.name));
  added++;
}

data.count = data.dishes.length;
data.generatedAt = new Date().toISOString();
await writeFile(FILE, JSON.stringify(data, null, 1) + '\n');

console.log('thêm mới:', added, '| bỏ qua:', skipped, '| tổng món:', data.dishes.length);
for (const l of log) console.log('  ' + l);
