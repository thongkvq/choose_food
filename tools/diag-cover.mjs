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
await page.waitForTimeout(1200);
await page.click('#btnSpinSingle');
await page.waitForTimeout(7600);
const probe = await page.evaluate(() => {
  const dlg = document.querySelector('.win-dialog');
  const R = (el) => { const r = el.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height) }; };
  const kids = [...dlg.children].map(el => ({ cls: el.className || el.tagName, ...R(el), z: getComputedStyle(el).zIndex, pos: getComputedStyle(el).position }));
  // phần tử bị cắt bởi overflow:hidden
  const clipped = [];
  for (const el of dlg.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden') && el.scrollHeight - el.clientHeight > 3 && el.clientHeight > 0)
      clipped.push({ cls: el.className || el.tagName, scrollH: el.scrollHeight, clientH: el.clientHeight });
  }
  return {
    dlg: R(dlg), kids,
    dl: { scrollTop: dlg.scrollTop, scrollH: dlg.scrollHeight, clientH: dlg.clientHeight, canScroll: dlg.scrollHeight - dlg.clientHeight },
    clipped: clipped.slice(0, 8),
    vh: innerHeight
  };
});
console.log('thẻ: cao', probe.dlg.h, 'top', probe.dlg.t, '| màn', probe.vh);
console.log('cuộn được thêm:', probe.dl.canScroll, 'px  (scrollH', probe.dl.scrollH, '/ clientH', probe.dl.clientH + ')');
console.log('--- các khối trong thẻ (theo thứ tự):');
probe.kids.forEach(k => console.log('   ' + String(k.cls).slice(0, 26).padEnd(28) + ' top=' + String(k.t).padStart(5) + ' bottom=' + String(k.b).padStart(5) + ' h=' + String(k.h).padStart(4) + ' z=' + k.z + ' ' + k.pos));
console.log('--- phần tử bị overflow:hidden cắt chữ:');
probe.clipped.length ? probe.clipped.forEach(c => console.log('   ' + c.cls + ' : nội dung ' + c.scrollH + 'px > khung ' + c.clientH + 'px')) : console.log('   không có');
console.log('lỗi JS:', errs.length ? errs.join(' | ') : 'không');
await page.screenshot({ path: '/var/lib/dsh/Choose foody/tools/screenshots/diag-cover-458.png' });
await ctx.close(); await browser.close();
