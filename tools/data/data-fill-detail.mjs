// tools/data/data-fill-detail.mjs — ghi mục "Chi tiết" (detail) của món `detailSource: "tong-hop"` từ
// file nội dung viết tay `tools/data/detail-tong-hop.json`.
// TRƯỚC ĐÂY script này TỰ SINH câu theo style/minutes/tags nên nội dung chung chung và sai sự thật
// (vd butter chicken bị gán "rim với nước mắm"). Đã bỏ toàn bộ phần sinh mẫu câu: giờ chỉ đọc file
// nội dung, không tự viết gì. Món tong-hop không có trong file → xoá detail + detailSource.
// KHÔNG đụng món `detailSource: "wikipedia"` (nội dung lấy từ Wikipedia, giữ nguyên).
// Chạy: node tools/data/data-fill-detail.mjs          (ghi file)
//        node tools/data/data-fill-detail.mjs --dry   (chỉ in ra, không ghi)
//        SRC=path/to/dishes.json để chạy trên bản khác (xem trước).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DRY = process.argv.includes('--dry');
const SRC = process.env.SRC || ROOT + 'data/dishes.json';
const MAP_FILE = ROOT + 'tools/data/detail-tong-hop.json';

const data = JSON.parse(await readFile(SRC, 'utf8'));
const MAP = JSON.parse(await readFile(MAP_FILE, 'utf8'));

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const normSections = (secs) => secs
  .filter((s) => s && clean(s.t) && clean(s.body))
  .map((s) => ({ t: clean(s.t), body: clean(s.body) }));

const ids = new Set(data.dishes.map((d) => d.id));
const unknown = Object.keys(MAP).filter((id) => !ids.has(id));

let written = 0, removed = [], untouched = 0, noDetail = [];
const written_ = [];
for (const d of data.dishes) {
  if (d.detailSource !== 'tong-hop') {
    if (Array.isArray(d.detail) && d.detail.length) untouched++;
    else noDetail.push(d.id);
    continue;
  }
  const secs = normSections(Array.isArray(MAP[d.id]) ? MAP[d.id] : []);
  if (!secs.length) {
    delete d.detail;
    delete d.detailSource;
    removed.push(d.id);
    continue;
  }
  d.detail = secs;
  written++;
  written_.push(d.id);
  if (DRY) console.log('--- ' + d.id + ' (' + d.name + ')\n' + secs.map((s) => '[' + s.t + '] ' + s.body).join('\n'));
}

if (!DRY) await writeFile(SRC, JSON.stringify(data, null, 1));
console.log('ghi detail tổng hợp từ ' + MAP_FILE.replace(ROOT, '') + ':', written, 'món');
console.log('xoá detail tong-hop (không có trong file):', removed.length, removed.join(', ') || '(không)');
console.log('giữ nguyên wikipedia:', untouched, '| món chưa có detail:', noDetail.length, noDetail.slice(0, 10).join(', ') + (noDetail.length > 10 ? ' …' : ''));
console.log('id trong file không có trong dishes.json:', unknown.join(', ') || '(không)');
const tongHop = data.dishes.filter((d) => d.detailSource === 'tong-hop').length;
const wiki = data.dishes.filter((d) => d.detailSource === 'wikipedia').length;
const has = data.dishes.filter((d) => Array.isArray(d.detail) && d.detail.length).length;
console.log('ĐỘ PHỦ detail:', has + '/' + data.dishes.length, '| tong-hop:', tongHop, '| wikipedia:', wiki, '| thiếu:', data.dishes.length - has);
