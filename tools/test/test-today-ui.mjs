import { launchChromium } from '../lib/chromium.mjs';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { fileURLToPath } from 'node:url';
const SHOT_DIR = fileURLToPath(new URL('../screenshots/', import.meta.url));   // ảnh chụp nằm trong project hiện tại
const browser = await launchChromium();
for (const vp of [{ w: 458, h: 1017 }, { w: 375, h: 667 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('#btnToday');
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const dlg = document.querySelector('.today-dialog'), body = document.querySelector('#todayBody');
    const clipped = [...dlg.querySelectorAll('*')].filter(el => {
      const cs = getComputedStyle(el);
      return (cs.overflow === 'hidden' || cs.overflowY === 'hidden') && el.scrollHeight - el.clientHeight > 3 && el.clientHeight > 0;
    }).map(el => el.className);
    const small = [...dlg.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height < 40 && b.offsetParent !== null).map(b => (b.textContent||'').trim().slice(0, 14) + ' ' + Math.round(b.getBoundingClientRect().height) + 'px');
    return {
      fits: dlg.getBoundingClientRect().height <= innerHeight, h: Math.round(dlg.getBoundingClientRect().height),
      scroll: dlg.scrollHeight - dlg.clientHeight, clipped: clipped, small: small,
      slots: dlg.querySelectorAll('.slot').length, days: dlg.querySelectorAll('.day').length,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1
    };
  });
  console.log(vp.w + 'x' + vp.h + ' | panel cao ' + r.h + 'px (màn ' + vp.h + ') trọn: ' + r.fits + ' | cuộn thêm: ' + r.scroll +
    ' | cắt chữ: ' + (r.clipped.length ? r.clipped.join(',') : 'không') + ' | ' + r.slots + ' bữa · ' + r.days + ' ngày nhật ký' +
    ' | nút <40px: ' + (r.small.length ? r.small.join(', ') : 'không') + ' | tràn ngang: ' + r.overflowX);
  console.log('   lỗi JS: ' + (errs.length ? errs.join(' | ') : 'không'));
  await page.screenshot({ path: SHOT_DIR + 'today-' + vp.w + '.png' });
  await ctx.close();
}
await browser.close();
