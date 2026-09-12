import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
const b = await page.locator('#btnSpinSingle').boundingBox();
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(7600);
console.log('món:', await page.textContent('.win-name'));
const hasBtn = await page.evaluate(() => !!document.querySelector('[data-act="nearby"]'));
console.log('có nút tìm quán:', hasBtn);
await page.click('[data-act="nearby"]');
await page.waitForTimeout(32000);
const res = await page.evaluate(() => {
  const out = document.querySelector('#nearbyOut');
  return { note: out.querySelector('.nearby-note')?.textContent.trim().slice(0, 120),
    shops: [...out.querySelectorAll('.shop')].slice(0, 6).map(s => s.querySelector('b').textContent + ' | ' + s.querySelector('.shop-dist').textContent + ' | ' + (s.querySelector('.shop-meta').textContent || '').slice(0, 60)),
    links: [...out.querySelectorAll('.nearby-link')].map(a => a.textContent.trim() + ' → ' + a.href.slice(0, 60)),
    dlgScroll: (() => { const d = document.querySelector('.win-dialog'); return d.scrollHeight - d.clientHeight; })() };
});
console.log('ghi chú:', res.note);
console.log('quán:'); res.shops.forEach(s => console.log('   ' + s));
console.log('link:'); res.links.forEach(l => console.log('   ' + l));
console.log('thẻ phải cuộn thêm:', res.dlgScroll > 2 ? res.dlgScroll + 'px' : 'không');
console.log('lỗi JS:', errs.length ? errs.join(' | ') : 'không');
await page.screenshot({ path: '/var/lib/dsh/Choose foody/tools/screenshots/nearby-390.png' });
await ctx.close(); await browser.close();
