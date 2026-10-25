import { launchChromium } from '../lib/chromium.mjs';
// tools/test/test-pwa.mjs — KIỂM TRA PWA / dùng offline.
// Kiểm tĩnh: manifest.webmanifest (tên, icon 192/512 + maskable, màu theo styles.css), link trong index.html,
//            sw.js (network-first HTML/JS/CSS, SWR data, cache-first ảnh ≤150, KHÔNG cache API ngoài,
//            ảnh tải mode 'cors' + chỉ cache khi res.ok và blob > 0), vercel.json (routes KHÔNG đi cùng
//            headers/rewrites/redirects/cleanUrls/trailingSlash — Vercel từ chối deploy nếu có cả hai).
// Kiểm THẬT bằng ảnh Wikimedia thật (không mock): ảnh nằm trong cache với nội dung > 0 byte,
//            hiện đúng trong popup (naturalWidth > 0, KHÔNG rơi về SVG fallback) khi ONLINE,
//            sau reload, và khi OFFLINE (cache-first).
// Dùng: node tools/test/test-pwa.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

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
const vercel = JSON.parse(await readFile(ROOT + 'vercel.json', 'utf8'));

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
// FIX v24-2: ảnh phải tải mode 'cors' (no-cors -> response opaque -> blob rỗng -> cache ảnh hỏng mãi)
check('sw.js: ảnh tải mode cors + chỉ cache khi res.ok và blob > 0 (không lưu ảnh rỗng)',
  /fetch\(req\.url, \{ mode: 'cors'/.test(swCode) && /res\.ok/.test(swCode) && /body\.size/.test(swCode) && /x-cached-at/.test(swCode),
  'VERSION ' + (swSrc.match(/const VERSION = '([^']+)'/) || [])[1]);
// FIX v24-2: Vercel KHÔNG cho headers/rewrites/redirects/cleanUrls/trailingSlash đi cùng routes
const CONFLICT = ['headers', 'rewrites', 'redirects', 'cleanUrls', 'trailingSlash'].filter((k) => k in vercel);
check('vercel.json: KHÔNG đồng thời có routes và headers/rewrites/redirects/cleanUrls/trailingSlash',
  !(vercel.routes && CONFLICT.length), CONFLICT.length ? 'đang có: ' + CONFLICT.join(', ') : 'chỉ có builds + routes');
const swRoute = (vercel.routes || []).find((r) => r.src && r.src.includes('sw'));
const mfRoute = (vercel.routes || []).find((r) => r.src && r.src.includes('manifest'));
check('vercel.json: header /sw.js + /manifest.webmanifest nằm TRONG routes (continue:true) trước handle filesystem',
  !!swRoute && swRoute.continue === true && /no-store/.test(JSON.stringify(swRoute.headers)) && /Service-Worker-Allowed/.test(JSON.stringify(swRoute.headers || {})) &&
  !!mfRoute && mfRoute.continue === true && /manifest\+json/.test(JSON.stringify(mfRoute.headers || {})) &&
  (vercel.routes || []).some((r) => r.handle === 'filesystem'),
  (vercel.routes || []).map((r) => r.handle || r.src).join(' → '));

let hdr = null;
try { const r = await fetch(BASE + '/sw.js'); hdr = { status: r.status, cc: r.headers.get('cache-control'), ct: r.headers.get('content-type') }; } catch (e) { hdr = { status: 0, cc: '(lỗi ' + e.message + ')' }; }
check('sw.js tải được (200) và KHÔNG bị cache lâu', hdr.status === 200 && !!hdr.cc && !/max-age=[1-9]\d{3,}|immutable/.test(hdr.cc), 'cache-control: ' + hdr.cc);
let mh = null;
try { const r = await fetch(BASE + '/manifest.webmanifest'); mh = { status: r.status, ct: r.headers.get('content-type'), body: await r.json() }; } catch (e) { mh = { status: 0, ct: '(lỗi ' + e.message + ')' }; }
check('manifest phục vụ đúng content-type manifest+json', mh.status === 200 && /manifest\+json/.test(mh.ct || ''), mh.ct);
check('manifest qua HTTP khớp file trong repo', mh.body && mh.body.name === manifest.name && mh.body.icons.length === manifest.icons.length);

/* ---------- B. kiểm thật bằng chromium ---------- */
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

const swSupported = await page.evaluate(() => 'serviceWorker' in navigator && window.isSecureContext);
check('trang chạy trong secure context (localhost/https) và có serviceWorker', swSupported === true);
try {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 25000 });
  const info = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { state: r && r.active ? r.active.state : null, scope: r ? r.scope : null, controlled: !!navigator.serviceWorker.controller }; });
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

/* ---------- B2. ẢNH THẬT TỪ WIKIMEDIA: cache có nội dung + hiện đúng (online) ---------- */
// Món để kiểm: món ĐẦU TIÊN có ảnh thật (ảnh Wikimedia thật, không mock, không dùng SVG art).
const pick = await page.evaluate(() => {
  const d = window.__mgd.ALL().find((x) => x.image);
  return d ? { id: d.id, name: d.name, image: d.image } : null;
});
const heroState = () => page.evaluate(() => {
  const hero = document.querySelector('.win-hero');
  const img = hero && hero.querySelector('img');
  const fb = img && img.nextElementSibling;
  return {
    has: !!img,
    w: img ? img.naturalWidth : 0,
    h: img ? img.naturalHeight : 0,
    src: img ? img.src : '',
    disp: img ? getComputedStyle(img).display : '',
    fallback: !!(fb && getComputedStyle(fb).display !== 'none')
  };
});
const openByHash = async (id) => {
  await page.evaluate((x) => { location.hash = '#mon=' + encodeURIComponent(x); }, id);
  await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden && !!document.querySelector('.win-hero'), null, { timeout: 20000 });
  await page.waitForFunction(() => { const i = document.querySelector('.win-hero img'); return !!i && i.naturalWidth > 0; }, null, { timeout: 25000 }).catch(() => {});
  return heroState();
};
const cacheInfo = (src) => page.evaluate(async (u) => {
  for (const n of await caches.keys()) {
    if (!n.startsWith('img')) continue;
    const c = await caches.open(n);
    const r = await c.match(u, { ignoreVary: true });
    if (r) { const b = await r.blob(); return { cache: n, size: b.size, type: b.type, status: r.status }; }
  }
  return null;
}, src);

let imageOk = false, imgSrc = '';
if (!pick) {
  skipCheck('ảnh Wikimedia thật: cache có nội dung > 0 + hiện đúng', 'dữ liệu không có món nào kèm ảnh');
} else {
  // mở popup qua link chia sẻ #mon=<id> (đúng đường người dùng vào) -> ảnh tải qua service worker
  const hero = await openByHash(pick.id);
  imgSrc = hero.src;
  imageOk = hero.w > 0;
  const reachable = imageOk ? true : await page.evaluate((u) => fetch(u, { mode: 'cors' }).then((r) => r.ok).catch(() => false), pick.image);
  if (!imageOk && !reachable) {
    skipCheck('ảnh Wikimedia thật: cache có nội dung > 0 + hiện đúng', 'không với tới upload.wikimedia.org (dịch vụ ngoài)');
  } else {
    check('ONLINE: popup món "' + pick.name + '" hiện ẢNH THẬT (' + hero.w + '×' + hero.h + 'px), KHÔNG rơi về SVG fallback',
      hero.has && hero.w > 0 && hero.disp !== 'none' && !hero.fallback, imgSrc.slice(0, 90) + '…');
    const ci = await cacheInfo(imgSrc);
    check('CACHE ẢNH: response trong cache có NỘI DUNG > 0 byte, đúng kiểu ảnh (không phải blob rỗng/opaque)',
      !!ci && ci.size > 1000 && /^image\//.test(ci.type || '') && ci.status === 200,
      ci ? ci.cache + ' · ' + ci.size + 'B · ' + ci.type : 'KHÔNG có trong cache ảnh');
    // reload khi vẫn ONLINE: mở lại bằng #mon=<id>, ảnh phải hiện (cache-first)
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
    const after = await page.waitForFunction(() => {
      const i = document.querySelector('.win-hero img');
      return i && i.naturalWidth > 0 ? { w: i.naturalWidth, h: i.naturalHeight } : null;
    }, null, { timeout: 25000 }).then((h) => h.jsonValue()).catch(() => null);
    check('ONLINE + reload (mở lại bằng #mon=' + pick.id + '): ảnh vẫn hiện đúng', !!after && after.w > 0, after ? after.w + '×' + after.h + 'px' : 'ảnh không hiện sau reload');
  }
}

/* ---------- C. offline: reload vẫn mở được + ảnh đã cache vẫn hiện + quay ra popup ---------- */
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
  if (imageOk) {
    const off = await page.waitForFunction(() => {
      const i = document.querySelector('.win-hero img');
      return i && i.naturalWidth > 0 ? { w: i.naturalWidth, h: i.naturalHeight, disp: getComputedStyle(i).display } : null;
    }, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
    const fbShown = await page.evaluate(() => { const i = document.querySelector('.win-hero img'); const fb = i && i.nextElementSibling; return !!(fb && getComputedStyle(fb).display !== 'none'); });
    check('OFFLINE (reload, #mon=' + pick.id + '): ảnh ĐÃ CACHED vẫn hiện (' + (off ? off.w + '×' + off.h : 'không có <img>') + 'px), không rơi về SVG fallback',
      !!off && off.w > 0 && off.disp !== 'none' && !fbShown);
    const offCache = await cacheInfo(imgSrc);
    check('OFFLINE: bản ảnh trong cache vẫn đọc được nội dung > 0 byte', !!offCache && offCache.size > 1000, offCache ? offCache.size + 'B · ' + offCache.type : 'không đọc được');
  } else {
    skipCheck('OFFLINE: ảnh đã cache vẫn hiện', 'phần ảnh thật đã bỏ qua ở trên');
  }
  // đóng popup (link #mon bị xoá) rồi quay 1 món như luồng thường
  await page.evaluate(() => { const b = document.querySelector('[data-act="close"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
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
if (imageOk) {
  const keys = await page.evaluate(async () => { const n = (await caches.keys()).find((x) => x.startsWith('img-')); if (!n) return []; const c = await caches.open(n); return (await c.keys()).map((k) => k.url); });
  check('cache ảnh giữ đúng ảnh thật đã dùng và ≤150 ảnh',
    keys.length >= 1 && keys.length <= 150 && keys.some((u) => u.split('?')[0] === imgSrc.split('?')[0]),
    keys.length + ' ảnh trong cache');
}
check('không lỗi JS toàn luồng PWA/offline', errs.length === 0, errs.join(' | '));

await ctx.close(); await browser.close();
if (skipped.length) console.log('\nBỎ QUA (dịch vụ ngoài): ' + skipped.join(', '));
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
