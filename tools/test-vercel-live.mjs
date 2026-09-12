import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const URL_ = process.argv[2] || 'https://choose-food-paroda.vercel.app';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 458, height: 1017 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  permissions: ['geolocation'], geolocation: { latitude: 10.7725, longitude: 106.698 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const failed = []; page.on('requestfailed', r => failed.push(r.url().slice(0, 70) + ' → ' + (r.failure()||{}).errorText));
await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(4000);
console.log('1. TRANG:', await page.title(), '| app đã nạp:', await page.evaluate(() => !!window.__mgd));
console.log('   chip bối cảnh:', (await page.textContent('#ctxChip')).replace(/\s+/g,' ').trim());
await page.click('#btnSpinSingle');
await page.waitForTimeout(8000);
const win = await page.evaluate(() => ({ open: !document.querySelector('#modalBackdrop').hidden, name: document.querySelector('.win-name')?.textContent.trim(), rows: document.querySelectorAll('.info-row').length, intro: !!document.querySelector('.intro'), detail: !!document.querySelector('[data-act="detail"]') }));
console.log('2. POPUP:', win.open, '|', win.name, '|', win.rows, 'dòng thông tin | giới thiệu:', win.intro, '| chi tiết:', win.detail);
await page.click('[data-act="nearby"]');
await page.waitForTimeout(25000);
const nb = await page.evaluate(() => {
  const out = document.querySelector('#nearbyOut');
  return { info: out.querySelector('.loc-info')?.textContent.replace(/\s+/g,' ').trim().slice(0,80),
    note: [...out.querySelectorAll('.nearby-note')].map(n=>n.textContent.replace(/\s+/g,' ').trim()).slice(-1)[0],
    shops: [...out.querySelectorAll('.shop')].slice(0,4).map(s => s.querySelector('b').textContent + ' | ' + s.querySelector('.shop-dist').textContent) };
});
console.log('3. QUÁN GẦN ĐÂY:', nb.info);
console.log('   ', nb.note);
nb.shops.forEach(s => console.log('     ' + s));
console.log('4. lỗi JS:', errs.length ? errs.slice(0,3).join(' | ') : 'không');
console.log('5. request lỗi:', failed.length ? failed.slice(0,3).join(' | ') : 'không');
await page.screenshot({ path: '/var/lib/dsh/Choose foody/tools/screenshots/vercel-live.png' });
await ctx.close(); await browser.close();
