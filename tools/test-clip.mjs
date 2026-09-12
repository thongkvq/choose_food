import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
for (const vp of [{ w: 458, h: 1017 }, { w: 390, h: 844 }, { w: 375, h: 667 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('#btnSpinSingle');
  await page.waitForTimeout(7600);
  const res = await page.evaluate(async () => {
    const dlg = document.querySelector('.win-dialog');
    const clippedNow = [...dlg.querySelectorAll('*')].filter(el => {
      const cs = getComputedStyle(el);
      return (cs.overflow === 'hidden' || cs.overflowY === 'hidden') && el.scrollHeight - el.clientHeight > 3 && el.clientHeight > 0;
    }).map(el => el.className);
    dlg.scrollTop = dlg.scrollHeight;      // cuộn xuống đáy
    await new Promise(r => setTimeout(r, 250));
    const act = dlg.querySelector('.win-actions').getBoundingClientRect();
    const last = dlg.querySelector('.win-meta').getBoundingClientRect();
    const rows = [...dlg.querySelectorAll('.info-row')];
    return {
      clipped: clippedNow,
      infoRows: rows.length,
      lastRowVisible: rows.length ? (rows[rows.length - 1].getBoundingClientRect().bottom <= act.top + 1) : null,
      metaVisible: last.bottom <= act.top + 1,
      scrollMax: dlg.scrollHeight - dlg.clientHeight
    };
  });
  console.log(vp.w + 'x' + vp.h + ' | cắt chữ: ' + (res.clipped.length ? res.clipped.join(',') : 'không') +
    ' | ' + res.infoRows + ' dòng thông tin | dòng cuối hiện đủ: ' + res.lastRowVisible + ' | dòng meta hiện đủ: ' + res.metaVisible +
    ' | phải cuộn thêm: ' + res.scrollMax + 'px');
  console.log('   lỗi JS: ' + (errs.length ? errs.join(' | ') : 'không'));
  await ctx.close();
}
await browser.close();
