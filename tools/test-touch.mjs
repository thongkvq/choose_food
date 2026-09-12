// tools/test-touch.mjs — kiểm thử thao tác chạm/vuốt trên chromium thật
import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1500);

const box = await page.locator('#rouletteMachine').boundingBox();
const cardBox = await page.locator('#rouletteTrack .rcard').first().boundingBox();
console.log('máy quay:', Math.round(box.width) + 'x' + Math.round(box.height) + ' | thẻ đầu:', Math.round(cardBox.width) + 'x' + Math.round(cardBox.height));

// 1) chạm vào MÁY (vùng trống)
await page.touchscreen.tap(box.x + 20, box.y + 12);
await page.waitForTimeout(600);
let spinning = await page.evaluate(() => document.querySelector('#btnSpinSingle').disabled);
console.log('1. chạm vùng trống trên máy → đang quay:', spinning);
await page.waitForTimeout(7000);
let win = await page.evaluate(() => !!document.querySelector('.rcard.win'));
console.log('   có thẻ trúng:', win, '| modal mở:', await page.evaluate(() => !document.querySelector('#modalBackdrop').hidden));
await page.click('#winDialog [data-act="close"]');
await page.waitForTimeout(400);

// 2) thông tin + đánh giá trong thẻ kết quả
await page.touchscreen.tap(box.x + 20, box.y + 12);
await page.waitForTimeout(7200);
const info = await page.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.trim().slice(0, 70) : null; };
  return {
    score: q('.win-dialog .score-num'), stars: q('.win-dialog .score-stars'),
    review: q('.win-dialog .review'), rows: [...document.querySelectorAll('.win-dialog .info-row')].map(r => r.querySelector('.k').textContent + ': ' + r.querySelector('.v').textContent),
    fit: q('.win-dialog .fit'), tip: q('.win-dialog .tip'), credit: q('.win-dialog .credit')
  };
});
console.log('2. điểm:', info.score, '|', info.stars);
console.log('   nhận xét:', info.review);
console.log('   bảng thông tin:', JSON.stringify(info.rows));
console.log('   hợp với:', info.fit);
console.log('   mẹo:', info.tip);
console.log('   nguồn ảnh:', info.credit);
await page.click('#winDialog [data-act="close"]');
await page.waitForTimeout(300);

// 3) kéo để cuộn trang -> KHÔNG được quay
const beforeY = await page.evaluate(() => scrollY);
await page.evaluate(() => {
  const el = document.querySelector('#rouletteMachine');
  const r = el.getBoundingClientRect();
  const opts = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true });
  el.dispatchEvent(new PointerEvent('pointerdown', opts(r.left + 40, r.top + 40)));
  window.scrollBy(0, 200);
  el.dispatchEvent(new PointerEvent('pointerup', opts(r.left + 40, r.top - 160)));
});
await page.waitForTimeout(700);
const spinningAfterDrag = await page.evaluate(() => document.querySelector('#btnSpinSingle').disabled);
console.log('3. kéo 200px để cuộn → có quay nhầm không:', spinningAfterDrag, '(false = đúng) | scrollY:', beforeY, '→', await page.evaluate(() => scrollY));

// 4) vuốt nhanh 30px -> phải quay
await page.evaluate(() => {
  const el = document.querySelector('#rouletteMachine');
  const r = el.getBoundingClientRect();
  const opts = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 2, pointerType: 'touch', isPrimary: true });
  el.dispatchEvent(new PointerEvent('pointerdown', opts(r.left + 60, r.top + 60)));
  el.dispatchEvent(new PointerEvent('pointerup', opts(r.left + 60, r.top + 22)));
});
await page.waitForTimeout(600);
console.log('4. vuốt 38px → quay:', await page.evaluate(() => document.querySelector('#btnSpinSingle').disabled), '(true = đúng)');
await page.waitForTimeout(7000);
console.log('   gợi ý "CHẠM ĐỂ QUAY" đã ẩn:', await page.evaluate(() => document.querySelector('#tapHint').classList.contains('hide')));

// 5) huy hiệu điểm trên thẻ + lọc điểm cao
await page.click('#winDialog [data-act="close"]').catch(() => {});
await page.waitForTimeout(300);
console.log('5. huy hiệu điểm trên thẻ:', await page.evaluate(() => document.querySelector('#rouletteTrack .rate').textContent.trim()));
await page.click('#btnOpenSheet');
await page.waitForTimeout(600);
await page.evaluate(() => { const el = document.querySelector('#fTop'); el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(400);
const poolText = await page.textContent('#sheetCount');
await page.click('#btnApplyFilters');
await page.waitForTimeout(500);
console.log('   lọc "điểm cao ≥8.5":', poolText.trim(), '| header:', (await page.textContent('#poolStatusText')).trim());
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'không');
await ctx.close(); await browser.close();
