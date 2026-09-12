import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 458, height: 1017 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(3000);

// 1) chip bối cảnh
const chip = await page.evaluate(() => {
  const c = document.querySelector('#ctxChip');
  return { hidden: c.hidden, text: c.textContent.replace(/\s+/g, ' ').trim(), off: c.classList.contains('off') };
});
console.log('1. CHIP BỐI CẢNH:', chip.hidden ? '(ẩn)' : chip.text, '| đang tắt:', chip.off);
console.log('   bấm tắt ưu tiên:');
await page.click('#ctxChip');
await page.waitForTimeout(400);
console.log('   →', (await page.textContent('#ctxChip')).replace(/\s+/g, ' ').trim());
await page.click('#ctxChip');
await page.waitForTimeout(300);

// 2) quay + chốt món → nhật ký + badge
await page.click('#btnSpinSingle');
await page.waitForTimeout(7600);
console.log('\n2. POPUP món:', (await page.textContent('.win-name')).trim());
console.log('   có nút "Vào thực đơn":', await page.evaluate(() => !!document.querySelector('[data-act="menu-add"]')));
await page.click('#winDialog [data-act="lock"]');
await page.waitForTimeout(600);
console.log('   badge nhật ký:', await page.evaluate(() => { const b = document.querySelector('#diaryBadge'); return b.hidden ? '(ẩn)' : b.textContent; }));
await page.click('#winDialog [data-act="close"]');
await page.waitForTimeout(400);

// 3) panel Hôm nay
await page.click('#btnToday');
await page.waitForTimeout(700);
const today = await page.evaluate(() => {
  const b = document.querySelector('#todayBody');
  return {
    open: !document.querySelector('#todayBackdrop').hidden,
    sum: [...b.querySelectorAll('.today-sum>div')].map(d => d.textContent.replace(/\s+/g,' ').trim()),
    slots: [...b.querySelectorAll('.slot')].map(s => s.querySelector('.slot-h').textContent.trim() + ': ' + (s.querySelector('.slot-d b') ? s.querySelector('.slot-d b').textContent : (s.querySelector('.slot-add') ? 'chưa chọn' : '?'))),
    advice: [...b.querySelectorAll('.advice>div')].map(d => d.textContent.trim()).slice(0, 3),
    taste: b.querySelector('.taste')?.textContent.replace(/\s+/g,' ').trim().slice(0, 120),
    diaryDays: [...b.querySelectorAll('.day')].slice(0, 3).map(d => d.textContent.replace(/\s+/g,' ').trim().slice(0, 70)),
    hasShare: !!b.querySelector('[data-act="share-menu"]')
  };
});
console.log('\n3. PANEL HÔM NAY mở:', today.open);
console.log('   tổng:', today.sum.join(' | '));
console.log('   bữa:'); today.slots.forEach(s => console.log('     ' + s));
console.log('   gợi ý:'); today.advice.forEach(s => console.log('     ' + s));
console.log('   gu:', today.taste);
console.log('   nhật ký:'); today.diaryDays.forEach(s => console.log('     ' + s));
console.log('   nút xuất ảnh:', today.hasShare);

// 4) xuất ảnh (canvas → PNG)
const png = await page.evaluate(async () => {
  const ev = document.querySelector('[data-act="share-menu"]');
  const c = document.createElement('canvas');   // kiểm tra hàm vẽ có chạy không
  return { ok: !!ev, w: window.innerWidth };
});
const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await page.click('[data-act="share-menu"]');
const d = await dl;
console.log('\n4. XUẤT ẢNH:', d ? ('tải được ' + d.suggestedFilename()) : '(không có sự kiện download — có thể dùng navigator.share)');
console.log('\nlỗi JS:', errs.length ? errs.join(' | ') : 'không');
await page.screenshot({ path: '/var/lib/dsh/Choose foody/tools/screenshots/today-458.png' });
await ctx.close(); await browser.close();
