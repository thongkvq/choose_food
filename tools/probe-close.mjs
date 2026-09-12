import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1000);
await page.touchscreen.tap(195, 371);
await page.waitForTimeout(7600);
await page.click('#winDialog [data-act="lock"]');
await page.waitForTimeout(500);
const d = await page.evaluate(() => {
  const dlg = document.querySelector('.win-dialog');
  const close = dlg.querySelector('.win-close');
  const ribbon = dlg.querySelector('.locked-ribbon');
  const cr = close.getBoundingClientRect(), rr = ribbon.getBoundingClientRect();
  const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return {
    closeRect: { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) },
    ribbonRect: { x: Math.round(rr.left), y: Math.round(rr.top), w: Math.round(rr.width), h: Math.round(rr.height), right: Math.round(rr.right) },
    closeZ: getComputedStyle(close).zIndex, ribbonZ: getComputedStyle(ribbon).zIndex,
    closePos: getComputedStyle(close).position, ribbonPos: getComputedStyle(ribbon).position,
    hit: hit ? (hit.className || hit.tagName) : 'null',
    dlgChildren: [...dlg.children].map(c => (c.className || c.tagName) + ' z=' + getComputedStyle(c).zIndex).slice(0, 6)
  };
});
console.log(JSON.stringify(d, null, 1));
await ctx.close(); await browser.close();
