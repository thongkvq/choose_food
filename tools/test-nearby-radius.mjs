// tools/test-nearby-radius.mjs — 3 mức bán kính 2.5 / 5 / 10km cho người dùng chọn
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { createRequire } from 'module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');

let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };

// ---- A. API: 3 mức + chặn vượt trần ----
let apiOk = true;
for (const [ask, want] of [[2500, 2500], [5000, 5000], [10000, 10000], [20000, 10000], [1000, 2500]]) {
  const q = new URLSearchParams({ lat: '10.7725', lng: '106.698', r: String(ask), q: 'Phở', kw: 'Phở', cuisine: 'vietnamese' });
  let j;
  try { j = await (await fetch(BASE + '/api/nearby?' + q)).json(); }
  catch (e) { console.log('A. API: bản tĩnh, bỏ qua (' + e.message + ')'); apiOk = null; break; }
  if (j.error && !j.radius) { console.log('A. API: lỗi ' + j.error); apiOk = null; break; }
  const dists = [...(j.matched || []), ...(j.sameCuisine || []), ...(j.nearest || [])].map((p) => p.dist);
  const maxD = dists.length ? Math.max(...dists) : 0;
  const ok = j.radius === want && (j.usedRadius || 0) === want && maxD <= want;
  check('API xin r=' + ask + ' -> trả ' + j.radius + 'm, xa nhất ' + Math.round(maxD) + 'm', ok);
  if (!ok) apiOk = false;
}

// ---- B. UI thật ----
const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/alsa-lib:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/gbm' }
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'vi-VN' });
await ctx.grantPermissions(['geolocation']);
await ctx.setGeolocation({ latitude: 10.7725, longitude: 106.698 });
const page = await ctx.newPage();
const reqs = [];
page.on('request', (r) => { if (r.url().includes('/api/nearby') || r.url().includes('photon.komoot.io')) reqs.push(r.url()); });
page.on('pageerror', (e) => console.log('  PAGE ERROR: ' + e.message));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mgd, null, { timeout: 20000 });
await page.click('#btnSpinSingle');
await page.waitForSelector('.nearby-btn', { timeout: 30000 });
await page.click('.nearby-btn');

const waitDone = async (label, fresh) => {
  if (fresh) {   // xoá cờ cũ để không đọc nhầm kết quả lần trước
    await page.evaluate(() => { const o = document.querySelector('#nearbyOut'); if (o) delete o.dataset.done; });
    await page.waitForTimeout(400);
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const done = await page.evaluate(() => { const o = document.querySelector('#nearbyOut'); return o && (o.dataset.done === '1' || /Không tìm được/.test(o.textContent)); });
    if (done) return true;
    await page.waitForTimeout(1000);
  }
  console.log('  (hết giờ chờ ' + label + ')');
  return false;
};
const snap = async () => page.evaluate(() => {
  const out = document.querySelector('#nearbyOut');
  const note = out.querySelector('.nearby-note');
  const dists = [...out.querySelectorAll('.shop-dist')].map((e) => e.textContent.trim());
  const toM = (s) => s.includes('km') ? parseFloat(s) * 1000 : parseFloat(s);
  return {
    chips: [...out.querySelectorAll('.rad-chip')].map((c) => c.textContent.trim() + (c.classList.contains('on') ? '*' : '')),
    note: note ? note.textContent.trim() : '',
    maxM: dists.length ? Math.max(...dists.map(toM)) : 0,
    n: dists.length,
    ls: localStorage.getItem('mgd.radius')
  };
});

await waitDone('mặc định');
let s = await snap();
check('có 3 chip 2.5/5/10km', s.chips.join(',') === '2.5km,5km*,10km', s.chips.join(','));
check('mặc định 5km, quán ≤5km', /5km/.test(s.note) && s.maxM <= 5000, s.note);

// đổi sang 2.5km
reqs.length = 0;
await page.click('#nearbyOut .rad-chip[data-rad="2500"]');
await waitDone('2.5km', true);
s = await snap();
check('2.5km: quán ≤2500m', s.maxM <= 2500 && /2.5km/.test(s.note), s.note + ' | xa nhất ' + Math.round(s.maxM) + 'm');
check('2.5km: gửi đúng tham số r', reqs.some((u) => /[?&]r=2500/.test(u)) || BASE.startsWith('https'), reqs.slice(-1)[0] || '');
check('lưu localStorage mgd.radius=2500', s.ls === '2500', String(s.ls));

// đổi sang 10km
reqs.length = 0;
await page.click('#nearbyOut .rad-chip[data-rad="10000"]');
await waitDone('10km', true);
s = await snap();
check('10km: quán ≤10000m', s.maxM <= 10000 && /10km/.test(s.note), s.note + ' | xa nhất ' + Math.round(s.maxM) + 'm');
check('10km: chip 10km sáng', s.chips.join(',') === '2.5km,5km,10km*', s.chips.join(','));

// reload nhớ mức 10km
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mgd, null, { timeout: 20000 });
const keep = await page.evaluate(() => window.__mgd.state.radius);
check('F5 nhớ mức 10km', keep === 10000, String(keep));

await browser.close();
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.join(' | ') + ')' : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
