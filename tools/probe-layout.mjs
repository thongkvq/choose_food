import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 458, height: 1017 }, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  const rules = [];
  for (const sh of document.styleSheets) {
    try { for (const r of sh.cssRules) if (r.selectorText && /preset|^button/.test(r.selectorText)) rules.push(r.cssText.slice(0, 240)); } catch {}
  }
  const plain = document.createElement('button'); plain.textContent = 'Plain';
  document.body.appendChild(plain);
  const withClass = document.createElement('button'); withClass.className = 'preset'; withClass.textContent = 'Với class preset';
  document.body.appendChild(withClass);
  const divLike = document.createElement('div'); divLike.className = 'preset'; divLike.textContent = 'Div giống preset';
  document.body.appendChild(divLike);
  const r = {
    plainBtn: Math.round(plain.getBoundingClientRect().height),
    classBtn: Math.round(withClass.getBoundingClientRect().height),
    classDiv: Math.round(divLike.getBoundingClientRect().height),
    classBtnPad: getComputedStyle(withClass).padding,
    classBtnFs: getComputedStyle(withClass).fontSize,
    classBtnLh: getComputedStyle(withClass).lineHeight,
    rules
  };
  plain.remove(); withClass.remove(); divLike.remove();
  return r;
});
console.log('button trơn=' + out.plainBtn + ' | button.preset=' + out.classBtn + ' | div.preset=' + out.classDiv);
console.log('pad=' + out.classBtnPad + ' fs=' + out.classBtnFs + ' lh=' + out.classBtnLh);
console.log('rules:'); out.rules.forEach(r => console.log('   ' + r));
await ctx.close(); await browser.close();
