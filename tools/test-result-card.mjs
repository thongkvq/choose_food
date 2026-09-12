import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const VPS = [{ w: 360, h: 640 }, { w: 375, h: 667 }, { w: 390, h: 844 }, { w: 458, h: 1017 }];
for (const vp of VPS) {
  const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  const b = await page.locator('#btnSpinSingle').boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(7600);
  const i = await page.evaluate(() => {
    const dlg = document.querySelector('.win-dialog');
    const R = (el) => el ? { t: Math.round(el.getBoundingClientRect().top), b: Math.round(el.getBoundingClientRect().bottom), h: Math.round(el.getBoundingClientRect().height) } : null;
    const rows = [...dlg.querySelectorAll('.info-row')];
    return {
      open: !document.querySelector('#modalBackdrop').hidden,
      dlg: R(dlg), scrollInside: dlg.scrollHeight - dlg.clientHeight,
      name: R(dlg.querySelector('.win-name')), hero: R(dlg.querySelector('.win-hero')),
      score: dlg.querySelector('.score-num')?.textContent,
      lastRow: rows.length ? R(rows[rows.length - 1]) : null, rows: rows.length,
      lock: R(dlg.querySelector('[data-act="lock"]')), vh: innerHeight
    };
  });
  const fits = i.dlg.t >= -1 && i.dlg.b <= i.vh + 1;
  console.log(vp.w + 'x' + vp.h + ' | mở:' + i.open + ' | dialog ' + i.dlg.h + 'px @' + i.dlg.t + '-' + i.dlg.b + ' (màn ' + i.vh + ') trọn trong màn:' + fits);
  console.log('   hero ' + i.hero.h + 'px | điểm ' + i.score + ' | ' + i.rows + ' dòng | dòng cuối kết thúc @' + (i.lastRow ? i.lastRow.b : '?') +
    ' | cuộn bên trong: ' + (i.scrollInside > 2 ? i.scrollInside + 'px (CÒN PHẢI CUỘN)' : 'không') + ' | nút chốt @' + i.lock.t + '-' + i.lock.b);
  console.log('   lỗi JS: ' + (errs.length ? errs.join(' | ') : 'không'));
  await ctx.close(); await browser.close();
}
