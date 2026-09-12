// tools/audit-layout.mjs — đo layout THẬT bằng chromium ở viewport điện thoại
import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const VPS = [
  { name: 'iPhone SE 375x667', w: 375, h: 667 },
  { name: 'iPhone 390x844', w: 390, h: 844 },
  { name: 'Galaxy 458x1017 (như ảnh user)', w: 458, h: 1017 }
];
const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' }
});
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const d = await page.evaluate(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), height: Math.round(b.height), left: Math.round(b.left), right: Math.round(b.right) }; };
    const kids = [...document.querySelector('.app-main').children]
      .filter(el => getComputedStyle(el).display !== 'none' && getComputedStyle(el).position !== 'fixed')
      .map(el => ({ cls: (el.className || '').split(' ').filter(c => c && c !== 'mobile-only')[0] || el.tagName, ...box(el) }));
    const dockEl = document.querySelector('.dock');
    const dockBox = dockEl ? box(dockEl) : null;
    const small = [...document.querySelectorAll('button, .chip, .hitem, .favchip, .preset')]
      .filter(el => { const b = el.getBoundingClientRect(); return b.height > 0 && b.height < 44; })
      .map(el => (el.className || el.tagName).split(' ')[0] + '=' + Math.round(el.getBoundingClientRect().height));
    const overflowing = [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).length;
    return { vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth, kids, dockTop: dockBox ? dockBox.top : null, dockH: dockBox ? dockBox.height : 0, small: [...new Set(small)], overflowing, headerH: Math.round(document.querySelector('.app-header').getBoundingClientRect().height) };
  });
  const lastBottom = d.kids.length ? d.kids[d.kids.length - 1].bottom : 0;
  const gaps = [];
  for (let i = 1; i < d.kids.length; i++) { const g = d.kids[i].top - d.kids[i - 1].bottom; if (g > 30) gaps.push(d.kids[i].cls + ':' + g + 'px'); }
  console.log('\n== ' + vp.name + ' ==');
  console.log('nội dung ' + d.scrollH + 'px | màn ' + d.vh + 'px | tràn ngang: ' + (d.scrollW > d.vw + 1 ? 'CÓ' : 'không') + ' | phần tử tràn phải: ' + d.overflowing);
  console.log('khối: ' + d.kids.map(k => k.cls + '[' + k.top + '-' + k.bottom + ']').join(' '));
  console.log('khoảng trống >30px giữa khối: ' + (gaps.length ? gaps.join(', ') : 'không'));
  console.log('khối cuối kết thúc ở ' + lastBottom + 'px | màn ' + d.vh + 'px | đuôi trống: ' + (Math.max(d.scrollH, d.vh) - lastBottom - 18) + 'px');
  console.log('tap target <44px: ' + (d.small.length ? d.small.join(', ') : 'không'));
  await ctx.close();
}
await browser.close();
