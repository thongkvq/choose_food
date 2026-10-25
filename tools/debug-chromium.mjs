// tools/debug-chromium.mjs — thử mở chromium thật (kiểm tra lib hệ thống trước khi chạy test)
import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const env = { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' };
for (const exe of ['/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', null]) {
  try {
    const b = await chromium.launch({ executablePath: exe || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], env });
    const p = await b.newPage();
    await p.setContent('<h1>ok</h1>');
    console.log('LAUNCH OK  ' + (exe || '(playwright mặc định)') + '  | ' + (await p.textContent('h1')));
    await b.close();
  } catch (e) { console.log('LAUNCH FAIL ' + (exe || '(playwright mặc định)') + ' -> ' + String(e.message).split('\n')[0]); }
}
