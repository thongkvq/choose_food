// tools/test-pwa.mjs — KIỂM TRA PWA / dùng offline.
// Kiểm tĩnh: manifest.webmanifest (tên, icon 192/512 + maskable, màu theo styles.css), link trong index.html,
//            sw.js (network-first HTML/JS/CSS, SWR data, cache-first ảnh ≤150, KHÔNG cache API ngoài), header sw.js.
// Kiểm thật: SW đăng ký trên localhost, setOffline(true) -> reload vẫn mở được, quay ra popup,
//            nút tìm quán báo "đang offline".
// Dùng: node tools/test-pwa.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const ok = [], bad = [], skipped = [];
const check = (name, cond, extra) => {
  (cond ? ok : bad).push(name);
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? ' — ' + extra : ''));
};
const skipCheck = (name, why) => { skipped.push(name); console.log('SKIP  ' + name + ' — ' + why); };

console.log('=== PWA / OFFLINE ===');
/* ---------- A. kiểm tĩnh ---------- */
const manifestText = await readFile(ROOT + 'manifest.webmanifest', 'utf8');
const manifest = JSON.parse(manifestText);
const html = await readFile(ROOT + 'index.html', 'utf8');
const css = await readFile(ROOT + 'styles.css', 'utf8');
const swSrc = await readFile(ROOT + 'sw.js', 'utf8');
const swCode = swSrc.replace(/^\s*\/\/.*$/gm, '');   // bỏ dòng chú thích khi kiểm mã

const iconOf = (sizes, purpose) => (manifest.icons || []).find((i) => i.sizes === sizes && (!purpose || i.purpose === purpose));
check('manifest: tên "Món Gì Đây?" + display standalone + start_url', manifest.name === 'Món Gì Đây?' && manifest.short_name === 'Món Gì Đây?' && manifest.display === 'standalone' && !!manifest.start_url, manifest.name + ' · ' + manifest.display + ' · ' + manifest.start_url);
check('manifest: icon 192 + 512 (any) và maskable 512', !!iconOf('192x192') && !!iconOf('512x512') && !!iconOf('512x512', 'maskable'));
const iconFiles = [];
for (const i of manifest.icons) { const s = await stat(ROOT + i.src).catch(() => null); iconFiles.push(i.src + (s && s.size > 1000 ? ' ' + Math.round(s.size / 1024) + 'KB' : ' THIẾU')); }
check('file icon có thật và đúng PNG', iconFiles.every((x) => !/THIẾU/.test(x)), iconFiles.join(', '));
const metaTheme = (html.match(/<meta name="theme-color" content="(#[0-9a-f]{6})"/) || [])[1];
const appJs = await readFile(ROOT + 'app.js', 'utf8');
check('màu theo theme hiện tại: manifest.theme_color = meta theme-color, background_color = --bg trong styles.css',
  manifest.theme_color === metaTheme && css.includes('--bg:' + manifest.background_color) && /meta\[name=theme-color\]/.test(appJs),
  'theme_color ' + manifest.theme_color + ' · background ' + manifest.background_color + ' (app.js đổi meta khi bật/tắt sáng tối)');
check('index.html có <link rel="manifest"> + apple-touch-icon PNG', /rel="manifest" href="manifest\.webmanifest"/.test(html) && /rel="apple-touch-icon" href="icons\/icon-192\.png"/.test(html));

check('sw.js: có hằng số VERSION để đổi cache khi deploy', /const VERSION\s*=\s*'[^']+'/.test(swSrc));
check('sw.js: HTML/JS/CSS dùng network-first', /networkFirst\(req, SHELL_CACHE\)/.test(swCode) && /\.\(\?:html\?\|js\|css\|webmanifest\)/.test(swCode));
check('sw.js: data/*.json dùng stale-while-revalidate', /staleWhileRevalidate\(req, DATA_CACHE\)/.test(swCode));
check('sw.js: ảnh upload.wikimedia.org cache-first, giới hạn 150 ảnh', /cacheFirstImage\(req, IMG_CACHE, IMG_MAX\)/.test(swCode) && /const IMG_MAX\s*=\s*150/.test(swCode) && /trim\(/.test(swCode));
check('sw.js: CHỈ cache ảnh wikimedia, không cache API ngoài', (swCode.match(/url\.hostname\s*===/g) || []).length === 1 && /url\.hostname === 'upload\.wikimedia\.org'/.test(swCode));
check('sw.js: activate xoá cache cũ', /caches\.keys\(\)/.test(swCode) && /caches\.delete\(n\)/.test(swCode));

let hdr = null;
try { const r = await fetch(BASE + '/sw.js'); hdr = { status: r.status, cc: r.headers.get('cache-control'), ct: r.headers.get('content-type') }; } catch (e) { hdr = { status: 0, cc: '(lỗi ' + e.message + ')' }; }
check('sw.js tải được (200) và KHÔNG bị cache lâu', hdr.status === 200 && !!hdr.cc && !/max-age=[1-9]\d{3,}|immutable/.test(hdr.cc), 'cache-control: ' + hdr.cc);
let mh = null;
try { const r = await fetch(BASE + '/manifest.webmanifest'); mh = { status: r.status, ct: r.headers.get('content-type'), body: await r.json() }; } catch (e) { mh = { status: 0, ct: '(lỗi ' + e.message + ')' }; }
check('manifest phục vụ đúng content-type manifest+json', mh.status === 200 && /manifest\+json/.test(mh.ct || ''), mh.ct);
check('manifest qua HTTP khớp file trong repo', mh.body && mh.body.name === manifest.name && mh.body.icons.length === manifest.icons.length);

/* ---------- B. kiểm thật bằng chromium ---------- */
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

const swSupported = await page.evaluate(() => 'serviceWorker' in navigator && window.isSecureContext);
check('trang chạy trong secure context (localhost/https) và có serviceWorker', swSupported === true);
let activeState = null, scope = null;
try {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 25000 });
  const info = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { state: r && r.active ? r.active.state : null, scope: r ? r.scope : null, controlled: !!navigator.serviceWorker.controller }; });
  activeState = info.state; scope = info.scope;
  check('sw.js đăng ký xong và ACTIVE, đã nắm quyền trang', info.state === 'activated' && info.controlled, 'scope ' + info.scope + ' · state ' + info.state);
} catch (e) {
  check('sw.js đăng ký xong và ACTIVE, đã nắm quyền trang', false, 'hết thời gian chờ SW nắm quyền');
}
const cacheNames = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = { names: names, urls: [] };
  for (const n of names) { const c = await caches.open(n); out.urls = out.urls.concat((await c.keys()).map((k) => k.url)); }
  return out;
});
check('cache SW có shell + dữ liệu lite + icon', cacheNames.urls.some((u) => /index\.html$/.test(u)) && cacheNames.urls.some((u) => /app\.js$/.test(u)) && cacheNames.urls.some((u) => /data\/dishes-lite\.json$/.test(u)), cacheNames.names.join(', '));
check('cache SW KHÔNG chứa request API ngoài', !cacheNames.urls.some((u) => /photon\.komoot|overpass|open-meteo|ipapi|shopeefood|grab\.com/.test(u)));

// ảnh wikimedia: cache-first (bỏ qua nếu mạng ngoài không tới được)
const imgUrl = await page.evaluate(() => (window.__mgd.ALL().find((d) => d.image) || {}).image);
let imgOnline = false;
try { imgOnline = await page.evaluate((u) => fetch(u, { mode: 'no-cors' }).then(() => true).catch(() => false), imgUrl); } catch (e) { imgOnline = false; }
if (!imgOnline) skipCheck('ảnh wikimedia cache-first khi offline', 'không với tới upload.wikimedia.org (dịch vụ ngoài)');

/* ---------- C. offline: reload vẫn mở được + quay ra popup ---------- */
await ctx.setOffline(true);
let offlineOk = true;
try {
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 25000 });
} catch (e) { offlineOk = false; }
check('OFFLINE: reload vẫn nạp được app (nhờ service worker)', offlineOk);
if (offlineOk) {
  const st = await page.evaluate(() => ({
    n: window.__mgd.ALL().length,
    status: document.querySelector('#poolStatusText').textContent.trim(),
    online: navigator.onLine
  }));
  check('OFFLINE: dữ liệu món vẫn đủ (' + st.n + ' món) từ cache data', st.n > 200 && /món/.test(st.status), st.status);
  await page.click('#btnSpinSingle');
  let popup = true;
  try { await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden && !!document.querySelector('.win-name'), null, { timeout: 25000 }); } catch (e) { popup = false; }
  const win = await page.evaluate(() => ({ name: (document.querySelector('.win-name') || {}).textContent || '', rows: document.querySelectorAll('.info-row').length, lock: !!document.querySelector('[data-act="lock"]') }));
  check('OFFLINE: quay món vẫn chạy và mở popup', popup && win.name.length > 1 && win.lock, (win.name || '').trim());
  check('OFFLINE: popup vẫn có bảng thông tin (phần lite + lỗi chi tiết được báo gọn)', win.rows >= 4, win.rows + ' dòng');
  await page.click('[data-act="nearby"]');
  await page.waitForTimeout(1500);
  const nb = await page.evaluate(() => ({
    text: (document.querySelector('#nearbyOut') || {}).textContent || '',
    maps: !!document.querySelector('#nearbyOut a[href*="google.com/maps"]'),
    btn: (document.querySelector('.nearby-btn') || {}).textContent || ''
  }));
  check('OFFLINE: nút tìm quán báo "đang offline" gọn gàng (không quay vòng vô ích)', /Đang offline/.test(nb.text), nb.text.trim().slice(0, 80));
  check('OFFLINE: vẫn có link Google Maps + nút thử lại', nb.maps && /Thử lại/.test(nb.btn));
}

/* ---------- D. có mạng lại ---------- */
await ctx.setOffline(false);
const back = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 400)); return navigator.onLine; });
check('bật mạng lại -> navigator.onLine = true', back === true);
if (imgOnline) {
  await ctx.setOffline(true);
  const cachedImg = await page.evaluate((u) => fetch(u, { mode: 'no-cors' }).then(() => true).catch(() => false), imgUrl);
  await ctx.setOffline(false);
  const keys = await page.evaluate(async () => { const n = (await caches.keys()).find((x) => x.startsWith('img-')); if (!n) return []; const c = await caches.open(n); return (await c.keys()).map((k) => k.url); });
  check('OFFLINE: ảnh wikimedia đã cache vẫn tải được (cache-first)', cachedImg && keys.length >= 1, keys.length + ' ảnh trong cache');
  check('cache ảnh dùng header thời điểm để xoá ảnh cũ nhất (≤150)', keys.length <= 150);
}
check('không lỗi JS toàn luồng PWA/offline', errs.length === 0, errs.join(' | '));

await ctx.close(); await browser.close();
if (skipped.length) console.log('\nBỎ QUA (dịch vụ ngoài): ' + skipped.join(', '));
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
