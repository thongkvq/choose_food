import { launchChromium } from '../lib/chromium.mjs';
// tools/test/test-achv.mjs — THÀNH TỰU & CHUỖI NGÀY (v26)
// Thành tựu tính từ dữ liệu đã có (nhật ký / món đã khám phá / yêu thích / thực đơn hôm nay).
// Kiểm: đủ 14 thành tựu có tiến độ x/y, tính đúng vùng miền – chuỗi ngày – không lặp món,
// mở khoá chỉ toast MỘT lần (lưu mgd.achv), và hiện trong panel 📅 Hôm nay.
// Dùng: node tools/test/test-achv.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');

const ok = [], bad = [];
const check = (name, cond, extra) => {
  (cond ? ok : bad).push(name);
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? ' — ' + extra : ''));
};

const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

const res = await page.evaluate(() => {
  const M = window.__mgd, ALL = M.ALL();
  const saved = { diary: M.state.diary, seen: M.state.seen, favs: M.state.favs, menu: M.state.menu, achv: M.achvStore() };
  const VN = ['bac', 'trung', 'nam', 'tay-nam-bo', 'tay-nguyen'];
  const day = 864e5, now = Date.now();

  // 5 vùng miền (đặc sản gốc) + 7 ngày liền không lặp món
  const vungDishes = VN.map((k) => ALL.find((d) => d.region === 'vn' && d.vung === k && d.dacSan === true)).filter(Boolean);
  const weekDishes = ALL.filter((d) => d.region === 'vn').slice(0, 7);
  const intl = ALL.filter((d) => d.region !== 'vn').slice(0, 12);
  const veg = ALL.filter((d) => d.veg === 1).slice(0, 6);

  // bộ dữ liệu SẠCH cho chuỗi ngày: 7 ngày liền, 7 món khác nhau
  const clean7 = weekDishes.map((d, i) => ({ id: d.id, ts: now - (6 - i) * day, meal: 'trua' }));
  M.state.diary = clean7; M.state.menu = { date: null, sang: null, trua: null, toi: null };
  const cleanList = M.achvList();
  const cleanNolap = cleanList.find((a) => a.id === 'khong-lap-7');
  const cleanChuoi = cleanList.find((a) => a.id === 'chuoi-7');
  // thêm 1 món LẶP lại ở ngày kế tiếp -> chuỗi không-lặp phải dừng ở 7
  M.state.diary = clean7.concat([{ id: weekDishes[0].id, ts: now + day, meal: 'trua' }]);
  const brokenNolap = M.achvList().find((a) => a.id === 'khong-lap-7');

  const diary = [];
  weekDishes.forEach((d, i) => diary.push({ id: d.id, ts: now - (6 - i) * day, meal: 'trua' }));   // 7 ngày liền, không lặp
  vungDishes.forEach((d, i) => diary.push({ id: d.id, ts: now - i * day, meal: 'toi' }));
  intl.forEach((d, i) => diary.push({ id: d.id, ts: now - i * 2 * day, meal: 'sang' }));
  veg.forEach((d, i) => diary.push({ id: d.id, ts: now - i * 3 * day, meal: 'vat' }));
  diary.push({ id: 'khong-ton-tai-xyz', ts: now, meal: 'trua' });     // id lạ: phải bỏ qua, không lỗi

  M.state.diary = diary;
  M.state.seen = new Set(ALL.slice(0, 60).map((d) => d.id));           // 60 món đã khám phá
  M.state.favs = ALL.slice(0, 10).map((d) => d.id);                    // 10 yêu thích
  M.state.menu = { date: null, sang: ALL[0].id, trua: ALL[1].id, toi: ALL[2].id };

  const list = M.achvList();
  const by = (id) => list.find((a) => a.id === id);
  const shapeOK = list.every((a) => typeof a.n === 'number' && typeof a.target === 'number' && a.n <= a.target && a.pct >= 0 && a.pct <= 100 && typeof a.desc === 'string' && a.desc.length > 0);

  // mở khoá: lần đầu trả về danh sách mới, lần hai rỗng
  M.state.achv = { unlocked: {} };
  const first = M.checkAchv(false).map((a) => a.id);
  const second = M.checkAchv(false).map((a) => a.id);
  const stored = JSON.parse(localStorage.getItem('mgd.achv') || 'null');

  // toast chỉ hiện khi có thành tựu mới
  const fresh = { ...M.achvStore(), unlocked: {} };
  M.state.achv = fresh;
  const t1 = M.checkAchv(true).map((a) => a.id);
  const toast1 = (document.querySelector('#toastNotification') || {}).textContent || '';
  const t2 = M.checkAchv(true);

  const out = {
    n: list.length, shapeOK,
    cleanNolap: cleanNolap, cleanChuoi: cleanChuoi, brokenNolap: brokenNolap,
    du5: by('du-5-vung'), chuoi7: by('chuoi-7'), nolap: by('khong-lap-7'), chot5: by('chot-5'),
    intl10: by('quoc-te-10'), chay5: by('chay-5'), kp50: by('kham-pha-50'), kp150: by('kham-pha-150'),
    fav10: by('yeu-thich-10'), du3bua: by('du-3-bua'), dacsan20: by('dac-san-20'),
    first: first, second: second, storedKeys: stored && stored.unlocked ? Object.keys(stored.unlocked).length : 0,
    t1: t1, toast1: toast1, t2: t2, ids: list.map((a) => a.id)
  };
  M.state.diary = saved.diary; M.state.seen = saved.seen; M.state.favs = saved.favs;
  M.state.menu = saved.menu; M.state.achv = saved.achv;
  return out;
});

console.log('=== THÀNH TỰU: ' + res.n + ' mục ===');
console.log('  ' + res.ids.join(' · '));
check('có 10–15 thành tựu, mỗi cái đủ icon/tên/mô tả/tiến độ x/y', res.n >= 10 && res.n <= 15 && res.shapeOK, res.n + ' mục');
check('"Ăn đủ 5 vùng miền" đạt 5/5 khi nhật ký có đủ 5 vùng', res.du5 && res.du5.done && res.du5.n === 5, res.du5 ? res.du5.n + '/' + res.du5.target : 'thiếu');
check('"Chuỗi 7 ngày" tính đúng từ nhật ký liên tiếp', res.chuoi7 && res.chuoi7.done && res.chuoi7.n === 7, res.chuoi7 ? res.chuoi7.n + '/' + res.chuoi7.target : 'thiếu');
check('"7 ngày liền không lặp món" đạt 7 khi 7 ngày 7 món khác nhau', res.cleanNolap && res.cleanNolap.done && res.cleanNolap.n === 7, res.cleanNolap ? res.cleanNolap.n + '/' + res.cleanNolap.target : 'thiếu');
check('lặp lại một món ở ngày thứ 8 -> chuỗi không-lặp vẫn dừng ở 7', res.brokenNolap && res.brokenNolap.n === 7, res.brokenNolap ? res.brokenNolap.n + '/' + res.brokenNolap.target : 'thiếu');
check('"Chốt 10 món quốc tế" đếm đúng món ngoài Việt Nam', res.intl10 && res.intl10.done && res.intl10.n === 10, res.intl10 ? res.intl10.n + '/' + res.intl10.target : 'thiếu');
check('"Thử 20 món đặc sản" có tiến độ theo món đặc sản đã ăn', res.dacsan20 && res.dacsan20.n > 0, res.dacsan20 ? res.dacsan20.n + '/' + res.dacsan20.target : 'thiếu');
check('"Ăn chay 5 món" / "Chốt 5 món" / "Đủ 3 bữa" tính đúng', res.chay5.done && res.chot5.done && res.du3bua.done,
  'chay ' + res.chay5.n + ' · chốt ' + res.chot5.n + ' · bữa ' + res.du3bua.n);
check('mốc lớn chưa đạt thì vẫn hiện tiến độ (khám phá 50/150)', res.kp50.done && !res.kp150.done && res.kp150.n === 60,
  '50: ' + res.kp50.n + '/' + res.kp50.target + ' · 150: ' + res.kp150.n + '/' + res.kp150.target);
check('"Bộ sưu tập 10 món" đếm từ mgd.favs', res.fav10.done && res.fav10.n === 10, res.fav10.n + '/' + res.fav10.target);
check('mở khoá: lần đầu ghi mgd.achv, lần hai không trả về gì', res.first.length > 0 && res.second.length === 0 && res.storedKeys === res.first.length,
  res.first.length + ' mở khoá · lưu ' + res.storedKeys);
check('toast chỉ hiện khi có thành tựu MỚI (không lặp lại)', res.t1.length > 0 && /Mở khoá thành tựu/.test(res.toast1) && res.t2.length === 0,
  res.toast1.replace(/\s+/g, ' ').slice(0, 70));

/* ---------- UI trong panel Hôm nay ---------- */
await page.click('#btnToday');
await page.waitForTimeout(500);
const ui = await page.evaluate(() => {
  const b = document.querySelector('#todayBody');
  const cards = [...b.querySelectorAll('.achv-card')];
  const done = cards.filter((c) => c.classList.contains('done'));
  const sec = [...b.querySelectorAll('.sec-h')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
  const achvSec = sec.find((t) => t.indexOf('Thành tựu') >= 0) || '';
  return {
    cards: cards.length, done: done.length, sec: achvSec,
    hasBar: cards.every((c) => c.querySelector('.bar') && c.querySelector('small')),
    sample: cards.slice(0, 2).map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
    smallBtns: [...b.querySelectorAll('button')].filter((x) => x.offsetParent !== null && x.getBoundingClientRect().height < 40).length
  };
});
check('panel Hôm nay có mục 🏆 Thành tựu với đủ thẻ + thanh tiến độ', ui.cards >= 10 && ui.hasBar && /Thành tựu \(\d+\/\d+\)/.test(ui.sec), ui.sec + ' · ' + ui.cards + ' thẻ, ' + ui.done + ' đã mở');
check('thẻ thành tựu hiện tên + mô tả + x/y', ui.sample.length > 0 && /\d+\/\d+/.test(ui.sample[0]), (ui.sample[0] || '').slice(0, 70));
check('không lỗi JS', errs.length === 0, errs.slice(0, 3).join(' | '));

await ctx.close(); await browser.close();
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
