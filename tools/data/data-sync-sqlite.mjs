// tools/data/data-sync-sqlite.mjs — đồng bộ data/dishes.json -> data/dishes.sqlite (bảng `dishes`).
// Cùng số món, cùng giá trị (mảng nối bằng '|' đúng như dữ liệu cũ, facts/detail/vungCo lưu JSON text).
// Xoá luôn các dòng SQLite không còn trong JSON.
// Chạy: node tools/data/data-sync-sqlite.mjs
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const JSON_FILE = new URL('../../data/dishes.json', import.meta.url);
const DB_FILE = new URL('../../data/dishes.sqlite', import.meta.url);

const dishes = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')).dishes;
const db = new DatabaseSync(DB_FILE);

const COLS = ['id', 'name', 'emoji', 'region', 'meals', 'style', 'art', 'c1', 'c2', 'tags', 'descr',
  'price', 'minutes', 'spicy', 'veg', 'weight', 'tier', 'image', 'imageVia', 'imageSource',
  'rating', 'stars', 'review', 'calories', 'protein', 'proteinLabel', 'priceRange',
  'fullness', 'bestFor', 'bestTime', 'origin', 'tip', 'intro', 'introSource',
  'wikiUrl', 'wikiTitle', 'facts', 'detail', 'detailSource', 'introEn', 'vung', 'dacSan', 'vungCo'];

// Bảng cũ có thể thiếu cột mới (ví dụ detailSource) → tự thêm trước khi ghi.
const have = new Set(db.prepare('PRAGMA table_info(dishes)').all().map(r => r.name));
for (const c of COLS) if (!have.has(c)) { db.exec('ALTER TABLE dishes ADD COLUMN ' + c + ' TEXT'); console.log('thêm cột', c); }

const join = (v, sep) => Array.isArray(v) ? v.join(sep) : (v ?? null);
const value = (d, c) => {
  switch (c) {
    case 'meals': return join(d.meals, '|');
    case 'tags': return join(d.tags, '|');
    case 'bestFor': return join(d.bestFor, ' | ');
    case 'facts': return d.facts ? JSON.stringify(d.facts) : null;
    case 'detail': return d.detail ? JSON.stringify(d.detail) : null;
    case 'vungCo': return JSON.stringify(d.vungCo || []);
    case 'dacSan': return d.dacSan ? 1 : 0;
    default: return d[c] ?? null;
  }
};

const stmt = db.prepare(
  'INSERT INTO dishes (' + COLS.join(',') + ') VALUES (' + COLS.map(() => '?').join(',') + ')\n' +
  'ON CONFLICT(id) DO UPDATE SET ' + COLS.filter(c => c !== 'id').map(c => c + '=excluded.' + c).join(', ')
);

db.exec('BEGIN');
try {
  for (const d of dishes) stmt.run(...COLS.map(c => value(d, c)));
  const ids = new Set(dishes.map(d => d.id));
  let removed = 0;
  for (const row of db.prepare('SELECT id FROM dishes').all()) {
    if (!ids.has(row.id)) { db.prepare('DELETE FROM dishes WHERE id = ?').run(row.id); removed++; }
  }
  db.exec('COMMIT');
  console.log('đã đồng bộ', dishes.length, 'món →', DB_FILE.pathname, '| xoá dòng thừa:', removed);
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
const total = db.prepare('SELECT count(*) AS c FROM dishes').get().c;
console.log('SQLite hiện có', total, 'dòng');
db.close();
