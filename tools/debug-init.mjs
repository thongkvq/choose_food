import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 458, height: 1017 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 120)));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(2500);
console.log('pageerror:', errs.length ? errs.join(' || ') : 'không');
console.log('console:', logs.slice(0, 6).join(' || ') || 'không');
const st = await page.evaluate(() => ({
  chip: !!document.querySelector('#ctxChip'),
  chipHidden: document.querySelector('#ctxChip')?.hidden,
  todayBtn: !!document.querySelector('#btnToday'),
  backdrop: !!document.querySelector('#todayBackdrop'),
  dishCount: document.querySelectorAll('#rouletteTrack .rcard').length,
  hasWeather: !!(window.__wx),
  chipHTML: (document.querySelector('#ctxChip')||{}).innerHTML
}));
console.log('trạng thái:', JSON.stringify(st));
await ctx.close(); await browser.close();
