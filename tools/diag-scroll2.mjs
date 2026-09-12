import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

async function drag(x, yFrom, yTo) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: yFrom }] });
  for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: yFrom + (yTo - yFrom) * i / 12 }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350);
}
async function test(label, setup) {
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  if (setup) await page.evaluate(setup);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await drag(195, 700, 200);
  const y = await page.evaluate(() => Math.round(scrollY));
  console.log(label.padEnd(46) + '→ scrollY=' + y + (y > 0 ? '  ✓ cuộn được' : '  ✗ KHÔNG cuộn'));
  return y;
}
await test('0. nguyên trạng', null);
await test('1. bỏ overflow-x:hidden ở html/body', () => { document.documentElement.style.overflowX = 'visible'; document.body.style.overflowX = 'visible'; });
await test('2. bỏ overscroll-behavior của body', () => { document.body.style.overscrollBehaviorY = 'auto'; });
await test('3. bỏ background-attachment:fixed', () => { document.body.style.backgroundAttachment = 'scroll'; });
await test('4. ẩn canvas #fx', () => { document.querySelector('#fx').style.display = 'none'; });
await test('5. ẩn .ambient-glow', () => { document.querySelector('.ambient-glow').style.display = 'none'; });
await test('6. ẩn dock', () => { document.querySelector('.dock').style.display = 'none'; });
await test('7. bỏ hết hiệu ứng nền (attachment+blobs+canvas)', () => {
  document.body.style.backgroundAttachment = 'scroll';
  document.querySelector('#fx').style.display = 'none';
  document.querySelector('.ambient-glow').style.display = 'none';
});
await test('8. bỏ overflow-x ẩn + attachment + orb', () => {
  document.documentElement.style.overflowX = 'visible'; document.body.style.overflowX = 'visible';
  document.body.style.backgroundAttachment = 'scroll';
  document.querySelector('.ambient-glow').style.display = 'none';
});
await ctx.close(); await browser.close();
