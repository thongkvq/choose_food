import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, permissions: ['geolocation'], geolocation: { latitude: 10.7725, longitude: 106.698 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1300);
console.log('=== HTTP (LAN) ===');
console.log('secure context:', await page.evaluate(() => window.isSecureContext), '(false = GPS bị chặn, đúng như mong đợi)');
const b = await page.locator('#btnSpinSingle').boundingBox();
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(7600);
console.log('món:', await page.textContent('.win-name'));
await page.click('[data-act="nearby"]');
await page.waitForTimeout(2500);
console.log('gợi ý mở HTTPS:', await page.evaluate(() => !!document.querySelector('.loc-https')));
console.log('link HTTPS:', await page.evaluate(() => (document.querySelector('.loc-https') || {}).href));
// nhập toạ độ trực tiếp
await page.fill('#locInput', '10.822, 106.6257');
await page.click('[data-act="loc-go"]');
await page.waitForTimeout(20000);
let r = await page.evaluate(() => {
  const out = document.querySelector('#nearbyOut');
  return { info: out.querySelector('.loc-info')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 120),
    note: [...out.querySelectorAll('.nearby-note')].map(n => n.textContent.replace(/\s+/g,' ').trim()).filter(x => !/http/.test(x)).slice(-1)[0],
    shops: [...out.querySelectorAll('.shop')].slice(0, 4).map(s => s.querySelector('b').textContent + ' | ' + s.querySelector('.shop-dist').textContent) };
});
console.log('nhập toạ độ → vị trí:', r.info);
console.log('   ', r.note); r.shops.forEach(s => console.log('    ' + s));
// nhập địa chỉ
await page.fill('#locInput', 'Tân Phú, Hồ Chí Minh');
await page.click('[data-act="loc-go"]');
await page.waitForTimeout(20000);
r = await page.evaluate(() => {
  const out = document.querySelector('#nearbyOut');
  return { info: out.querySelector('.loc-info')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160),
    shops: [...out.querySelectorAll('.shop')].slice(0, 4).map(s => s.querySelector('b').textContent + ' | ' + s.querySelector('.shop-dist').textContent) };
});
console.log('nhập địa chỉ → vị trí:', r.info);
r.shops.forEach(s => console.log('    ' + s));
console.log('lỗi JS:', errs.length ? errs.join(' | ') : 'không');
await page.screenshot({ path: '/var/lib/dsh/Choose foody/tools/screenshots/nearby-http-390.png' });
await ctx.close(); await browser.close();
