// tools/shot-vung.mjs — chụp sheet "Vùng miền" để soi bố cục
import { createRequire } from 'module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/alsa-lib:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/gbm' }
});
for (const [w, h, tag] of [[390, 844, 'iphone'], [375, 667, 'se']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__mgd, null, { timeout: 20000 });
  await page.click('#btnOpenSheet'); await page.waitForTimeout(700);
  await page.click('#vungChips .chip[data-k="tay-nam-bo"]'); await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const box = document.querySelector('#filterPanel');
    const cs = getComputedStyle(box);
    const chips = [...document.querySelectorAll('#vungChips .chip')];
    const over = chips.filter(c => c.getBoundingClientRect().right > box.getBoundingClientRect().right + 1).length;
    let scrollTop = 0;
    const body = document.querySelector('#filterPanel .sheet-body');
    const vung = document.querySelector('#vungChips');
    if (body.getBoundingClientRect().top > vung.getBoundingClientRect().top) { body.scrollTop = vung.offsetTop - 20; scrollTop = body.scrollTop; }
    return { panelW: Math.round(box.getBoundingClientRect().width), chips: chips.length, over,
             rows: new Set(chips.map(c => Math.round(c.getBoundingClientRect().top))).size, scrollTop };
  });
  console.log(tag, JSON.stringify(m));
  await page.screenshot({ path: '/tmp/vung-' + tag + '.png' });
  await ctx.close();
}
await browser.close();
