import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1400);

async function drag(x, yFrom, yTo) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: yFrom }] });
  for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: yFrom + (yTo - yFrom) * i / 14 }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(450);
}
async function at(label) { const y = await page.evaluate(() => Math.round(scrollY)); console.log(label.padEnd(38) + 'scrollY=' + String(y).padStart(5) + (y > 0 ? '  ✓' : '  ✗')); return y; }

await at('1. đầu trang (chưa làm gì)');
await drag(195, 700, 200); await at('2. vuốt lên ở giữa trang');
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
const vp = await page.locator('#rouletteViewport').boundingBox();
await drag(195, vp.y + vp.height - 15, vp.y + 15); await at('3. vuốt NGAY TRÊN băng chuyền');
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
await drag(195, 300, 760); await at('4. vuốt XUỐNG');

// nút bấm to
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
const big = await page.locator('#btnSpinSingle').boundingBox();
console.log('nút QUAY 1 MÓN:', Math.round(big.width) + 'x' + Math.round(big.height) + ' tại y=' + Math.round(big.y));
await page.click('#btnSpinSingle');
await page.waitForTimeout(700);
console.log('   đang quay:', await page.evaluate(() => document.querySelector('#btnSpinSingle').disabled));
await page.waitForTimeout(7200);
console.log('   modal mở:', await page.evaluate(() => !document.querySelector('#modalBackdrop').hidden));
await page.click('#winDialog [data-act="close"]');
await page.waitForTimeout(400);
await drag(195, 600, 200); await at('5. vuốt sau khi đóng modal');

// sheet
await page.click('#btnOpenSheet');
await page.waitForTimeout(700);
await page.click('#btnApplyFilters');
await page.waitForTimeout(600);
await drag(195, 600, 200); await at('6. vuốt sau khi đóng bộ lọc');
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'không');
await ctx.close(); await browser.close();
