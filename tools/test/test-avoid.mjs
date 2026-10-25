import { launchChromium } from '../lib/chromium.mjs';
// tools/test/test-avoid.mjs — KIỂM TRA "tránh món đã ăn gần đây".
// Đo 2000 lần drawOne: món vừa ăn (nhật ký 3 ngày) phải giảm mạnh, món vừa quay ra giảm nhẹ,
// tắt công tắc thì trở lại bình thường; pool nhỏ vẫn quay được (không loại hẳn).
// Dùng: node tools/test/test-avoid.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');

const ok = [], bad = [], skip = [];
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
  const pick = M.dishById('pho-bo') || ALL.find((d) => d.tier === 2) || ALL[0];
  // pool đo: 20 món (có món thử) để tần suất đủ lớn mà vẫn đo được tỉ lệ
  const sample = [pick, ...ALL.filter((d) => d !== pick).slice(0, 19)];
  const N = 2000;
  const count = (n) => { let c = 0; for (let i = 0; i < n; i++) if (M.drawOne(sample) === pick) c++; return c; };
  const saved = { diary: M.state.diary, recent: M.state.recentDraws, avoid: M.state.avoidRecent };

  M.state.avoidRecent = false; M.state.diary = []; M.state.recentDraws = [];
  const base = count(N);

  M.state.avoidRecent = true;
  M.state.diary = [{ id: pick.id, ts: Date.now(), meal: 'trua' }];
  M.state.recentDraws = [];
  const eaten = count(N);
  const factorEaten = M.avoidFactor(pick);

  M.state.diary = [];
  M.state.recentDraws = [pick.id];
  const recent = count(N);
  const factorRecent = M.avoidFactor(pick);

  M.state.diary = [{ id: pick.id, ts: Date.now() - 4 * 864e5 }];   // nhật ký 4 ngày trước -> không giảm nữa
  M.state.recentDraws = [];
  const oldDiary = count(N);

  // công tắc TẮT: mọi thứ trở lại như cũ
  M.state.avoidRecent = false;
  M.state.diary = [{ id: pick.id, ts: Date.now() }];
  M.state.recentDraws = [pick.id];
  const offAgain = count(N);

  // pool nhỏ toàn món vừa ăn: KHÔNG được loại hẳn
  const smallPool = ALL.slice(0, 3);
  M.state.avoidRecent = true;
  M.state.diary = smallPool.map((d) => ({ id: d.id, ts: Date.now() }));
  M.state.recentDraws = smallPool.map((d) => d.id);
  let smallHits = 0;
  for (let i = 0; i < 300; i++) if (smallPool.includes(M.drawOne(smallPool))) smallHits++;
  const factorsSmall = smallPool.map((d) => M.avoidFactor(d));

  M.state.diary = saved.diary; M.state.recentDraws = saved.recent; M.state.avoidRecent = saved.avoid;
  return { id: pick.id, name: pick.name, N, base, eaten, recent, oldDiary, offAgain, smallHits, factorEaten, factorRecent, factorsSmall };
});

const pct = (a, b) => (b ? (a / b) : 0);
const ratioEaten = pct(res.eaten, res.base), ratioRecent = pct(res.recent, res.base), ratioOld = pct(res.oldDiary, res.base), ratioOff = pct(res.offAgain, res.base);
console.log('=== TRÁNH MÓN LẶP (' + res.N + ' lần drawOne trên pool 20 món, món thử: ' + res.name + ') ===');
console.log('  không tránh           : ' + res.base + ' lần ra món này (mốc 100%)');
console.log('  đã ăn/ghi nhật ký 3 ngày: ' + res.eaten + ' lần (' + (ratioEaten * 100).toFixed(1) + '% mốc) · hệ số ' + res.factorEaten.toFixed(3));
console.log('  vừa quay ra (10 lượt) : ' + res.recent + ' lần (' + (ratioRecent * 100).toFixed(1) + '% mốc) · hệ số ' + res.factorRecent.toFixed(3));
console.log('  nhật ký cách 4 ngày   : ' + res.oldDiary + ' lần (' + (ratioOld * 100).toFixed(1) + '% mốc)');
console.log('  tắt công tắc         : ' + res.offAgain + ' lần (' + (ratioOff * 100).toFixed(1) + '% mốc)');
console.log('  pool 3 món đều vừa ăn : ' + res.smallHits + '/300 lần vẫn quay ra món trong pool · hệ số ' + res.factorsSmall.map((x) => x.toFixed(2)).join('/'));

check('món đã ăn 3 ngày giảm rõ (≤40% mốc)', ratioEaten <= 0.4, (ratioEaten * 100).toFixed(1) + '% mốc, hệ số ' + res.factorEaten.toFixed(3));
check('hệ số món đã ăn đúng ~×0.15', Math.abs(res.factorEaten - 0.15) < 0.001, res.factorEaten.toFixed(3));
check('món vừa quay ra giảm nhẹ (30–75% mốc)', ratioRecent >= 0.3 && ratioRecent <= 0.75, (ratioRecent * 100).toFixed(1) + '% mốc');
check('hệ số món vừa quay ra đúng ~×0.5', Math.abs(res.factorRecent - 0.5) < 0.001, res.factorRecent.toFixed(3));
check('nhật ký cũ hơn 3 ngày không còn bị giảm', ratioOld >= 0.75, (ratioOld * 100).toFixed(1) + '% mốc');
check('tắt công tắc -> quay lại bình thường', ratioOff >= 0.75 && res.factorEaten !== 1, (ratioOff * 100).toFixed(1) + '% mốc');
check('KHÔNG loại hẳn: pool nhỏ vẫn quay ra được', res.smallHits === 300 && res.factorsSmall.every((x) => x < 1), res.smallHits + '/300');
check('không lỗi JS khi đo', errs.length === 0, errs.join(' | '));

/* ---------- công tắc trong sheet lọc ---------- */
await page.click('#btnOpenSheet');
await page.waitForTimeout(350);
const sw = await page.evaluate(() => {
  const el = document.querySelector('#fAvoidRecent');
  if (!el) return null;
  const label = el.closest('.switch');
  const b = label.getBoundingClientRect();
  return {
    checked: el.checked, inGroup: label.closest('.fgroup') ? label.closest('.fgroup').querySelector('h3').textContent.trim() : '',
    labelText: label.querySelector('.switch-label').textContent.trim(),
    h: Math.round(b.height),
    lsValue: localStorage.getItem('mgd.avoidRecent'),
    stateValue: window.__mgd.state.avoidRecent
  };
});
if (!sw) { bad.push('công tắc #fAvoidRecent'); console.log('FAIL  có công tắc #fAvoidRecent trong sheet lọc'); }
else {
  check('có công tắc "🔁 Tránh món đã ăn gần đây" trong nhóm Thêm, mặc định BẬT',
    /Tránh món đã ăn gần đây/.test(sw.labelText) && sw.inGroup.indexOf('Thêm') >= 0 && sw.checked === true,
    sw.inGroup + ' · ' + sw.labelText.slice(0, 40));
  check('tap target công tắc ≥44px', sw.h >= 44, sw.h + 'px');
  // Toast chào mừng ("Đang là <bữa> — đã lọc sẵn cho bạn") hiện 1 lần sau khi boot ~600ms.
  // Chờ nó hiện rồi tắt HẲN trước khi bấm, nếu không nó ghi đè toast của công tắc (test chập chờn).
  await page.waitForFunction(() => !document.querySelector('#toastNotification').hidden, null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('#toastNotification').hidden, null, { timeout: 8000 }).catch(() => {});
  // bấm công tắc -> lưu mgd.avoidRecent
  await page.click('.f-avoid .track-ui');
  const offToast = await page.waitForFunction(() => {
    const t = document.querySelector('#toastNotification');
    return !t.hidden && /không tránh món nào|Quay đều/.test(t.textContent) ? t.textContent : null;
  }, null, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => '');
  const off = await page.evaluate(() => ({ stateValue: window.__mgd.state.avoidRecent, ls: JSON.parse(localStorage.getItem('mgd.avoidRecent')), checked: document.querySelector('#fAvoidRecent').checked }));
  check('bấm tắt -> state + localStorage mgd.avoidRecent = false', off.stateValue === false && off.ls === false && off.checked === false, JSON.stringify(off.ls));
  check('có toast giải thích khi tắt', /không tránh món nào|Quay đều/.test(offToast), (offToast || '(không có toast)').slice(0, 50));
  await page.click('.f-avoid .track-ui');
  await page.waitForTimeout(300);
  const on = await page.evaluate(() => ({ stateValue: window.__mgd.state.avoidRecent, ls: JSON.parse(localStorage.getItem('mgd.avoidRecent')), checked: document.querySelector('#fAvoidRecent').checked }));
  check('bấm bật lại -> mgd.avoidRecent = true', on.stateValue === true && on.ls === true && on.checked === true);
  // reload phải nhớ trạng thái
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
  const after = await page.evaluate(() => ({ stateValue: window.__mgd.state.avoidRecent, checked: document.querySelector('#fAvoidRecent').checked }));
  check('F5 vẫn nhớ trạng thái công tắc', after.stateValue === true && after.checked === true);
}

await ctx.close(); await browser.close();
if (skip.length) console.log('\nBỎ QUA (dịch vụ ngoài): ' + skip.join(', '));
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
