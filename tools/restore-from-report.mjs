// tools/restore-from-report.mjs — khôi phục URL ảnh gốc từ tools/image-report.json
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const report = JSON.parse(await readFile(ROOT + 'tools/image-report.json', 'utf8'));
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));
const byId = new Map(report.results.map(r => [r.id, r]));
let restored = 0, cleared = 0;
for (const d of data.dishes) {
  const r = byId.get(d.id);
  if (r && r.image) {
    d.image = r.image; d.imageVia = r.via; d.imageSource = r.source; restored++;
  } else {
    delete d.image; delete d.imageVia; delete d.imageSource; cleared++;
  }
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
console.log('khôi phục:', restored, '| xoá (không có trong report):', cleared);
