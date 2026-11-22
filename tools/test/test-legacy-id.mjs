// tools/test/test-legacy-id.mjs — ID_LEGACY: id món CŨ vẫn trỏ về món MỚI.
// Trường hợp thật: 'banh-plan' (Bánh plan) trùng món với 'banh-flan' (Bánh flan) -> gộp, giữ banh-flan.
// Kiểm:
//   1. dữ liệu: không còn món banh-plan; banh-flan có kw "Bánh plan" (tìm quán miền Nam vẫn ra)
//   2. link cũ #mon=banh-plan mở đúng popup Bánh flan
//   3. mgd.favs chứa id cũ -> hiện Bánh flan; có CẢ HAI id -> không nhân đôi
//   4. lịch sử / nhật ký / thực đơn / quán đã lưu chứa id cũ -> đọc ra banh-flan
// Không phụ thuộc mạng: chặn /api/* + Photon/Overpass.
// Dùng: node tools/test/test-legacy-id.mjs [baseUrl]
import { launchChromium } from '../lib/chromium.mjs';

const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const OLD = 'banh-plan', NEW = 'banh-flan';
let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };

const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.route(/\/api\//, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: '404' }));
await page.route('**/photon.komoot.io/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) }));
await page.route('**/overpass*/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) }));

const boot = () => page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
const winName = () => page.evaluate(() => (document.querySelector('.win-name') || {}).textContent || '');

/* ---------- 1. Dữ liệu ---------- */
await page.goto(BASE + '/', { waitUntil: 'load' });
await boot();
console.log('=== ID_LEGACY: ' + OLD + ' -> ' + NEW + ' ===');
const data = await page.evaluate(([o, n]) => {
  const all = window.__mgd.ALL();
  const neu = all.find((d) => d.id === n);
  return {
    total: all.length,
    oldCount: all.filter((d) => d.id === o).length,
    nameOld: all.filter((d) => d.name.toLowerCase() === 'bánh plan').length,
    hasNew: !!neu,
    newName: neu ? neu.name : '',
    kw: neu ? neu.kw || [] : []
  };
}, [OLD, NEW]);
check('dữ liệu không còn món id "' + OLD + '"', data.oldCount === 0, 'còn ' + data.oldCount + ' món');
check('không còn món tên "Bánh plan" thứ hai', data.nameOld === 0, 'còn ' + data.nameOld);
check('vẫn có món "' + NEW + '" (' + data.total + ' món)', data.hasNew && data.newName === 'Bánh flan', data.newName);
check(NEW + '.kw có "Bánh plan" (tìm quán theo tên miền Nam)', data.kw.some((k) => k.toLowerCase() === 'bánh plan'), JSON.stringify(data.kw));

/* ---------- 2. Link cũ #mon=banh-plan ---------- */
await page.goto(BASE + '/#mon=' + OLD, { waitUntil: 'load' });
await boot();
await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden, null, { timeout: 15000 });
const link = await page.evaluate(() => ({
  name: (document.querySelector('.win-name') || {}).textContent || '',
  lastWinner: window.__mgd.state.lastWinner ? window.__mgd.state.lastWinner.id : null,
  hash: location.hash
}));
check('mở /#mon=' + OLD + ' -> popup "Bánh flan"', /Bánh flan/.test(link.name), link.name.trim());
check('món đang mở là ' + NEW, link.lastWinner === NEW, String(link.lastWinner));
check('hash giữ nguyên link cũ (không tự đổi URL người dùng đã chia sẻ)', link.hash === '#mon=' + OLD, link.hash);
await page.evaluate(() => window.__mgd.closeModals());
await page.waitForTimeout(150);

/* ---------- 3. Yêu thích: id cũ -> món mới, không nhân đôi ---------- */
const seed = async (favs) => {
  await page.evaluate((favs) => {
    localStorage.clear();
    localStorage.setItem('mgd.favs', JSON.stringify(favs));
  }, favs);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await boot();
};
await seed([OLD]);
const fav1 = await page.evaluate(() => ({ favs: window.__mgd.state.favs.slice(), count: document.querySelector('#favCount').textContent }));
check('mgd.favs=[' + OLD + '] -> state.favs=[' + NEW + ']', fav1.favs.length === 1 && fav1.favs[0] === NEW, JSON.stringify(fav1.favs));
check('số ♥ trên header = 1 (không đếm trùng)', fav1.count === '1', fav1.count);
await page.evaluate(() => window.__mgd.openFavs());
await page.waitForSelector('#drawerBackdrop:not([hidden])', { timeout: 5000 });
const drawer1 = await page.evaluate(() => ({
  n: document.querySelectorAll('#drawerContent .favcell').length,
  text: [...document.querySelectorAll('#drawerContent .favcell b')].map((b) => b.textContent).join(' | ')
}));
check('drawer yêu thích hiện đúng 1 thẻ "Bánh flan"', drawer1.n === 1 && /Bánh flan/.test(drawer1.text), drawer1.n + ': ' + drawer1.text);

await seed([OLD, NEW]);
const fav2 = await page.evaluate(() => ({ favs: window.__mgd.state.favs.slice(), ls: JSON.parse(localStorage.getItem('mgd.favs') || '[]'), count: document.querySelector('#favCount').textContent }));
check('mgd.favs=[' + OLD + ',' + NEW + '] -> chỉ còn 1 món (không nhân đôi)', fav2.favs.length === 1 && fav2.favs[0] === NEW, JSON.stringify(fav2.favs));
await page.evaluate(() => window.__mgd.openFavs());
await page.waitForSelector('#drawerBackdrop:not([hidden])', { timeout: 5000 });
const drawer2 = await page.evaluate(() => ({
  n: document.querySelectorAll('#drawerContent .favcell').length,
  count: document.querySelector('#drawerFavCount').textContent
}));
check('drawer cũng chỉ 1 thẻ, bộ đếm = 1', drawer2.n === 1 && drawer2.count === '1', drawer2.n + ' thẻ · đếm ' + drawer2.count);
await page.click('#btnCloseDrawer');
await page.waitForTimeout(120);

/* ---------- 4. Lịch sử / nhật ký / thực đơn / quán đã lưu ---------- */
const now = Date.now();
await page.evaluate(([o, ts]) => {
  const t = new Date(ts);
  const today = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  localStorage.clear();
  localStorage.setItem('mgd.hist', JSON.stringify([o, 'pho-bo']));
  localStorage.setItem('mgd.seen', JSON.stringify([o]));
  localStorage.setItem('mgd.recentDraws', JSON.stringify([o]));
  localStorage.setItem('mgd.diary', JSON.stringify([{ id: o, ts: ts, meal: 'vat' }]));
  localStorage.setItem('mgd.menu', JSON.stringify({ date: today, sang: o, trua: null, toi: o }));
  localStorage.setItem('mgd.savedPlaces', JSON.stringify([{ key: 'osm:node/9199', name: 'Quán thử', lat: 10.77, lng: 106.7, osm: 'node/9199', dishes: [o, o], ts: ts }]));
}, [OLD, now]);
await page.goto(BASE + '/', { waitUntil: 'load' });
await boot();
const legacy = await page.evaluate(([o, n]) => {
  const st = window.__mgd.state;
  const p = window.__mgd.savedPlaces()[0] || {};
  return {
    hist: st.hist.slice(), seen: [...st.seen], recent: st.recentDraws.slice(),
    diary: st.diary.map((x) => x.id), menu: [st.menu.sang, st.menu.toi],
    dishes: p.dishes || [], savedSetHas: window.__mgd.savedSet().has(n),
    hitOld: window.__mgd.dishById(o) ? window.__mgd.dishById(o).id : null,
    histHtml: (document.querySelector('#historyFeed') || {}).textContent || '',
    todayHtml: (document.querySelector('#todayPanel') || document.querySelector('#todayBody') || {}).textContent || ''
  };
}, [OLD, NEW]);
check('lịch sử (mgd.hist) chuyển id cũ -> ' + NEW, legacy.hist[0] === NEW && !legacy.hist.includes(OLD), JSON.stringify(legacy.hist));
check('món đã khám phá (mgd.seen) chuyển sang ' + NEW, legacy.seen.length === 1 && legacy.seen[0] === NEW, JSON.stringify(legacy.seen));
check('10 món vừa quay (mgd.recentDraws) chuyển sang ' + NEW, legacy.recent[0] === NEW, JSON.stringify(legacy.recent));
check('nhật ký (mgd.diary) chuyển sang ' + NEW, legacy.diary[0] === NEW, JSON.stringify(legacy.diary));
check('thực món hôm nay (mgd.menu) chuyển sang ' + NEW, legacy.menu[0] === NEW && legacy.menu[1] === NEW, JSON.stringify(legacy.menu));
check('quán đã lưu: id món cũ -> ' + NEW + ', bỏ trùng', legacy.dishes.length === 1 && legacy.dishes[0] === NEW, JSON.stringify(legacy.dishes));
check('"chỉ món có quán đã lưu" nhận ra ' + NEW, legacy.savedSetHas === true);
check('dishById("' + OLD + '") trả về món ' + NEW, legacy.hitOld === NEW, String(legacy.hitOld));
check('dải lịch sử vẽ ra "Bánh flan" (không còn "Bánh plan")', /Bánh flan/.test(legacy.histHtml) && !/Bánh plan/.test(legacy.histHtml), legacy.histHtml.replace(/\s+/g, ' ').slice(0, 80));
check('không lỗi JS', errs.length === 0, errs.join(' | '));

await ctx.close(); await browser.close();
console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.length + ') ' + fails.join(', ') : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
