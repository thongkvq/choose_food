// tools/data-report.mjs — so sánh TRƯỚC/SAU khi bổ sung món (đọc snapshot + dishes.json, chỉ đọc)
import { readFile } from 'node:fs/promises';
const ROOT = new URL('../', import.meta.url);
const now = JSON.parse(await readFile(new URL('data/dishes.json', ROOT), 'utf8')).dishes;
const old = JSON.parse(await readFile(new URL('tools/.snapshot-before-v24.json', ROOT), 'utf8')).dishes;
const newIds = JSON.parse(await readFile(new URL('tools/data-new-dishes.json', ROOT), 'utf8')).map(d => d.id);
const cnt = (a, f) => a.filter(f).length;
const byVung = (a) => { const m = {}; for (const d of a) m[d.vung] = (m[d.vung] || 0) + 1; return m; };
const covLine = (name, f) => console.log('  ' + name + ': ' + cnt(old, f) + '/' + old.length + ' (' + (cnt(old, f) * 100 / old.length).toFixed(1) + '%) -> ' +
  cnt(now, f) + '/' + now.length + ' (' + (cnt(now, f) * 100 / now.length).toFixed(1) + '%)');
console.log('TỔNG MÓN:', old.length, '->', now.length, '(+' + (now.length - old.length) + ')');
console.log('VÙNG GỐC trước:', JSON.stringify(byVung(old)));
console.log('VÙNG GỐC sau  :', JSON.stringify(byVung(now)));
covLine('ảnh   ', d => d.image);
covLine('intro ', d => d.intro);
covLine('facts ', d => d.facts);
covLine('detail', d => d.detail);
const oldNoImg = old.filter(d => !d.image).map(d => d.id);
const nowNoImg = new Set(now.filter(d => !d.image).map(d => d.id));
console.log('13 món cũ thiếu ảnh: nay có ảnh ' + oldNoImg.filter(id => !nowNoImg.has(id)).length + '/' + oldNoImg.length + ' — còn thiếu: ' + oldNoImg.filter(id => nowNoImg.has(id)).join(', '));
const newNoImg = newIds.filter(id => nowNoImg.has(id));
console.log('MÓN MỚI có ảnh: ' + (newIds.length - newNoImg.length) + '/' + newIds.length + ' — không có ảnh (' + newNoImg.length + '): ' + newNoImg.join(', '));
console.log('MÓN MỚI (' + newIds.length + '): ' + newIds.map(id => { const d = now.find(x => x.id === id); return d.name + ' [' + d.vung + (d.image ? ' •ảnh' : '') + ']'; }).join(' | '));
