import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const ROOT = '/var/lib/dsh/Choose foody';
const NEW_FIELDS = ['rating','stars','review','calories','protein','proteinLabel','priceRange','fullness','bestFor','bestTime','origin','tip','imageVia','imageSource'];
const raw = JSON.parse(await readFile(ROOT + '/data/dishes.json', 'utf8'));
for (const d of raw.dishes) for (const k of NEW_FIELDS) delete d[k];
const old = JSON.stringify(raw);

const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/data/dishes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: old }));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1300);
await page.click('#btnSpinSingle');
await page.waitForTimeout(7700);
const p = await page.evaluate(() => {
  const dlg = document.querySelector('.win-dialog');
  return {
    open: !document.querySelector('#modalBackdrop').hidden,
    name: dlg.querySelector('.win-name')?.textContent.trim(),
    rows: [...dlg.querySelectorAll('.info-row')].map(r => r.querySelector('.k').textContent),
    score: dlg.querySelector('.score-num')?.textContent || '(không có — đúng, vì dữ liệu cũ không có điểm)',
    hasActions: !!dlg.querySelector('[data-act="lock"]')
  };
});
console.log('DỮ LIỆU CŨ → popup hiện:', p.open, '| món:', p.name);
console.log('   điểm:', p.score);
console.log('   các dòng thông tin:', p.rows.join(', '));
console.log('   có nút chốt:', p.hasActions);
console.log('   lỗi JS:', errs.length ? errs.join(' | ') : 'không');
await ctx.close(); await browser.close();
