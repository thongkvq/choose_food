import { launchChromium } from '../lib/chromium.mjs';
// tools/test/test-goals.mjs — MỤC TIÊU CALO / NGÂN SÁCH (v26)
// Đo 2000 lần drawOne: món vượt phần còn lại của hôm nay phải ra ÍT hơn rõ rệt; tắt công tắc thì
// trở lại bình thường; món vừa mục tiêu KHÔNG bị đổi; món vượt KHÔNG bị loại khỏi pool.
// Kiểm cả UI panel 📅 Hôm nay: 3 ô nhập, thanh "đã dùng / mục tiêu", công tắc ưu tiên, chip bối cảnh.
// Dùng: node tools/test/test-goals.mjs [baseUrl]
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
  const hi = ALL.find((d) => d.calories >= 700 && d.price <= 2);        // 730–750 kcal, rẻ
  const lo = ALL.find((d) => d.calories > 0 && d.calories <= 150);     // nhẹ
  const pricy = ALL.find((d) => d.price === 4 && d.calories > 0);      // 160k
  const cheap = ALL.find((d) => d.price === 1 && d.calories > 0);      // 25k
  // pool đo A: món nặng + 19 món NHẸ (≤400 kcal) -> chỉ món nặng bị giảm khi mục tiêu kcal 500
  const lightA = ALL.filter((d) => d !== hi && d.calories > 0 && d.calories <= 400).slice(0, 19);
  const sampleA = [hi, lo, ...lightA.filter((d) => d !== lo)];
  // pool đo B: món đắt (price 4) + 19 món RẺ (price 1) -> chỉ món đắt bị giảm khi ngân sách 60k
  const cheapB = ALL.filter((d) => d !== pricy && d.price === 1 && d.calories > 0).slice(0, 19);
  const sampleB = [pricy, cheap, ...cheapB.filter((d) => d !== cheap)];
  const N = 2000;
  const count = (pick, pool) => { const src = pool || sampleA; let c = 0; for (let i = 0; i < N; i++) if (M.drawOne(src) === pick) c++; return c; };
  const saved = { diary: M.state.diary, menu: M.state.menu, goals: M.goals() };

  // hôm nay chưa ăn gì -> phần còn lại = đúng mục tiêu
  M.state.diary = []; M.state.menu = { date: null, sang: null, trua: null, toi: null };

  M.setGoals({ kcal: 0, money: 0, priority: true });
  const baseHi = count(hi), baseLo = count(lo), basePricy = count(pricy, sampleB), baseCheap = count(cheap, sampleB);

  // (A) mục tiêu kcal vừa phải: món nặng (730+) vượt, món nhẹ (≤150) thì không
  const goalsKcal = M.setGoals({ kcal: 500, money: 0, priority: true });
  const onHi = count(hi), onLo = count(lo);
  const factorHi = M.goalFactor(hi, goalsKcal, M.goalUsage(), { on: true, priceOf: M.priceOf });
  const factorLo = M.goalFactor(lo, goalsKcal, M.goalUsage(), { on: true, priceOf: M.priceOf });

  // (B) mục tiêu tiền: chỉ món đắt vượt
  const goalsMoney = M.setGoals({ kcal: 0, money: 60000, priority: true });
  const onPricy = count(pricy, sampleB), onCheap = count(cheap, sampleB);
  const factorPricy = M.goalFactor(pricy, goalsMoney, M.goalUsage(), { on: true, priceOf: M.priceOf });
  const factorCheap = M.goalFactor(cheap, goalsMoney, M.goalUsage(), { on: true, priceOf: M.priceOf });

  // (C) vượt CẢ HAI (kcal + tiền) -> ×0.4 ×0.4
  const goalsBoth = M.setGoals({ kcal: 200, money: 30000, priority: true });
  const factorBoth = M.goalFactor(pricy, goalsBoth, M.goalUsage(), { on: true, priceOf: M.priceOf });

  // (D) tắt công tắc -> về 1 và quay lại nhịp cũ
  const off = M.setGoals({ kcal: 500, money: 0, priority: false });
  const offHi = count(hi);
  const factorOff = M.goalFactor(hi, off, M.goalUsage(), { on: off.priority, priceOf: M.priceOf });

  // (E) KHÔNG loại hẳn: pool toàn món vượt vẫn quay ra được
  M.setGoals({ kcal: 100, money: 0, priority: true });
  const onlyOver = [hi, pricy, cheap].filter(Boolean);
  let hits = 0;
  for (let i = 0; i < 300; i++) if (onlyOver.includes(M.drawOne(onlyOver))) hits++;

  // (F) mục tiêu tuần -> ngân sách ngày = tuần / 7
  const weekOnly = M.budgetOf({ kcal: 0, money: 0, week: 700000 }, 'day');
  const weekScope = M.budgetOf({ kcal: 0, money: 0, week: 700000 }, 'week');

  // (G) đã dùng hôm nay: nhật ký hôm nay + thực đơn (không tính trùng)
  const d1 = lo, d2 = cheap;
  M.state.diary = [{ id: d1.id, ts: Date.now(), meal: 'sang' }];
  M.state.menu = { date: null, sang: d1.id, trua: d2.id, toi: null };
  const used = M.goalUsage();
  const idsUsed = M.usedTodayIds();
  const rows = M.progressRows({ kcal: 1000, money: 100000, week: 0, priority: true }, used);

  // dọn lại
  M.state.diary = saved.diary; M.state.menu = saved.menu;
  M.setGoals(saved.goals);
  return { hi: hi.id, hiCal: hi.calories, lo: lo.id, loCal: lo.calories, pricy: pricy.id, cheap: cheap.id, N,
    baseHi, baseLo, basePricy, baseCheap, onHi, onLo, onPricy, onCheap, offHi,
    factorHi, factorLo, factorPricy, factorCheap, factorBoth, factorOff, hits,
    weekOnly, weekScope, used: used, nUsedIds: idsUsed.length, rows: rows };
});

const r = (a, b) => (b ? a / b : 0);
console.log('=== MỤC TIÊU: ' + res.N + ' lần drawOne trên pool 20 món ===');
console.log('  không mục tiêu        : nặng ' + res.baseHi + ' | nhẹ ' + res.baseLo + ' | đắt ' + res.basePricy + ' | rẻ ' + res.baseCheap);
console.log('  kcal ≤500 (chỉ nặng vượt): nặng ' + res.onHi + ' (' + (r(res.onHi, res.baseHi) * 100).toFixed(1) + '% mốc) · hệ số ' + res.factorHi.toFixed(2) + ' | nhẹ ' + res.onLo + ' (' + (r(res.onLo, res.baseLo) * 100).toFixed(1) + '%)');
console.log('  tiền ≤60k (chỉ đắt vượt) : đắt ' + res.onPricy + ' (' + (r(res.onPricy, res.basePricy) * 100).toFixed(1) + '% mốc) · hệ số ' + res.factorPricy.toFixed(2) + ' | rẻ ' + res.onCheap + ' (' + (r(res.onCheap, res.baseCheap) * 100).toFixed(1) + '%)');
console.log('  tắt công tắc          : nặng ' + res.offHi + ' (' + (r(res.offHi, res.baseHi) * 100).toFixed(1) + '% mốc) · hệ số ' + res.factorOff.toFixed(2));
console.log('  pool toàn món vượt    : ' + res.hits + '/300 lần vẫn ra món trong pool');
console.log('  mục tiêu tuần         : ngày ' + res.weekOnly + ' · tuần ' + res.weekScope);
console.log('  đã dùng hôm nay       : ' + res.used.kcal + ' kcal · ' + res.used.money + '₫ · ' + res.nUsedIds + ' món (' + res.used.n + ' tính tiền)');

check('món vượt kcal ra ít hơn rõ rệt (≤60% mốc)', r(res.onHi, res.baseHi) <= 0.6, (r(res.onHi, res.baseHi) * 100).toFixed(1) + '% mốc');
check('hệ số món vượt kcal đúng ×0.4', Math.abs(res.factorHi - 0.4) < 0.001, res.factorHi.toFixed(3));
check('món vừa mục tiêu kcal KHÔNG bị giảm (hệ số 1)', Math.abs(res.factorLo - 1) < 0.001, 'hệ số ' + res.factorLo.toFixed(3));
check('món vượt ngân sách ra ít hơn rõ rệt (≤60% mốc)', r(res.onPricy, res.basePricy) <= 0.6, (r(res.onPricy, res.basePricy) * 100).toFixed(1) + '% mốc');
check('hệ số món vượt tiền đúng ×0.4, món rẻ giữ nguyên', Math.abs(res.factorPricy - 0.4) < 0.001 && Math.abs(res.factorCheap - 1) < 0.001, res.factorPricy.toFixed(3) + ' / ' + res.factorCheap.toFixed(3));
check('vượt cả kcal lẫn tiền -> ×0.16', Math.abs(res.factorBoth - 0.16) < 0.001, res.factorBoth.toFixed(3));
check('tắt công tắc -> hệ số 1 và quay lại bình thường', Math.abs(res.factorOff - 1) < 0.001 && r(res.offHi, res.baseHi) >= 0.75, (r(res.offHi, res.baseHi) * 100).toFixed(1) + '% mốc');
check('KHÔNG loại hẳn: pool toàn món vượt vẫn quay được', res.hits === 300, res.hits + '/300');
check('mục tiêu tuần -> ngân sách ngày = tuần/7', res.weekOnly === 100000 && res.weekScope === 700000, res.weekOnly + ' / ' + res.weekScope);
check('đã dùng hôm nay = nhật ký + thực đơn, không tính trùng', res.used.n === 2 && res.nUsedIds === 2, res.nUsedIds + ' món');
check('progressRows trả 2 thanh có used/target/pct', res.rows.length === 2 && res.rows[0].target === 1000 && res.rows[1].target === 100000,
  res.rows.map((x) => x.key + ' ' + x.pct + '%').join(' · '));

/* ---------- UI: panel Hôm nay ---------- */
await page.click('#btnToday');
await page.waitForTimeout(500);
const ui = await page.evaluate(() => {
  const b = document.querySelector('#todayBody');
  const q = (s) => b.querySelector(s);
  return {
    hasKcal: !!q('#goalKcal'), hasMoney: !!q('#goalMoney'), hasWeek: !!q('#goalWeek'), hasSwitch: !!q('#fGoalPriority'),
    checked: q('#fGoalPriority') ? q('#fGoalPriority').checked : null,
    labelText: q('.goal-sw .switch-label') ? q('.goal-sw .switch-label').textContent.trim() : '',
    barH: q('.goal-sw') ? Math.round(q('.goal-sw').getBoundingClientRect().height) : 0,
    inputH: q('#goalKcal') ? Math.round(q('#goalKcal').getBoundingClientRect().height) : 0,
    secH: [...b.querySelectorAll('.sec-h')].map((x) => x.textContent.trim()),
    bars: b.querySelectorAll('.goal-bar').length
  };
});
check('panel Hôm nay có 3 ô nhập mục tiêu (kcal/ngày, tiền/ngày, tiền/tuần)', ui.hasKcal && ui.hasMoney && ui.hasWeek);
check('có công tắc "Ưu tiên món vừa mục tiêu", tap ≥44px', ui.hasSwitch && /Ưu tiên món vừa mục tiêu/.test(ui.labelText) && ui.barH >= 44 && ui.inputH >= 44, 'switch ' + ui.barH + 'px · input ' + ui.inputH + 'px');
check('mục "🎯 Mục tiêu hôm nay" nằm trong panel', ui.secH.some((t) => t.indexOf('Mục tiêu hôm nay') >= 0), ui.secH.slice(0, 3).join(' | '));

// nhập mục tiêu qua UI -> lưu mgd.goals + vẽ thanh tiến độ
await page.fill('#goalKcal', '1500');
await page.dispatchEvent('#goalKcal', 'input');
await page.fill('#goalMoney', '120000');
await page.dispatchEvent('#goalMoney', 'input');
await page.waitForTimeout(300);
const saved2 = await page.evaluate(() => ({
  ls: JSON.parse(localStorage.getItem('mgd.goals') || 'null'),
  state: window.__mgd.goals(),
  bars: document.querySelectorAll('#goalBars .goal-bar').length,
  text: (document.querySelector('#goalBars') || {}).textContent || ''
}));
check('nhập ô -> lưu mgd.goals (kcal 1500, money 120000)', saved2.ls && saved2.ls.kcal === 1500 && saved2.ls.money === 120000, JSON.stringify(saved2.ls));
check('có 2 thanh tiến độ "đã dùng / mục tiêu"', saved2.bars === 2 && /1\.5k|1500/.test(saved2.text), saved2.text.replace(/\s+/g, ' ').slice(0, 80));

// đổi công tắc -> state + localStorage
await page.click('.goal-sw .track-ui');
await page.waitForTimeout(300);
const offUi = await page.evaluate(() => ({ state: window.__mgd.goals().priority, ls: JSON.parse(localStorage.getItem('mgd.goals')).priority, checked: document.querySelector('#fGoalPriority').checked }));
check('tắt công tắc ưu tiên -> mgd.goals.priority = false', offUi.state === false && offUi.ls === false && offUi.checked === false, JSON.stringify(offUi.ls));
await page.click('.goal-sw .track-ui');
await page.waitForTimeout(200);

// chip bối cảnh phải nói rõ đang ưu tiên mục tiêu
const chip = await page.evaluate(() => {
  window.__mgd.setGoals(Object.assign({}, window.__mgd.goals(), { priority: true }));
  const c = document.querySelector('#ctxChip');
  return { hidden: c.hidden, text: c.textContent.replace(/\s+/g, ' ').trim() };
});
check('chip bối cảnh ghi lý do khi đang áp mục tiêu', !chip.hidden && /ưu tiên vừa mục tiêu/.test(chip.text), chip.text.slice(0, 120));

// F5 vẫn nhớ mục tiêu
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
await page.click('#btnToday');
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({
  kcal: document.querySelector('#goalKcal').value, money: document.querySelector('#goalMoney').value,
  state: window.__mgd.goals(), bars: document.querySelectorAll('#goalBars .goal-bar').length
}));
check('F5 vẫn nhớ mục tiêu + vẽ lại thanh tiến độ', after.kcal === '1500' && after.money === '120000' && after.state.kcal === 1500 && after.bars === 2,
  after.kcal + ' kcal · ' + after.money + '₫ · ' + after.bars + ' thanh');
check('không lỗi JS', errs.length === 0, errs.slice(0, 3).join(' | '));

await ctx.close(); await browser.close();
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
