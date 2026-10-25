// tools/debug-pw.mjs — kiểm tra môi trường chạy chromium (dùng khi test lỗi)
import { createRequire } from 'node:module';
const tries = [
  ['profile web', '/srv/ai-workspaces/dsh-home/profiles/web/'],
  ['cwd', process.cwd() + '/']
];
for (const [label, base] of tries) {
  try {
    const r = createRequire(base);
    const p = r.resolve('playwright');
    console.log('OK   ' + label + ' -> ' + p);
    const { chromium } = r('playwright');
    console.log('     chromium api:', typeof chromium.launch);
  } catch (e) { console.log('FAIL ' + label + ' -> ' + String(e.message).slice(0, 140)); }
}
