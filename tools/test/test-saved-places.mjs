// tools/test/test-saved-places.mjs — "Quán đã lưu" (mgd.savedPlaces)
// Lưu/bỏ lưu quán từ kết quả tìm quán, giữ sau reload, ghi chú, xoá, "Quán quen" trong popup món,
// và bộ lọc "Chỉ món có quán đã lưu" (kể cả lúc 0 món phải BÁO RÕ, không quay rỗng).
// Không phụ thuộc mạng: route giả Photon/Overpass + /api trả 404 (giống bản tĩnh Vercel).
// Dùng: node tools/test/test-saved-places.mjs http://127.0.0.1:4399
import { launchChromium } from '../lib/chromium.mjs';

const BASE = (process.argv[2] || 'http://127.0.0.1:4399').replace(/\/$/, '');
let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };

const LAT = 10.7725, LNG = 106.698;
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
const rel = (min) => new Date(Date.now() + min * 60000);
const H_OPEN = hhmm(rel(-60)) + '-' + hhmm(rel(240));
let DISH = null;

const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  permissions: ['geolocation'], geolocation: { latitude: LAT, longitude: LNG } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.route(/\/api\/(whereami|nearby|weather|geocode|reverse-geocode)/, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: '404' }));
await page.route('**/photon.komoot.io/**', (r) => {
  const W = (DISH && DISH.kw && DISH.kw[0]) || 'Phở';
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [
    { properties: { osm_key: 'amenity', osm_value: 'restaurant', name: W + ' Quán Một', city: 'Hồ Chí Minh', osm_type: 'node', osm_id: 9012,
      extra: { opening_hours: H_OPEN, phone: '0900111222' } }, geometry: { coordinates: [106.6985, 10.7730] } },
    { properties: { osm_key: 'amenity', osm_value: 'restaurant', name: W + ' Quán Hai', city: 'Hồ Chí Minh', osm_type: 'node', osm_id: 9013,
      extra: { opening_hours: H_OPEN } }, geometry: { coordinates: [106.7020, 10.7800] } }
  ] }) });
});
await page.route('**/overpass*/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) }));

const boot = async () => {
  await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
};
const savedLS = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mgd.savedPlaces') || '[]'); } catch (e) { return []; } });

await page.goto(BASE + '/', { waitUntil: 'load' });
await boot();
await page.evaluate(() => { localStorage.removeItem('mgd.savedPlaces'); localStorage.removeItem('mgd.savedOnly'); localStorage.removeItem('mgd.fame'); });
await page.reload({ waitUntil: 'load' });
await boot();
DISH = await page.evaluate(() => {
  const p = window.__mgd.pool();
  const d = p.find((x) => x.region === 'vn' && (x.kw || []).length) || p[0];
  window.__mgd.openWin(d);
  return { id: d.id, name: d.name, kw: d.kw || [], region: d.region };
});
console.log('món thử: ' + DISH.name + ' (' + DISH.id + ') · kw: ' + DISH.kw.join(', '));
await page.waitForSelector('#modalBackdrop:not([hidden]) .win-dialog', { timeout: 15000 });
await page.click('[data-act="nearby"]');
await page.waitForFunction(() => document.querySelector('#nearbyOut') && document.querySelector('#nearbyOut').dataset.done === '1', null, { timeout: 40000 });
await page.waitForFunction(() => document.querySelectorAll('#nearbyListSlot .shop-row').length >= 2, null, { timeout: 40000 });

const firstRow = await page.evaluate(() => {
  const r = document.querySelector('#nearbyListSlot .shop-row');
  return { name: r.querySelector('.shop b').textContent, hours: (r.querySelector('.shop-hours') || {}).textContent || '' };
});
console.log('quán đầu tiên: ' + firstRow.name + ' [' + firstRow.hours + ']');

console.log('\n1. Lưu quán');
await page.click('#nearbyListSlot .shop-row .save-btn');
await page.waitForTimeout(150);
let saved = await savedLS();
check('bấm 🔖 -> localStorage mgd.savedPlaces có 1 quán', saved.length === 1, JSON.stringify(saved.map((p) => p.name)));
const sp = saved[0] || {};
check('lưu đủ tên quán', sp.name === firstRow.name, sp.name + ' vs ' + firstRow.name);
check('lưu toạ độ lat/lng', Number.isFinite(sp.lat) && Number.isFinite(sp.lng) && Math.abs(sp.lat - LAT) < 0.02, sp.lat + ',' + sp.lng);
check('lưu osm id', sp.osm === 'N9012', String(sp.osm));
check('lưu opening_hours', sp.open === H_OPEN, sp.open);
check('lưu id món đã tìm ra quán', Array.isArray(sp.dishes) && sp.dishes.includes(DISH.id), JSON.stringify(sp.dishes));
check('lưu thời điểm lưu (ts)', Number.isFinite(sp.ts) && sp.ts > 0, String(sp.ts));
check('lưu link chỉ đường', /google\.com\/maps\/dir\/\?api=1&destination=/.test(sp.maps || ''), (sp.maps || '').slice(0, 60));
check('nút đổi trạng thái đã lưu (aria-pressed=true)', await page.evaluate(() => document.querySelector('#nearbyListSlot .save-btn').getAttribute('aria-pressed') === 'true'));

console.log('\n2. Bấm lại để bỏ lưu');
await page.click('#nearbyListSlot .shop-row .save-btn');
await page.waitForTimeout(150);
check('bấm lần 2 -> bỏ lưu khỏi localStorage', (await savedLS()).length === 0);

console.log('\n3. Lưu lại rồi RELOAD — phải còn');
await page.click('#nearbyListSlot .shop-row .save-btn');
await page.waitForTimeout(120);
await page.reload({ waitUntil: 'load' });
await boot();
saved = await page.evaluate(() => window.__mgd.savedPlaces().map((p) => ({ name: p.name, note: p.note, dishes: p.dishes })));
check('reload vẫn còn quán đã lưu', saved.length === 1 && saved[0].name === firstRow.name, JSON.stringify(saved));
check('dữ liệu cũ: id món trong quán đã lưu đọc qua idNow() (vẫn khớp món)', await page.evaluate((id) => !!window.__mgd.dishById(id) && window.__mgd.savedSet().has(id), DISH.id));

console.log('\n4. Drawer "Quán đã lưu": danh sách, ghi chú');
await page.click('#btnFav');
await page.waitForSelector('#drawerBackdrop:not([hidden])', { timeout: 5000 });
const drawer = await page.evaluate(() => ({
  count: (document.querySelector('#drawerSavedCount') || {}).textContent || '',
  cards: [...document.querySelectorAll('#drawerContent .saved-card')].map((c) => ({
    name: (c.querySelector('.saved-card-head b') || {}).textContent || '',
    hours: (c.querySelector('.saved-hours') || {}).textContent || '',
    hasNote: !!c.querySelector('.sp-note'),
    hasDir: !!c.querySelector('a.saved-btn[href*="google.com/maps"]'),
    hasDel: !!c.querySelector('[data-sp-rm]')
  }))
}));
console.log('   ' + JSON.stringify(drawer.cards));
check('drawer có mục "Quán đã lưu" + số lượng', drawer.count === '1' && /Quán đã lưu/.test(await page.evaluate(() => document.querySelector('#drawerContent').textContent)));
check('thẻ quán có tên + trạng thái giờ mở cửa', drawer.cards.length === 1 && drawer.cards[0].name === firstRow.name && /Đang mở/.test(drawer.cards[0].hours), drawer.cards[0] && drawer.cards[0].hours);
check('thẻ quán có ô ghi chú + nút chỉ đường + nút xoá', !!(drawer.cards[0] && drawer.cards[0].hasNote && drawer.cards[0].hasDir && drawer.cards[0].hasDel));

await page.fill('#drawerContent .sp-note', 'phở bò ngon, 11h trưa đông');
await page.press('#drawerContent .sp-note', 'Tab');
await page.waitForTimeout(150);
saved = await savedLS();
check('sửa ghi chú -> lưu vào localStorage', saved[0] && saved[0].note === 'phở bò ngon, 11h trưa đông', saved[0] && saved[0].note);
await page.click('#btnCloseDrawer');
await page.waitForTimeout(100);

console.log('\n5. Popup món: "🔖 Quán quen" hiện ngay (không cần bấm tìm, không mạng)');
await page.evaluate((id) => window.__mgd.openWin(window.__mgd.dishById(id)), DISH.id);
await page.waitForSelector('#modalBackdrop:not([hidden]) .win-dialog', { timeout: 10000 });
const quen = await page.evaluate(() => {
  const el = document.querySelector('#savedForDish');
  return { text: (el ? el.textContent : '').replace(/\s+/g, ' '), rows: el ? el.querySelectorAll('.saved-here-row').length : 0 };
});
console.log('   ' + quen.text.slice(0, 120));
check('popup hiện "Quán quen" ngay đầu khối tìm quán', /Quán quen/.test(quen.text) && quen.rows === 1, quen.text.slice(0, 60));
check('"Quán quen" có tên quán + ghi chú + giờ mở cửa', quen.text.includes(firstRow.name) && /phở bò ngon/.test(quen.text) && /Đang mở/.test(quen.text));
check('không cần bấm "Tìm quán" vẫn thấy (chạy offline)', await page.evaluate(() => document.querySelector('#nearbyOut').innerHTML === ''));

console.log('\n6. Bộ lọc "Chỉ món có quán đã lưu"');
await page.evaluate(() => document.querySelector('#fHasSavedPlace').click());
await page.waitForTimeout(200);
const filt = await page.evaluate(() => ({ n: window.__mgd.pool().length, ids: window.__mgd.pool().map((d) => d.id), on: document.querySelector('#fHasSavedPlace').checked, badge: document.querySelector('#filterCount').textContent }));
check('bật lọc -> pool chỉ còn món có quán đã lưu', filt.on && filt.n === 1 && filt.ids[0] === DISH.id, JSON.stringify(filt));
check('lưu lựa chọn lọc vào localStorage', await page.evaluate(() => localStorage.getItem('mgd.savedOnly') === 'true'));

console.log('\n7. Xoá hết quán đã lưu khi lọc đang bật -> báo RÕ, không quay rỗng');
await page.evaluate(() => window.__mgd.closeModals());   // đóng popup món trước khi mở drawer
await page.waitForTimeout(120);
await page.click('#btnFav');
await page.waitForSelector('#drawerBackdrop:not([hidden])', { timeout: 5000 });
await page.click('#drawerContent [data-sp-rm]');
await page.waitForTimeout(250);
const zero = await page.evaluate(() => ({
  n: window.__mgd.pool().length,
  saved: window.__mgd.savedPlaces().length,
  toast: (document.querySelector('#toastNotification') || {}).textContent || '',
  disabled: document.querySelector('#btnSpinSingle').disabled,
  status: (document.querySelector('#poolStatusText') || {}).textContent || ''
}));
console.log('   toast: ' + zero.toast.replace(/\s+/g, ' ').slice(0, 90));
check('bấm ✕ -> xoá khỏi localStorage', zero.saved === 0 && (await savedLS()).length === 0);
check('0 món khớp -> nút QUAY bị khoá (không quay rỗng)', zero.n === 0 && zero.disabled === true);
check('báo rõ lý do bằng tiếng Việt', /quán đã lưu/i.test(zero.toast), zero.toast.replace(/\s+/g, ' ').slice(0, 80));
check('dòng trạng thái pool cũng nói rõ', /quán đã lưu/i.test(zero.status), zero.status.slice(0, 80));

// tắt lọc -> quay lại bình thường
await page.evaluate(() => document.querySelector('#fHasSavedPlace').click());
await page.waitForTimeout(150);
check('tắt lọc -> pool trở lại > 0', await page.evaluate(() => window.__mgd.pool().length > 0));
check('không lỗi JS', errs.length === 0, errs.join(' | '));

await ctx.close(); await browser.close();
console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.length + ') ' + fails.join(', ') : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
