// tools/test-all.mjs — chạy TOÀN BỘ test trong tools/ với một base URL (server LAN hoặc bản tĩnh).
// Dùng: node tools/test-all.mjs http://127.0.0.1:4321          (LAN, có /api)
//       node tools/test-all.mjs http://127.0.0.1:4399          (bản tĩnh, mô phỏng Vercel)
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const ONLY = process.argv[3] || '';
const picks = ONLY ? ONLY.split(',') : null;
const DIR = fileURLToPath(new URL('.', import.meta.url));
const RUN = readdirSync(DIR).filter((f) => /^test-.*\.mjs$/.test(f) && f !== 'test-all.mjs')
  .concat(['audit-layout.mjs', 'audit-desktop.mjs', 'verify-desktop-mobile.mjs'])
  .filter((f) => !picks || picks.some((p) => f.includes(p)));

const run = (file) => new Promise((resolve) => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [DIR + file, BASE], { cwd: DIR + '..', env: process.env });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  const timer = setTimeout(() => { out += '\n[TIMEOUT 240s]'; p.kill('SIGKILL'); }, 240000);
  p.on('close', (code) => { clearTimeout(timer); resolve({ file, code, ms: Date.now() - t0, out }); });
});

console.log('=== CHẠY TEST VỚI ' + BASE + ' (' + RUN.length + ' file) ===');
const results = [];
for (const f of RUN) {
  const r = await run(f);
  const lines = r.out.trim().split('\n');
  const verdict = /KẾT QUẢ: FAIL|FAIL\b/.test(r.out) ? 'FAIL' : (r.code === 0 ? 'OK' : 'EXIT ' + r.code);
  console.log('\n----- ' + f + ' [' + verdict + '] ' + Math.round(r.ms / 1000) + 's');
  console.log(lines.slice(-14).join('\n'));
  results.push({ file: f, code: r.code, verdict, ms: r.ms });
}
console.log('\n=== TỔNG HỢP ' + BASE + ' ===');
for (const r of results) console.log(String(r.code).padStart(3) + '  ' + (r.ms / 1000).toFixed(0).padStart(4) + 's  ' + (r.verdict === 'OK' ? 'OK  ' : r.verdict) + '  ' + r.file);
const bad = results.filter((r) => r.code !== 0);
console.log(bad.length ? 'CÓ ' + bad.length + ' FILE KHÔNG SẠCH: ' + bad.map((b) => b.file).join(', ') : 'TẤT CẢ EXIT 0');
