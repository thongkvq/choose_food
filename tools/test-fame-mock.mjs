const BASE = (process.argv[2] || 'http://127.0.0.1:4399').replace(/\/$/, '');
// tools/test-fame-mock.mjs — kiểm khối "quán có tiếng" + danh sách quán khớp món bằng dữ liệu GIẢ
// (Photon/Overpass thật hay chập chờn hoặc bị chặn, nên chặn mạng và trả JSON giả để kiểm CODE của mình).
// Chạy trên bản TĨNH (không /api) để kiểm luôn đường gọi thẳng của bản Vercel.
import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';

const LAT = 10.7725, LNG = 106.698;
// ~khoảng cách thật: 0.001 độ vĩ ~ 111m
const photonFeatures = [
  [106.6985, 10.7730, 'Quán Phở Bò 21', 'restaurant', 'vietnamese'],   // ~65m -> phải có
  [106.7000, 10.7760, 'Phở bò Hà Nội', 'restaurant', 'vietnamese'],    // ~470m -> phải có
  [106.8000, 10.8500, 'Phở bò thật xa', 'restaurant', 'vietnamese'],   // ~12km -> phải bị loại (bán kính 5km)
  [106.6990, 10.7735, 'Bến Thành', 'suburb', '']                        // không phải quán -> loại
].map(([lon, lat, name, kind, cuisine]) => ({
  properties: { osm_key: 'amenity', osm_value: kind, name, city: 'Hồ Chí Minh', extra: { cuisine, phone: '0900000000', opening_hours: '06:00-22:00' } },
  geometry: { coordinates: [lon, lat] }
}));
const branch = (lat, lon, name, tags) => ({ center: { lat, lon }, tags: Object.assign({ name, amenity: 'restaurant' }, tags) });
const FAMOUS = { brand: 'Phở Thìn', website: 'https://phothin.vn', opening_hours: '06:00-22:00', phone: '0900111222', 'addr:street': 'Lê Lợi', 'addr:city': 'Hồ Chí Minh' };
const overpassElements = [
  branch(10.7730, 106.6985, 'Phở Thìn', Object.assign({ cuisine: 'vietnamese', wikidata: 'Q123' }, FAMOUS)),   // fame cao -> famousMatch
  branch(10.7740, 106.6995, 'Phở Thìn', Object.assign({ cuisine: 'vietnamese' }, FAMOUS)),
  branch(10.7750, 106.7005, 'Phở Thìn', Object.assign({ cuisine: 'vietnamese' }, FAMOUS)),
  branch(10.7745, 106.6990, 'The Coffee House', { brand: 'The Coffee House', website: 'https://tch.vn', opening_hours: '07:00-23:00', phone: '0900333444', 'addr:street': 'Nguyễn Huệ' }),  // famousNear
  branch(10.7760, 106.7010, 'Quán Vô Danh', {}),                                        // không dấu hiệu nổi tiếng -> loại
  branch(10.9500, 106.8500, 'Phở Thìn Xa', Object.assign({ cuisine: 'vietnamese' }, FAMOUS))   // ~20km -> ngoài bán kính
];

const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  permissions: ['geolocation'], geolocation: { latitude: LAT, longitude: LNG } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const hits = { photon: 0, overpass: 0 };
// Đăng ký /api TRƯỚC: Playwright ưu tiên route đăng ký SAU, mà URL Photon có chứa '/api/'
await page.route(/\/api\/(whereami|nearby|weather|geocode|reverse-geocode)/, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: '404' }));   // giống bản tĩnh Vercel
await page.route('**/photon.komoot.io/**', (r) => { hits.photon++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: photonFeatures }) }); });
await page.route('**/overpass*/**', (r) => { hits.overpass++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: overpassElements }) }); });

await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
await page.evaluate(() => { localStorage.setItem('mgd.fame', '{}'); });   // bỏ cache "quán có tiếng"
await page.click('#btnSpinSingle');
await page.waitForSelector('#modalBackdrop:not([hidden]) .win-dialog', { timeout: 20000 });
await page.waitForTimeout(700);
await page.click('[data-act="nearby"]');
await page.waitForFunction(() => document.querySelector('#nearbyOut') && document.querySelector('#nearbyOut').dataset.done === '1', null, { timeout: 40000 });
await page.waitForTimeout(3500);   // chờ khối "quán có tiếng" đổ vào #famSlot

const out = await page.evaluate(() => {
  const o = document.querySelector('#nearbyOut');
  const txt = o.textContent.replace(/\s+/g, ' ');
  return {
    note: (o.querySelector('.nearby-note') || {}).textContent || '',
    shops: [...o.querySelectorAll('.shop')].map((s) => ({
      name: (s.querySelector('b') || {}).textContent,
      dist: (s.querySelector('.shop-dist') || {}).textContent,
      why: (s.querySelector('.fam-why') || {}).textContent || '',
      cls: s.className
    })),
    famTitles: [...o.querySelectorAll('.fam-title')].map((t) => t.textContent.trim()),
    hasFamMatch: txt.includes('Quán có tiếng bán món này'),
    hasFamNear: txt.includes('Quán có tiếng quanh đây'),
    hasDisclaimer: /không phải điểm đánh giá của khách/.test(txt),
    branchesText: txt.includes('3 chi nhánh'),
    hasBrandBadge: txt.includes('thương hiệu Phở Thìn'),
    hasWikiBadge: txt.includes('có hồ sơ Wikipedia/Wikidata'),
    outsideShown: txt.includes('Phở bò thật xa') || txt.includes('Phở Thìn Xa')
  };
});
const km = (s) => { const m = /([\d.]+)\s*km|(\d+)\s*m/.exec(s || ''); return m ? (m[1] ? parseFloat(m[1]) * 1000 : parseFloat(m[2])) : null; };
let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };

console.log('đã gọi giả: photon=' + hits.photon + ' overpass=' + hits.overpass);
console.log('ghi chú:', out.note);
out.shops.forEach((s) => console.log('   ' + (s.cls.indexOf('fam') >= 0 ? '⭐ ' : '   ') + s.name + ' | ' + s.dist + ' | ' + s.why.slice(0, 70)));
check('bản tĩnh gọi thẳng Photon (không cần /api)', hits.photon > 0);
check('bản tĩnh gọi thẳng Overpass bằng GET', hits.overpass > 0);
check('có quán khớp tên món', out.shops.some((s) => /Phở bò/.test(s.name || '')), JSON.stringify(out.shops.map((s) => s.name)));
check('loại quán ngoài bán kính (12km)', out.outsideShown === false);
check('khối "quán có tiếng bán món này" hiện', out.hasFamMatch);
check('khối "quán có tiếng quanh đây" hiện', out.hasFamNear);
check('có ghi chú nguồn OSM (không phải điểm khách)', out.hasDisclaimer);
check('gộp 3 chi nhánh Phở Thìn thành 1 dòng + hiện số chi nhánh', out.branchesText);
check('badge lý do: thương hiệu', out.hasBrandBadge);
check('badge lý do: hồ sơ Wikipedia/Wikidata', out.hasWikiBadge);
check('quán không dấu hiệu nổi tiếng bị loại', !out.shops.some((s) => /Vô Danh/.test(s.name || '')));
check('mọi quán hiện ra đều ≤ bán kính đang chọn', out.shops.every((s) => { const d = km(s.dist); return d == null || d <= 5000; }), JSON.stringify(out.shops.map((s) => s.dist)));
check('không lỗi JS', errs.length === 0, errs.join(' | '));
await ctx.close(); await browser.close();
console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.length + ') ' + fails.join(', ') : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
