import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.touchscreen.tap(vp.w / 2, 260);
  await page.waitForTimeout(7200);
  const m = await page.evaluate(() => {
    const dlg = document.querySelector('.win-dialog');
    const lock = dlg.querySelector('[data-act="lock"]');
    const dr = dlg.getBoundingClientRect(), lr = lock.getBoundingClientRect();
    return {
      dlgH: Math.round(dr.height), dlgTop: Math.round(dr.top), dlgBottom: Math.round(dr.bottom),
      scrollable: dlg.scrollHeight > dlg.clientHeight + 2,
      lockTop: Math.round(lr.top), lockBottom: Math.round(lr.bottom), lockH: Math.round(lr.height),
      lockVisible: lr.top >= 0 && lr.bottom <= innerHeight + 1,
      vh: innerHeight
    };
  });
  console.log(vp.w + 'x' + vp.h + ': dialog cao ' + m.dlgH + 'px (top ' + m.dlgTop + ', bottom ' + m.dlgBottom + ') | cuộn trong: ' + m.scrollable +
    ' | nút CHỐT: ' + m.lockH + 'px @' + m.lockTop + '-' + m.lockBottom + ' | trong màn: ' + m.lockVisible);
  // bấm được không?
  await page.touchscreen.tap(vp.w / 2, m.lockBottom - 20);
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() => document.querySelector('#modalBackdrop').hidden);
  console.log('   chạm vào nút CHỐT → đóng modal & toast:', closed, '|', (await page.textContent('#toastNotification').catch(() => '')).slice(0, 50));
  await ctx.close();
}
await browser.close();
