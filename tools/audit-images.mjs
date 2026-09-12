// tools/audit-images.mjs — đối chiếu ảnh với TÊN MÓN VÀ ALIAS (báo cáo độ khớp, không gọi mạng)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));
const ALIASES = JSON.parse(await readFile(ROOT + 'tools/aliases.json', 'utf8'));

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter(t => t.length > 1);
const GENERIC = new Set(['va', 'and', 'the', 'mon', 'an', 'food', 'dish', 'cuisine', 'style', 'jpg', 'jpeg', 'png', 'file', 'photo']);
function score(query, title) {
  const q = toks(query).filter(t => !GENERIC.has(t));
  const t = new Set(toks(title));
  if (!q.length) return 0;
  let hit = 0; for (const tok of q) if (t.has(tok)) hit += 1;
  return hit / q.length;
}
const weak = [], okList = [];
for (const d of data.dishes) {
  if (!d.image) continue;
  const src = String(d.imageSource || '').replace(/^File:/, '');
  const names = [d.name, ...(ALIASES[d.id] || [])];
  const best = Math.max(...names.map(n => score(n, src)), 0);
  (best >= 0.6 ? okList : weak).push({ id: d.id, name: d.name, src, best: +best.toFixed(2), via: d.imageVia });
}
console.log('Món có ảnh:', okList.length + weak.length, '| khớp tên nguồn tốt:', okList.length, '| cần xem lại:', weak.length);
for (const w of weak) console.log('  ?', w.id, '|', w.name, '<-', w.src, '(' + w.via + ', score ' + w.best + ')');
