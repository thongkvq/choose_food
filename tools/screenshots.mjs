// tools/screenshots.mjs — chụp ảnh THẬT bằng chromium (nhúng font vì container không có font hệ thống)
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const OUT = '/var/lib/dsh/Choose foody/tools/screenshots';
const FONT = '/usr/local/lib/nodejs/node-v22.19.0-linux-x64/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/fonts/KaTeX_Main-Regular-ypZvNtVU.ttf';
await mkdir(OUT, { recursive: true });
const b64 = (await readFile(FONT)).toString('base64');
const fontCss = '@font-face{font-family:ShotSans;src:url(data:font/ttf;base64,' + b64 + ') format("truetype");font-weight:400}'
  + '@font-face{font-family:ShotSans;src:url(data:font/ttf;base64,' + b64 + ') format("truetype");font-weight:700}'
  + '*{font-family:ShotSans,system-ui,sans-serif !important}';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
for (const j of [{ n: 'mobile-390', w: 390, h: 844 }, { n: 'mobile-458', w: 458, h: 1017 }]) {
  const ctx = await browser.newContext({ viewport: { width: j.w, height: j.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.addStyleTag({ content: fontCss });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: OUT + '/' + j.n + '-1-top.png' });
  await page.screenshot({ path: OUT + '/' + j.n + '-2-full.png', fullPage: true });
  await page.click('#btnSpinSingle');
  await page.waitForTimeout(7400);
  await page.screenshot({ path: OUT + '/' + j.n + '-3-result.png' });
  await page.click('#winDialog [data-act="close"]').catch(() => {});
  await page.waitForTimeout(300);
  await page.click('#btnOpenSheet');
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/' + j.n + '-4-filters.png' });
  await ctx.close();
}
await browser.close();
console.log('OK ->', OUT);
