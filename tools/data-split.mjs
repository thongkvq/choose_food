// tools/data-split.mjs — TÁCH `data/dishes.json` thành dữ liệu nhẹ cho lần tải đầu.
// Sinh ra:
//   data/dishes-lite.json        — trường cần cho băng chuyền, bộ lọc, gacha, phần đầu thẻ kết quả,
//                                  thực đơn hôm nay, bias thời tiết (xem LITE_FIELDS).
//   data/dishes-detail-<k>.json  — phần NẶNG (giới thiệu, facts, mục chi tiết, review dài, tip),
//                                  app chỉ tải khi mở popup món (và prefetch lúc rảnh).
// Ghi đè vẫn tất định: generatedAt lấy nguyên từ dishes.json nên chạy lại ra y hệt
// (tools/data-validate.mjs so từng byte để phát hiện "chưa chạy data-split").
// Dùng: node tools/data-split.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SRC_FILE = ROOT + 'data/dishes.json';
export const LITE_FILE = 'data/dishes-lite.json';
export const DETAIL_PREFIX = 'data/dishes-detail-';
export const CHUNKS = 4;

// Trường giữ ở file LITE: mọi thứ app dùng trước khi mở popup (băng chuyền, lọc, gacha,
// thực đơn hôm nay, bias thời tiết, phần đầu popup) — xác định bằng cách đọc app.js.
export const LITE_FIELDS = [
  'id', 'name', 'emoji', 'region', 'vung', 'dacSan', 'vungCo', 'meals', 'style', 'art', 'c1', 'c2',
  'tags', 'descr', 'price', 'minutes', 'spicy', 'veg', 'weight', 'tier',
  'image', 'imageVia', 'imageSource',
  'rating', 'stars', 'calories', 'protein', 'proteinLabel', 'priceRange', 'fullness',
  'bestFor', 'bestTime', 'origin', 'kw'
];
// Trường NẶNG (chỉ popup dùng): giới thiệu Wikipedia, facts Wikidata, mục chi tiết, review dài, tip.
export const HEAVY_FIELDS = ['review', 'intro', 'introSource', 'wikiUrl', 'wikiTitle', 'introEn', 'facts', 'detail', 'tip'];

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

// buildSplit(raw) -> { files: { 'data/xxx.json': text }, meta: {...} } — thuần, không ghi đĩa.
export function buildSplit(raw) {
  const dishes = raw.dishes || [];
  const count = dishes.length;
  const chunkSize = Math.ceil(count / CHUNKS) || 1;
  const buckets = Array.from({ length: CHUNKS }, () => ({}));
  const lite = dishes.map((d, i) => {
    const k = Math.min(CHUNKS - 1, Math.floor(i / chunkSize));
    buckets[k][d.id] = pick(d, HEAVY_FIELDS);
    return pick(d, LITE_FIELDS);
  });
  const files = {};
  files[LITE_FILE] = JSON.stringify({
    generatedAt: raw.generatedAt, count: count,
    detailChunks: CHUNKS, detailChunkSize: chunkSize,
    liteFields: LITE_FIELDS, detailFields: HEAVY_FIELDS,
    dishes: lite
  }) + '\n';
  for (let k = 0; k < CHUNKS; k++) {
    files[DETAIL_PREFIX + k + '.json'] = JSON.stringify({
      generatedAt: raw.generatedAt, chunk: k, chunks: CHUNKS, chunkSize: chunkSize,
      count: Object.keys(buckets[k]).length, items: buckets[k]
    }) + '\n';
  }
  return { files, meta: { count, chunkSize, chunks: CHUNKS, liteBytes: Buffer.byteLength(files[LITE_FILE]) } };
}

export async function loadSource() {
  return JSON.parse(await readFile(SRC_FILE, 'utf8'));
}

function kb(n) { return (n / 1024).toFixed(1) + 'KB'; }

async function main() {
  const raw = await loadSource();
  const src = await readFile(SRC_FILE);
  const { files, meta } = buildSplit(raw);

  let liteRaw = 0, liteGz = 0, detRaw = 0, detGz = 0, changed = 0;
  for (const [name, text] of Object.entries(files)) {
    const before = await readFile(ROOT + name, 'utf8').catch(() => null);
    if (before !== text) { await writeFile(ROOT + name, text); changed++; }
    const buf = Buffer.from(text);
    const gz = gzipSync(buf).length;
    if (name === LITE_FILE) { liteRaw = buf.length; liteGz = gz; } else { detRaw += buf.length; detGz += gz; }
  }
  const srcGz = gzipSync(src).length;
  console.log('=== TÁCH DỮ LIỆU (data-split) ===');
  console.log('Nguồn  : data/dishes.json         ' + kb(src.length).padStart(8) + ' thô · ' + kb(srcGz).padStart(8) + ' gzip · ' + meta.count + ' món');
  console.log('Lần đầu: ' + LITE_FILE.padEnd(24) + kb(liteRaw).padStart(8) + ' thô · ' + kb(liteGz).padStart(8) + ' gzip');
  console.log('Popup  : ' + (DETAIL_PREFIX + '0..' + (CHUNKS - 1) + '.json').padEnd(24) + kb(detRaw).padStart(8) + ' thô · ' + kb(detGz).padStart(8) + ' gzip (mỗi mảnh ~' + kb(detRaw / CHUNKS) + ' thô / ' + kb(detGz / CHUNKS) + ' gzip)');
  console.log('Tải lần đầu giảm: ' + kb(src.length - liteRaw) + ' thô (' + (((src.length - liteRaw) / src.length) * 100).toFixed(1) + '%) · ' + kb(srcGz - liteGz) + ' gzip (' + (((srcGz - liteGz) / srcGz) * 100).toFixed(1) + '%)');
  console.log('Mảnh chi tiết: ' + CHUNKS + ' × ~' + meta.chunkSize + ' món (công thức chunk = floor(index / detailChunkSize), giống app.js)');
  console.log('File đã ghi: ' + changed + '/' + Object.keys(files).length + (changed ? ' (có thay đổi)' : ' (không đổi)'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
