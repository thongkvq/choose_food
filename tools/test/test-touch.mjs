import { launchChromium } from '../lib/chromium.mjs';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
// tools/test/test-touch.mjs — kiểm thử thao tác chạm/vuốt trên chromium thật.
// LƯU Ý thiết kế hiện tại (v13): quay CHỈ bằng nút [🎰 QUAY 1 MÓN] / [⚡ x10];
// khung quay KHÔNG nhận chạm và không còn vuốt-để-quay. Test này kiểm đúng điều đó.
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(1500);

let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };
const spinning = () => page.evaluate(() => document.querySelector('#btnSpinSingle').disabled);
const modalOpen = () => page.evaluate(() => !document.querySelector('#modalBackdrop').hidden);
const closeWin = async () => { await page.evaluate(() => document.querySelectorAll('.win-close').forEach(b => b.click())); await page.waitForTimeout(300); };

const box = await page.locator('#rouletteMachine').boundingBox();
const cardBox = await page.locator('#rouletteTrack .rcard').first().boundingBox();
console.log('máy quay:', Math.round(box.width) + 'x' + Math.round(box.height) + ' | thẻ đầu:', Math.round(cardBox.width) + 'x' + Math.round(cardBox.height));

// 1) chạm vào MÁY / mép máy / thẻ món -> KHÔNG được quay (quay chỉ bằng nút)
await page.touchscreen.tap(box.x + 20, box.y + 12);
await page.waitForTimeout(700);
check('1a. chạm vùng trống trên máy -> không quay', (await spinning()) === false);
await page.touchscreen.tap(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
await page.waitForTimeout(700);
check('1b. chạm thẻ món -> không quay', (await spinning()) === false);

// 2) nút QUAY 1 MÓN -> quay thật rồi mở popup
await page.click('#btnSpinSingle');
await page.waitForTimeout(700);
check('2a. bấm nút -> đang quay', (await spinning()) === true);
await page.waitForTimeout(7400);
check('2b. quay xong -> popup mở', (await modalOpen()) === true);
const info = await page.evaluate(() => {
  const dlg = document.querySelector('.win-dialog');
  const q = (s) => { const e = dlg.querySelector(s); return e ? e.textContent.trim().slice(0, 70) : null; };
  return {
    name: q('.win-name'), score: q('.score-num'), stars: q('.score-stars'), review: q('.review'),
    rows: [...dlg.querySelectorAll('.info-row')].map(r => r.querySelector('.k').textContent + ': ' + r.querySelector('.v').textContent),
    fit: q('.fit'), tip: q('.tip'), credit: q('.credit')
  };
});
console.log('3. món:', info.name, '| điểm:', info.score, '|', info.stars);
console.log('   nhận xét:', info.review);
console.log('   bảng thông tin (' + info.rows.length + '):', JSON.stringify(info.rows));
console.log('   hợp với:', info.fit, '| mẹo:', info.tip, '| nguồn ảnh:', info.credit);
check('3. popup có tên món + bảng thông tin', !!info.name && info.rows.length >= 4);
await closeWin();

// 4) kéo để CUỘN trang -> không quay, và vuốt trên máy cũng KHÔNG quay
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
check('4a. kéo 200px để cuộn -> không quay nhầm', (await spinning()) === false, 'scrollY ' + beforeY + ' → ' + (await page.evaluate(() => scrollY)));
await page.evaluate(() => {
  const el = document.querySelector('#rouletteMachine');
  const r = el.getBoundingClientRect();
  const opts = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 2, pointerType: 'touch', isPrimary: true });
  el.dispatchEvent(new PointerEvent('pointerdown', opts(r.left + 60, r.top + 60)));
  el.dispatchEvent(new PointerEvent('pointerup', opts(r.left + 60, r.top + 22)));
});
await page.waitForTimeout(600);
check('4b. vuốt nhanh 38px trên máy -> KHÔNG quay (đã bỏ vuốt-để-quay)', (await spinning()) === false);
check('4c. modal vẫn đóng sau khi cuộn', (await modalOpen()) === false);

// 5) huy hiệu điểm trên thẻ + lọc điểm cao
console.log('5. huy hiệu điểm trên thẻ:', await page.evaluate(() => document.querySelector('#rouletteTrack .rate').textContent.trim()));
await page.click('#btnOpenSheet');
await page.waitForTimeout(600);
await page.evaluate(() => { const el = document.querySelector('#fTop'); el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(400);
const sheetCount = (await page.textContent('#sheetCount')).trim();
await page.click('#btnApplyFilters');
await page.waitForTimeout(500);
const filt = await page.evaluate(() => {
  const p = window.__mgd.pool();
  return { n: p.length, worst: p.length ? Math.min(...p.map((d) => Number(d.rating) || 0)) : null, header: document.querySelector('#poolStatusText').textContent.trim() };
});
console.log('   lọc "điểm cao ≥8.5":', sheetCount, '| header:', filt.header, '| điểm thấp nhất trong pool:', filt.worst);
check('5. lọc điểm ≥8.5 áp dụng cho mọi món trong pool', filt.n > 0 && filt.worst >= 8.5);
check('không lỗi JS', errors.length === 0, errors.join(' | '));
await ctx.close(); await browser.close();
console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.join(', ') + ')' : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
