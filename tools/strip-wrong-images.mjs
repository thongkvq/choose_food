// tools/strip-wrong-images.mjs — bỏ ảnh sai hẳn, để app dùng hình vẽ SVG cho đúng món.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));
const REMOVE = ['mien-tron', 'cha-com', 'che-thai', 'che-ba-mau', 'mi-ga', 'nuoc-dau'];
let n = 0;
for (const id of REMOVE) {
  const d = data.dishes.find(x => x.id === id);
  if (d && d.image) { console.log('bỏ ảnh:', id, '<-', d.imageSource); delete d.image; delete d.imageVia; delete d.imageSource; n++; }
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
const via = data.dishes.reduce((m, d) => { m[d.imageVia || 'svg'] = (m[d.imageVia || 'svg'] || 0) + 1; return m; }, {});
console.log('đã bỏ:', n, '| nguồn:', JSON.stringify(via));
console.log('món dùng SVG art:', data.dishes.filter(d => !d.image).map(d => d.id).join(', '));
