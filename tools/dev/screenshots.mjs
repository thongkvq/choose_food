import { launchChromium } from '../lib/chromium.mjs';
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
// tools/dev/screenshots.mjs — chụp ảnh THẬT bằng chromium ở 2 cỡ màn (ảnh vào tools/screenshots/).
// Máy không có font hệ thống thì đặt $SHOT_FONT=/đường/dẫn/font.ttf để nhúng font vào ảnh chụp;
// không đặt thì chụp bình thường (chữ có thể không hiện trên máy thiếu font).
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('../screenshots', import.meta.url));
await mkdir(OUT, { recursive: true });
let fontCss = '';
if (process.env.SHOT_FONT) {
  const b64 = (await readFile(process.env.SHOT_FONT)).toString('base64');
  fontCss = '@font-face{font-family:ShotSans;src:url(data:font/ttf;base64,' + b64 + ') format("truetype");font-weight:400}'
    + '@font-face{font-family:ShotSans;src:url(data:font/ttf;base64,' + b64 + ') format("truetype");font-weight:700}'
    + '*{font-family:ShotSans,system-ui,sans-serif !important}';
} else {
  console.log('(không có $SHOT_FONT — chụp không nhúng font)');
}
const browser = await launchChromium();
for (const j of [{ n: 'mobile-390', w: 390, h: 844 }, { n: 'mobile-458', w: 458, h: 1017 }]) {
  const ctx = await browser.newContext({ viewport: { width: j.w, height: j.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  if (fontCss) await page.addStyleTag({ content: fontCss });
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
