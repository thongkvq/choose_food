const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const fails = [];
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('#btnSpinSingle');   // quay CHỈ bằng nút (khung quay không nhận chạm)
  await page.waitForSelector('#modalBackdrop:not([hidden]) .win-dialog', { timeout: 20000 });
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const dlg = document.querySelector('.win-dialog');
    // Thẻ đã chốt trước đó thì không còn nút CHỐT -> đo nút hành động chính ở đáy thẻ
    const lock = dlg.querySelector('[data-act="lock"]') || dlg.querySelector('.win-actions button');
    if (!lock) return { missing: true };
    const dr = dlg.getBoundingClientRect(), lr = lock.getBoundingClientRect();
    return {
      dlgH: Math.round(dr.height), dlgTop: Math.round(dr.top), dlgBottom: Math.round(dr.bottom),
      scrollable: dlg.scrollHeight > dlg.clientHeight + 2,
      lockTop: Math.round(lr.top), lockBottom: Math.round(lr.bottom), lockH: Math.round(lr.height),
      lockVisible: lr.top >= 0 && lr.bottom <= innerHeight + 1,
      vh: innerHeight
    };
  });
  if (m.missing) { console.log(vp.w + 'x' + vp.h + ': KHÔNG có nút hành động trong thẻ — bỏ qua'); await ctx.close(); continue; }
  console.log(vp.w + 'x' + vp.h + ': dialog cao ' + m.dlgH + 'px (top ' + m.dlgTop + ', bottom ' + m.dlgBottom + ') | cuộn trong: ' + m.scrollable +
    ' | nút hành động: ' + m.lockH + 'px @' + m.lockTop + '-' + m.lockBottom + ' | trong màn: ' + m.lockVisible);
  if (m.lockH < 44 || !m.lockVisible) fails.push(vp.w + 'x' + vp.h + ': nút hành động nhỏ/khuất');
  // bấm được không? (chạm thật vào nút)
  await page.touchscreen.tap(vp.w / 2, m.lockBottom - 20);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    closed: document.querySelector('#modalBackdrop').hidden,
    locked: !!document.querySelector('.win-dialog .locked-ribbon'),
    toast: (document.querySelector('#toastNotification') || {}).textContent || ''
  }));
  console.log('   chạm vào nút hành động → đóng:', after.closed, '| ribbon đã chốt:', after.locked, '|', after.toast.slice(0, 50));
  if (!after.closed && !after.locked) fails.push(vp.w + 'x' + vp.h + ': chạm nút hành động không có tác dụng');
  await ctx.close();
}
await browser.close();
console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.join(', ') + ')' : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
