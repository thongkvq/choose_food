import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1100);
await page.touchscreen.tap(195, 371);
await page.waitForTimeout(7600);
console.log('sau khi quay - modal mở:', await page.evaluate(() => !document.querySelector('#modalBackdrop').hidden), '| tên:', await page.textContent('.win-name'));
await page.click('#winDialog [data-act="lock"]');
await page.waitForTimeout(600);
const after = await page.evaluate(() => {
  const dlg = document.querySelector('.win-dialog');
  const lock = dlg.querySelector('[data-act="lock"]');
  return {
    stillOpen: !document.querySelector('#modalBackdrop').hidden,
    ribbon: dlg.querySelector('.locked-ribbon')?.textContent.trim() || null,
    btn: lock.textContent.trim(), btnDisabled: lock.disabled,
    rows: dlg.querySelectorAll('.info-row').length, score: dlg.querySelector('.score-num')?.textContent,
    nameStillVisible: (() => { const n = dlg.querySelector('.win-name'); const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()
  };
});
console.log('sau khi CHỐT - thẻ vẫn mở:', after.stillOpen, '| ribbon:', after.ribbon);
console.log('   nút:', after.btn, '(khoá:' + after.btnDisabled + ') | điểm:', after.score, '|', after.rows, 'dòng thông tin | tên trong màn:', after.nameStillVisible);
// đóng rồi quay lại xem còn chặn không
await page.click('#winDialog [data-act="close"]');
await page.waitForTimeout(400);
console.log('đóng được:', await page.evaluate(() => document.querySelector('#modalBackdrop').hidden), '| body scroll khoá:', await page.evaluate(() => document.body.style.overflow || '(không)'));
await page.evaluate(() => window.scrollTo(0, 300));
console.log('cuộn lại được, scrollY =', await page.evaluate(() => Math.round(scrollY)));
console.log('lỗi JS:', errs.length ? errs.join(' | ') : 'không');
await ctx.close(); await browser.close();
