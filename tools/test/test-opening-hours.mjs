// tools/test/test-opening-hours.mjs — giờ mở cửa quán (OSM opening_hours)
// PHẦN 1: unit thuần trên lib/opening-hours.js (không cần mạng, không cần browser), ≥20 case.
// PHẦN 2: UI thật bằng dữ liệu GIẢ (route Photon/Overpass, chặn /api như bản tĩnh Vercel):
//         badge 🟢/🟠/🔴/⚪ mỗi quán + công tắc "Chỉ quán đang mở".
// Dùng: node tools/test/test-opening-hours.mjs http://127.0.0.1:4399
import { launchChromium } from '../lib/chromium.mjs';
import { openStatus, parseOpeningHours } from '../../lib/opening-hours.js';

const BASE = (process.argv[2] || 'http://127.0.0.1:4399').replace(/\/$/, '');
let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };

/* ================= PHẦN 1: unit ================= */
// mốc cố định: Thứ Hai (Mon=0 … Sun=6)
let MONDAY = new Date(2026, 0, 5, 0, 0, 0);
while (MONDAY.getDay() !== 1) MONDAY.setDate(MONDAY.getDate() + 1);
const at = (day, h, m) => { const d = new Date(MONDAY); d.setDate(MONDAY.getDate() + day); d.setHours(h, m, 0, 0); return d; };
console.log('Mốc thử: Thứ Hai ' + MONDAY.toDateString());

console.log('\n1. Dạng hiểu được');
let s = openStatus('24/7', at(0, 3, 15));
check('24/7 -> đang mở, không có giờ đóng', s.state === 'open' && s.closesAt === '' && /Đang mở/.test(s.label), s.label);
s = openStatus('06:00-22:00', at(0, 8, 0));
check('06:00-22:00 lúc 08:00 -> mở, đóng lúc 22:00', s.state === 'open' && s.closesAt === '22:00' && s.label === '🟢 Đang mở · đóng lúc 22:00', s.label);
s = openStatus('06:00-22:00', at(0, 21, 45));
check('sắp đóng khi còn 15 phút', s.state === 'soon' && /Sắp đóng \(≤30 phút\)/.test(s.label), s.label);
s = openStatus('06:00-22:00', at(0, 21, 30));
check('còn đúng 30 phút vẫn tính "sắp đóng"', s.state === 'soon', s.label);
s = openStatus('06:00-22:00', at(0, 22, 0));
check('giờ đóng là biên: 22:00 đã đóng', s.state === 'closed', s.label);
s = openStatus('06:00-22:00', at(0, 5, 59));
check('trước giờ mở -> đóng + mở lại 06:00', s.state === 'closed' && s.opensAt === '06:00' && /mở lại 06:00/.test(s.label), s.label);
s = openStatus('Mo-Fr 08:00-22:00; Sa,Su 07:00-23:00', at(5, 7, 30));
check('nhiều quy tắc: Thứ Bảy mở lúc 07:30, đóng 23:00', s.state === 'open' && s.closesAt === '23:00', s.label);
s = openStatus('Mo-Fr 08:00-22:00; Sa,Su 07:00-23:00', at(6, 22, 0));
check('Chủ Nhật 22:00 vẫn mở (đóng 23:00)', s.state === 'open' && s.closesAt === '23:00', s.label);
s = openStatus('Mo-Fr 08:00-22:00; Sa,Su 07:00-23:00', at(6, 22, 40));
check('Chủ Nhật 22:40 -> sắp đóng (còn 20 phút)', s.state === 'soon', s.label);
s = openStatus('Mo-Fr 08:00-22:00; Sa,Su 07:00-23:00', at(0, 7, 0));
check('Thứ Hai 07:00 chưa mở (quy tắc ngày thường từ 08:00)', s.state === 'closed' && s.opensAt === '08:00', s.label);
s = openStatus('06:00-10:00,16:00-21:00', at(0, 12, 0));
check('2 khoảng trong ngày: 12:00 đóng, mở lại 16:00', s.state === 'closed' && s.opensAt === '16:00', s.label);
s = openStatus('06:00-10:00,16:00-21:00', at(0, 9, 0));
check('2 khoảng trong ngày: 09:00 mở, đóng 10:00', s.state === 'open' && s.closesAt === '10:00', s.label);
s = openStatus('06:00-10:00,16:00-21:00', at(0, 17, 0));
check('2 khoảng trong ngày: 17:00 mở, đóng 21:00', s.state === 'open' && s.closesAt === '21:00', s.label);
s = openStatus('18:00-02:00', at(0, 23, 0));
check('qua nửa đêm: 23:00 mở, đóng 02:00', s.state === 'open' && s.closesAt === '02:00', s.label);
s = openStatus('18:00-02:00', at(1, 1, 0));
check('qua nửa đêm: hôm sau 01:00 VẪN mở (ca của hôm qua)', s.state === 'open' && s.closesAt === '02:00', s.label);
s = openStatus('18:00-02:00', at(1, 2, 0));
check('qua nửa đêm: 02:00 đã đóng', s.state === 'closed', s.label);
s = openStatus('18:00-02:00', at(1, 12, 0));
check('qua nửa đêm: 12:00 đóng, mở lại 18:00 hôm nay', s.state === 'closed' && s.opensAt === '18:00' && !/mai/.test(s.label), s.label);
s = openStatus('Mo-Su 00:00-24:00', at(0, 3, 0));
check('kín ngày 00:00-24:00 -> coi như 24/7', s.state === 'open' && /24\/7/.test(s.label), s.label);
s = openStatus('Mo-Fr 08:00-12:00,13:00-17:00', at(4, 18, 0));
check('hết giờ Thứ Sáu -> mở lại 08:00 (T2)', s.state === 'closed' && s.opensAt === '08:00' && /T2/.test(s.label), s.label);
s = openStatus('Fr-Mo 09:00-17:00', at(0, 10, 0));
check('dải ngày vòng qua Chủ Nhật (Fr-Mo) vẫn mở Thứ Hai', s.state === 'open', s.label);
s = openStatus('Mo off', at(0, 12, 0));
check('riêng Thứ Hai nghỉ -> đóng', s.state === 'closed', s.label);
s = openStatus('Mo-Su off', at(0, 12, 0));
check('nghỉ cả tuần -> đóng', s.state === 'closed', s.label);

console.log('\n2. Dạng KHÔNG hiểu -> "chưa rõ", không đoán');
for (const [spec, why] of [
  ['PH off', 'ngày lễ PH'],
  ['SH 10:00-14:00', 'ngày lễ SH'],
  ['sunrise-sunset', 'mặt trời mọc/lặn'],
  ['Jan-Mar 10:00-14:00', 'theo tháng'],
  ['Mo[1] 09:00-12:00', 'thứ N trong tháng'],
  ['week 24-48 10:00-12:00', 'theo tuần'],
  ['!!! không phải giờ', 'chuỗi rác'],
  ['', 'chuỗi rỗng'],
  [null, 'null'],
  ['Mo-Fr 08:00-22:00 || Tu 10:00-12:00', 'toán tử ||'],
  ['Mo-Fr 08:00+', 'giờ mở ước lượng "+"']
]) {
  const r = openStatus(spec, at(0, 12, 0));
  check('không hiểu: ' + JSON.stringify(spec) + ' (' + why + ') -> ⚪ chưa rõ', r.state === 'unknown' && r.label === '⚪ Chưa rõ giờ' && r.known === false, r.label);
}
s = openStatus('Mo off', at(1, 12, 0));
check('chỉ khai báo Thứ Hai nghỉ -> Thứ Ba CHƯA RÕ (không đoán là đóng)', s.state === 'unknown', s.label);
check('parse: chuỗi rác trả ok=false', parseOpeningHours('garbage').ok === false);
check('parse: 24/7 có byDay đủ 7 ngày', parseOpeningHours('24/7').byDay.length === 7);

/* ================= PHẦN 2: UI với dữ liệu giả ================= */
const LAT = 10.7725, LNG = 106.698;
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
const rel = (min) => new Date(Date.now() + min * 60000);
const H_OPEN = hhmm(rel(-60)) + '-' + hhmm(rel(240));      // đang mở
const H_CLOSED = hhmm(rel(-180)) + '-' + hhmm(rel(-120));  // đã đóng
const H_OPEN2 = hhmm(rel(-120)) + '-' + hhmm(rel(300));    // đang mở (nguồn Overpass)
console.log('\n3. UI (dữ liệu giả): đang mở "' + H_OPEN + '", đã đóng "' + H_CLOSED + '", overpass "' + H_OPEN2 + '"');

let DISH = null;   // món sẽ mở popup — route đọc biến này để đặt tên quán theo từ khoá món
const feat = (lon, lat, name, extra, osmId) => ({
  properties: Object.assign({ osm_key: 'amenity', osm_value: 'restaurant', name, city: 'Hồ Chí Minh', osm_type: 'node', osm_id: osmId }, extra ? { extra } : {}),
  geometry: { coordinates: [lon, lat] }
});
const branch = (id, lat, lon, name, tags) => ({ type: 'node', id, lat, lon, tags: Object.assign({ name, amenity: 'restaurant' }, tags) });

const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  permissions: ['geolocation'], geolocation: { latitude: LAT, longitude: LNG } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.route(/\/api\/(whereami|nearby|weather|geocode|reverse-geocode)/, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: '404' }));
await page.route('**/photon.komoot.io/**', (r) => {
  const W = (DISH && DISH.kw && DISH.kw[0]) || 'Phở';
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [
    feat(106.6985, 10.7730, W + ' A đang mở', { opening_hours: H_OPEN }, 501),          // Photon có giờ -> 🟢
    feat(106.7000, 10.7760, W + ' B đã đóng', { opening_hours: H_CLOSED }, 502),        // -> 🔴
    feat(106.6990, 10.7735, W + ' C ghép osm id', {}, 555),                             // không giờ, ghép Overpass CÙNG osm id -> 🟢
    feat(106.6995, 10.7740, W + ' D tên giống nhưng xa', {}, null),                    // Overpass trùng tên nhưng 500m -> ⚪
    feat(106.7005, 10.7750, W + ' E giờ lạ', { opening_hours: 'PH off' }, 503)          // giờ không hiểu -> ⚪
  ] }) });
});
await page.route('**/overpass*/**', (r) => {
  const W = (DISH && DISH.kw && DISH.kw[0]) || 'Phở';
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [
    branch(555, LAT + 0.00027, LNG + 0.0005, W + ' C ghép osm id', { opening_hours: H_OPEN2 }),   // cùng osm id, ~60m
    branch(777, LAT + 0.0045, LNG, W + ' D tên giống nhưng xa', { opening_hours: H_OPEN2 })        // ~500m: KHÔNG ghép
  ] }) });
});

await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
await page.evaluate(() => localStorage.removeItem('mgd.fame'));
DISH = await page.evaluate(() => {
  const d = window.__mgd.ALL().find((x) => x.region === 'vn' && (x.kw || []).length);
  window.__mgd.openWin(d);
  return { id: d.id, name: d.name, kw: d.kw, region: d.region };
});
console.log('   món thử: ' + DISH.name + ' (kw: ' + (DISH.kw || []).join(', ') + ')');
await page.waitForSelector('#modalBackdrop:not([hidden]) .win-dialog', { timeout: 15000 });
await page.click('[data-act="nearby"]');
await page.waitForFunction(() => document.querySelector('#nearbyOut') && document.querySelector('#nearbyOut').dataset.done === '1', null, { timeout: 40000 });
// chờ Overpass giả (ghép giờ cho quán C) đổ vào
await page.waitForFunction(() => {
  const rows = [...document.querySelectorAll('#nearbyListSlot .shop-row')];
  const c = rows.find((r) => /ghép osm id/.test(r.textContent));
  return !!c && /Đang mở/.test(c.textContent);
}, null, { timeout: 40000 });

const rowsOf = () => page.evaluate(() => [...document.querySelectorAll('#nearbyListSlot .shop-row')].map((r) => ({
  name: (r.querySelector('.shop b') || {}).textContent || '',
  hours: (r.querySelector('.shop-hours') || {}).textContent || '',
  saveBtn: !!r.querySelector('.save-btn'),
  saveH: r.querySelector('.save-btn') ? Math.round(r.querySelector('.save-btn').getBoundingClientRect().height) : 0
})));
let rows = await rowsOf();
const row = (re) => rows.find((r) => re.test(r.name)) || { name: '', hours: '', saveBtn: false, saveH: 0 };
console.log('   quán hiện ra: ' + rows.map((r) => r.name + ' [' + r.hours + ']').join(' | '));
check('hiện đủ 5 quán giả', rows.length === 5, String(rows.length));
check('Photon có opening_hours -> 🟢 Đang mở', /🟢 Đang mở/.test(row(/A đang mở/).hours), row(/A đang mở/).hours);
check('quán đã đóng -> 🔴 Đã đóng', /🔴 Đã đóng/.test(row(/B đã đóng/).hours), row(/B đã đóng/).hours);
check('ghép giờ từ Overpass (cùng osm id) -> 🟢', /🟢/.test(row(/C ghép osm id/).hours), row(/C ghép osm id/).hours);
check('trùng tên nhưng xa 500m -> KHÔNG ghép, ⚪ Chưa rõ giờ', /⚪ Chưa rõ giờ/.test(row(/D tên giống nhưng xa/).hours), row(/D tên giống nhưng xa/).hours);
check('giờ không hiểu (PH off) -> ⚪ Chưa rõ giờ', /⚪ Chưa rõ giờ/.test(row(/E giờ lạ/).hours), row(/E giờ lạ/).hours);
check('mỗi quán có nút lưu 🔖', rows.every((r) => r.saveBtn));
check('nút lưu cao ≥44px', rows.every((r) => r.saveH >= 44), JSON.stringify(rows.map((r) => r.saveH)));

// công tắc "chỉ quán đang mở"
check('có công tắc #fOpenOnly và mặc định TẮT', await page.evaluate(() => { const el = document.querySelector('#fOpenOnly'); return !!el && !el.checked; }));
await page.evaluate(() => document.querySelector('#fOpenOnly').click());
await page.waitForTimeout(150);
rows = await rowsOf();
const noteTxt = await page.evaluate(() => (document.querySelector('#nearbyCountNote') || {}).textContent || '');
console.log('   sau khi bật "chỉ đang mở": ' + rows.map((r) => r.name).join(' | '));
console.log('   ghi chú: ' + noteTxt.replace(/\s+/g, ' ').slice(0, 110));
check('bật công tắc -> ẩn quán đã đóng', !rows.some((r) => /B đã đóng/.test(r.name)), JSON.stringify(rows.map((r) => r.name)));
check('VẪN giữ quán chưa rõ giờ (E)', rows.some((r) => /E giờ lạ/.test(r.name)));
check('VẪN giữ quán D (chưa ghép được giờ)', rows.some((r) => /D tên giống/.test(r.name)));
check('nói rõ số quán bị ẩn', /đã ẩn\s*1\s*quán đã đóng/.test(noteTxt.replace(/\s+/g, ' ')), noteTxt.replace(/\s+/g, ' ').slice(0, 90));
check('lưu lựa chọn vào localStorage mgd.openOnly', await page.evaluate(() => localStorage.getItem('mgd.openOnly') === 'true'));
await page.evaluate(() => document.querySelector('#fOpenOnly').click());
await page.waitForTimeout(150);
rows = await rowsOf();
check('tắt công tắc -> quán đã đóng hiện lại', rows.some((r) => /B đã đóng/.test(r.name)));
check('không lỗi JS', errs.length === 0, errs.join(' | '));

await ctx.close(); await browser.close();
console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.length + ') ' + fails.join(', ') : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
