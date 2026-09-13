// tools/test-nearby-5km.mjs — CHỐT bán kính tìm quán ≤ 5km (server API + UI thật)
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { createRequire } from 'module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');

// ---- A. API server: xin 20km phải bị chặn còn 5km ----
const q = new URLSearchParams({ lat: '10.7725', lng: '106.698', r: '20000', q: 'Phở', kw: 'Phở', cuisine: 'vietnamese' });
const api = await fetch(BASE + '/api/nearby?' + q).then((r) => r.json()).catch((e) => ({ error: String(e.message) }));
let apiOk = false;
if (api.error) console.log('A. API: bỏ qua (không có /api/nearby — bản tĩnh): ' + api.error);
else {
  const maxDist = Math.max(0, ...(api.matched || []).map((p) => p.dist), ...(api.sameCuisine || []).map((p) => p.dist), ...(api.nearest || []).map((p) => p.dist));
  apiOk = api.radius <= 5000 && (api.usedRadius || 0) <= 5000 && maxDist <= 5000;
  console.log('A. API: radius=' + api.radius + ' usedRadius=' + api.usedRadius + ' matched=' + (api.matched || []).length + ' xa nhất=' + Math.round(maxDist) + 'm -> ' + (apiOk ? 'OK' : 'SAI'));
}

const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/alsa-lib:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/gbm' }
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'vi-VN' });
await ctx.grantPermissions(['geolocation']);
await ctx.setGeolocation({ latitude: 10.7725, longitude: 106.698 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  PAGE ERROR: ' + e.message));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

// quay 1 món
await page.click('#btnSpinSingle');
await page.waitForSelector('.nearby-btn', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(800);
const btn = await page.$('.nearby-btn');
if (!btn) { console.log('B. UI: không thấy nút 📍 trong popup'); }
else {
  await btn.click();
  // chờ tìm xong (tối đa 70s)
  const t0 = Date.now();
  while (Date.now() - t0 < 70000) {
    const done = await page.evaluate(() => { const o = document.querySelector('#nearbyOut'); return o && (o.dataset.done === '1' || /Không tìm được/.test(o.textContent)); });
    if (done) break;
    await page.waitForTimeout(1500);
  }
  const res = await page.evaluate(() => {
    const out = document.querySelector('#nearbyOut');
    const note = out.querySelector('.nearby-note');
    const dists = [...out.querySelectorAll('.shop-dist')].map((e) => e.textContent.trim());
    const toM = (s) => s.includes('km') ? parseFloat(s) * 1000 : parseFloat(s);
    const links = [...out.querySelectorAll('a.nearby-link')].map((a) => a.textContent.trim() + ' -> ' + a.href);
    return { note: note ? note.textContent.trim() : '', dists, maxM: Math.max(0, ...dists.map(toM)), links, txt: out.textContent.replace(/\s+/g, ' ').slice(0, 200) };
  });
  const within = res.maxM <= 5000;
  const hasHints = /tối đa 5km/.test(res.note);
  const hasShopee = res.links.some((l) => l.includes('shopeefood.vn'));
  const hasGrab = res.links.some((l) => l.includes('food.grab.com'));
  console.log('B. UI note: ' + res.note);
  console.log('   quán xa nhất: ' + Math.round(res.maxM) + 'm -> ' + (within ? 'OK (≤5km)' : 'SAI (>5km)'));
  console.log('   link: ' + res.links.join(' | '));
  console.log('   có ShopeeFood=' + hasShopee + ' GrabFood=' + hasGrab + ' ghi chú 5km=' + hasHints);
  var uiOk = within && hasShopee && hasGrab && hasHints;
}
await browser.close();
const ok = (api.error ? true : apiOk) && (typeof uiOk === 'undefined' ? false : uiOk);
console.log(ok ? 'KẾT QUẢ: PASS' : 'KẾT QUẢ: FAIL');
process.exit(ok ? 0 : 1);
