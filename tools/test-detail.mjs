import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
const b = await page.locator('#btnSpinSingle').boundingBox();
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(7600);
console.log('MÓN:', await page.textContent('.win-name'));
// 1) chi tiết
const hasDetail = await page.evaluate(() => !!document.querySelector('[data-act="detail"]'));
console.log('có khối chi tiết:', hasDetail);
if (hasDetail) {
  console.log('   nhãn nút:', (await page.textContent('[data-act="detail"]')).slice(0, 80));
  await page.click('[data-act="detail"]');
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => {
    const body = document.querySelector('#detailBody');
    return { hidden: body.hidden, sections: [...body.querySelectorAll('h4')].map(h => h.textContent),
      chars: [...body.querySelectorAll('p')].map(p => p.textContent.length),
      preview: body.querySelector('p') ? body.querySelector('p').textContent.slice(0, 110) : '' };
  });
  console.log('   sau khi bấm: mở =', !d.hidden, '| mục:', d.sections.join(' · '));
  console.log('   độ dài từng mục:', d.chars.join(', '), '| ví dụ:', d.preview);
  const scroll = await page.evaluate(() => { const b2 = document.querySelector('#detailBody'); return b2.scrollHeight - b2.clientHeight; });
  console.log('   khối chi tiết phải cuộn:', scroll > 2 ? scroll + 'px (có thanh cuộn riêng)' : 'không');
}
console.log('lỗi JS:', errs.length ? errs.join(' | ') : 'không');
await page.screenshot({ path: '/var/lib/dsh/Choose foody/tools/screenshots/popup-detail-390.png' });
await ctx.close(); await browser.close();
