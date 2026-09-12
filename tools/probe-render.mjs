import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const FONT = '/usr/local/lib/nodejs/node-v22.19.0-linux-x64/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/fonts/KaTeX_Main-Regular-ypZvNtVU.ttf';
const b64 = (await readFile(FONT)).toString('base64');
const css = '@font-face{font-family:ShotSans;src:url(data:font/ttf;base64,' + b64 + ') format("truetype")}*{font-family:ShotSans,system-ui !important}';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 458, height: 1017 }, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.addStyleTag({ content: css });
await page.waitForTimeout(1800);
const res = await page.evaluate(() => {
  const t = document.querySelector('.preset').firstChild;
  const r = document.createRange(); r.selectNodeContents(t);
  const rects = [...r.getClientRects()].map(x => Math.round(x.height));
  return { textRects: rects, presetH: Math.round(document.querySelector('.preset').getBoundingClientRect().height), bodyLineHeight: getComputedStyle(document.body).lineHeight };
});
console.log('chiều cao dòng chữ khi CÓ font:', JSON.stringify(res.textRects), '| preset cao:', res.presetH, '| body line-height:', res.bodyLineHeight);
await ctx.close(); await browser.close();
