import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (/loc-go|nearby/.test(m.text())) console.log('   [console]', m.text().slice(0, 160)); });
page.on('pageerror', e => console.log('   [pageerror]', e.message.slice(0, 160)));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.click('#btnSpinSingle');
await page.waitForTimeout(7600);
await page.click('[data-act="nearby"]');
await page.waitForTimeout(2000);
console.log('có ô nhập:', await page.evaluate(() => !!document.querySelector('#locInput')));
await page.fill('#locInput', '10.822, 106.6257');
await page.click('[data-act="loc-go"]');
await page.waitForTimeout(20000);
const r = await page.evaluate(() => {
  const out = document.querySelector('#nearbyOut');
  return { info: out.querySelector('.loc-info')?.textContent.replace(/\s+/g,' ').trim().slice(0,110),
    notes: [...out.querySelectorAll('.nearby-note')].map(n=>n.textContent.replace(/\s+/g,' ').trim().slice(0,80)),
    first: (out.querySelector('.shop b')||{}).textContent };
});
console.log('vị trí:', r.info);
console.log('ghi chú:', r.notes.join(' | '));
console.log('quán đầu:', r.first);
await ctx.close(); await browser.close();
