import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'], env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 458, height: 1017 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(2200);
// thử 3 kịch bản thời tiết: tính tỉ lệ món nước / món mát trong 4000 lần quay
const res = await page.evaluate(() => {
  const M = window.__mgd, ALL = M.ALL();
  const trial = (wx, mealHour) => {
    M.state.wx = wx; M.state.ctxOn = true;
    const cnt = { nuoc: 0, lau: 0, ngot: 0, uong: 0, nuong: 0, tong: 0 };
    const oldH = Date.prototype.getHours;
    Date.prototype.getHours = function () { return mealHour; };
    for (let i = 0; i < 4000; i++) { const d = M.drawOne(ALL); cnt.tong++; cnt[d.style] = (cnt[d.style] || 0) + 1; }
    Date.prototype.getHours = oldH;
    return cnt;
  };
  const pct = (c, k) => ((c[k] || 0) / c.tong * 100).toFixed(1) + '%';
  const off = (() => { M.state.ctxOn = false; const c = trialOff(); M.state.ctxOn = true; return c; function trialOff() { const cnt = { tong: 0 }; for (let i = 0; i < 4000; i++) { const d = M.drawOne(ALL); cnt.tong++; cnt[d.style] = (cnt[d.style] || 0) + 1; } return cnt; } })();
  const rain = trial({ temp: 24, rain: true, storm: false, desc: 'mưa', isDay: true }, 12);
  const hot = trial({ temp: 35, rain: false, storm: false, desc: 'nắng', isDay: true }, 12);
  const cold = trial({ temp: 16, rain: false, storm: false, desc: 'lạnh', isDay: true }, 20);
  M.state.wx = null;
  return { off, rain, hot, cold, pct: pct };
});
const P = (c, k) => ((c[k] || 0) / c.tong * 100).toFixed(1) + '%';
console.log('Tỉ lệ kiểu món trong 4000 lần quay:');
console.log('  không ưu tiên : nước ' + P(res.off,'nuoc') + ' | lẩu ' + P(res.off,'lau') + ' | ngọt ' + P(res.off,'ngot') + ' | uống ' + P(res.off,'uong') + ' | nướng ' + P(res.off,'nuong'));
console.log('  MƯA  (12h)    : nước ' + P(res.rain,'nuoc') + ' | lẩu ' + P(res.rain,'lau') + ' | nướng ' + P(res.rain,'nuong'));
console.log('  NÓNG 35° (12h): ngọt ' + P(res.hot,'ngot') + ' | uống ' + P(res.hot,'uong') + ' | nướng ' + P(res.hot,'nuong') + ' | lẩu ' + P(res.hot,'lau'));
console.log('  LẠNH 16° (20h): lẩu ' + P(res.cold,'lau') + ' | nước ' + P(res.cold,'nuoc') + ' | ngọt ' + P(res.cold,'ngot'));
console.log('bữa theo giờ:', JSON.stringify({ '6h': await page.evaluate(() => window.__mgd.mealByHour(6)), '11h': await page.evaluate(() => window.__mgd.mealByHour(11)), '15h': await page.evaluate(() => window.__mgd.mealByHour(15)), '19h': await page.evaluate(() => window.__mgd.mealByHour(19)), '23h': await page.evaluate(() => window.__mgd.mealByHour(23)) }));
await ctx.close(); await browser.close();
