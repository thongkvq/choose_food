// tools/test/test-search.mjs — TÌM KIẾM MÓN (v27)
// Unit (lib/search-core.js, không cần DOM): fold bỏ dấu + đ→d, "pho"→Phở, "phở" xếp trên "phô…",
// "banh mi", "bun bo hue", tìm theo kw "banh plan", theo vùng/ẩm thực/cách chế biến, gợi ý gõ sai, rác/rỗng.
// UI: nút 🔍 header, gõ ra kết quả ngay, bấm dòng mở đúng popup, tìm toàn bộ (pizza dù "chỉ món Việt" bật,
// có nhãn "ngoài bộ lọc"), "Quay trong N kết quả" chỉ ra món trong kết quả, tìm gần đây còn sau reload,
// ô #fSearch lọc không dấu, 375/390/458px + desktop không tràn ngang / tap ≥44px.
// Dùng: node tools/test/test-search.mjs [baseUrl]
import fs from 'node:fs';
import { REGION_LABEL, STYLE_LABEL, VUNG_LABEL, buildIndex, fold, searchDishes, suggestDishes } from '../../lib/search-core.js';
import { launchChromium } from '../lib/chromium.mjs';

const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const ok = [], bad = [];
const check = (name, cond, extra) => {
  (cond ? ok : bad).push(name);
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? ' — ' + extra : ''));
};
const foldOK = (s) => fold(s);

/* ============================== PHẦN UNIT ============================== */
console.log('\n== Unit: lib/search-core.js ==');
const data = JSON.parse(fs.readFileSync(new URL('../../data/dishes-lite.json', import.meta.url), 'utf8'));
const IDX = buildIndex(data.dishes);
const names = (q, n) => searchDishes(IDX, q, { limit: n || 3 }).map((r) => r.dish.name);

check('fold: bỏ dấu tiếng Việt, đ→d, gộp khoảng trắng',
  foldOK('Đồ nướng') === 'do nuong' && foldOK('  Phở   Bò ') === 'pho bo' && foldOK('BÁNH MÌ') === 'banh mi',
  JSON.stringify([foldOK('Đồ nướng'), foldOK('  Phở   Bò '), foldOK('BÁNH MÌ')]));

const pho = searchDishes(IDX, 'pho', { limit: 5 });
check('"pho" (không dấu) -> Phở đứng đầu', pho.length > 0 && /^phở/i.test(pho[0].dish.name), pho.slice(0, 3).map((r) => r.dish.name).join(' | '));

const phoMarked = searchDishes(IDX, 'phở', { limit: 10 });
const phoDish = phoMarked.findIndex((r) => /^phở/i.test(r.dish.name));
const phoMai = phoMarked.findIndex((r) => /^phô mai/i.test(r.dish.name));
check('"phở" xếp Phở TRÊN món "phô…" (cộng điểm đúng dấu)',
  phoDish === 0 && (phoMai < 0 || phoDish < phoMai), 'Phở #' + phoDish + ' · Phô mai #' + phoMai);

const banhMi = searchDishes(IDX, 'banh mi', { limit: 3 });
check('"banh mi" -> Bánh mì', banhMi.length > 0 && /bánh mì/i.test(banhMi[0].dish.name), banhMi.map((r) => r.dish.name).join(' | '));

const bunBo = searchDishes(IDX, 'bun bo hue', { limit: 3 });
check('"bun bo hue" -> Bún bò Huế', bunBo.length > 0 && bunBo[0].dish.name === 'Bún bò Huế', names('bun bo hue').join(' | '));

const multi = searchDishes(IDX, 'bun bo', { limit: 10 });
const multiOK = multi.length > 0 && multi.every((r) => {
  const words = fold([r.dish.name, (r.dish.kw || []).join(' '), (r.dish.tags || []).join(' '),
    r.dish.descr, r.dish.origin || '', VUNG_LABEL[r.dish.vung] || '', REGION_LABEL[r.dish.region] || '',
    STYLE_LABEL[r.dish.style] || ''].join(' ')).split(' ').filter(Boolean);
  return ['bun', 'bo'].every((tok) => words.some((w) => w.startsWith(tok)));
});
check('query nhiều từ: món phải khớp ĐỦ các từ', multiOK, multi.slice(0, 3).map((r) => r.dish.name).join(' | '));

const plan = searchDishes(IDX, 'banh plan', { limit: 3 });
check('tìm theo kw "banh plan" -> Bánh flan (why ghi tên khác)',
  plan.length > 0 && plan[0].dish.id === 'banh-flan' && /Bánh plan/.test(plan[0].why),
  plan[0] ? plan[0].dish.name + ' [' + plan[0].why + ']' : 'không có');

const jp = searchDishes(IDX, 'nhat', { limit: 5 });
check('tìm theo ẩm thực/vùng: "nhat" ra món Nhật (≥2 trong top 5 vùng jp)',
  jp.filter((r) => r.dish.region === 'jp').length >= 2, jp.map((r) => r.dish.name + '/' + r.dish.region).join(' | '));

const lau = searchDishes(IDX, 'lau', { limit: 3 });
check('tìm theo cách chế biến: "lau" -> món lẩu',
  lau.length > 0 && lau.every((r) => /lẩu/i.test(r.dish.name) || r.dish.style === 'lau'), lau.map((r) => r.dish.name).join(' | '));

const chay = searchDishes(IDX, 'chay', { limit: 5 });
check('tìm theo tag: "chay" ra món chay/món có tag chay',
  chay.some((r) => /chay/i.test(r.dish.name) || (r.dish.tags || []).some((t) => /chay/i.test(t))),
  chay.map((r) => r.dish.name).join(' | '));

const suggPhoo = suggestDishes(IDX, 'phoo', { limit: 3 }).map((d) => d.name);
check('gõ sai "phoo" -> gợi ý có Phở', suggPhoo.some((n) => /^phở/i.test(n)), suggPhoo.join(' | '));
const suggHue = suggestDishes(IDX, 'bun bo hu', { limit: 3 }).map((d) => d.name);
check('gõ thiếu chữ "bun bo hu" -> gợi ý có Bún bò Huế', suggHue.some((n) => /Bún bò Huế/.test(n)), suggHue.join(' | '));

let junkOK = true, junkErr = '';
try {
  const cases = [null, undefined, '', '   ', '!!!@@@', '🙂🙂', 0, 'a'.repeat(400)];
  for (const q of cases) {
    const r = searchDishes(IDX, q, { limit: 5 });
    if (!Array.isArray(r)) junkOK = false;
    const s = suggestDishes(IDX, q, { limit: 3 });
    if (!Array.isArray(s)) junkOK = false;
  }
} catch (e) { junkOK = false; junkErr = e.message; }
check('query rỗng / rác / quá dài không lỗi, trả []', junkOK, junkErr);

const all = searchDishes(IDX, 'a', { limit: 30 });
check('tối đa 30 dòng kết quả', all.length <= 30, all.length + ' dòng');

console.log('\n== Ví dụ query thật (top 3) ==');
for (const q of ['pho', 'banh mi', 'lau', 'tom', 'nhat']) {
  console.log('  ' + q + ': ' + names(q).join(' | '));
}

/* =============================== PHẦN UI =============================== */
console.log('\n== UI: nút 🔍 / lớp tìm kiếm ==');
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
// test không cần mạng: chặn dịch vụ ngoài cho nhanh và ổn định
await page.route(/open-meteo|ipapi\.co|photon\.komoot\.io|overpass/, (r) => r.abort());
const boot = () => page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

await page.goto(BASE + '/', { waitUntil: 'load' });
await boot();
await page.evaluate(() => localStorage.removeItem('mgd.searchHist'));

const btn = await page.evaluate(() => {
  const b = document.querySelector('#btnSearch');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), label: b.getAttribute('aria-label') };
});
check('nút 🔍 ở header, tap ≥44px, có aria-label', !!btn && btn.w >= 44 && btn.h >= 44 && !!btn.label, JSON.stringify(btn));

await page.click('#btnSearch');
await page.waitForTimeout(250);
const opened = await page.evaluate(() => ({
  open: !document.querySelector('#searchBackdrop').hidden,
  focus: document.activeElement && document.activeElement.id,
  chips: document.querySelectorAll('#searchBody .schip').length,
  lock: document.body.style.overflow
}));
check('bấm 🔍 mở lớp tìm, con trỏ tự vào ô nhập, có hàng chip gợi ý',
  opened.open && opened.focus === 'searchInput' && opened.chips >= 8 && opened.lock === 'hidden', JSON.stringify(opened));

await page.fill('#searchInput', 'pho');
await page.waitForTimeout(320);
const res = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#searchBody .srow')];
  return {
    n: rows.length,
    first: rows[0] ? rows[0].querySelector('.s-name').textContent.trim() : '',
    firstId: rows[0] ? rows[0].dataset.id : '',
    hl: rows[0] ? !!rows[0].querySelector('.s-name .hl') : false,
    why: rows[0] ? (rows[0].querySelector('.s-why') || {}).textContent || '' : '',
    spin: !!document.querySelector('#searchBody [data-act="spin"]')
  };
});
check('gõ "pho" ra kết quả ngay, Phở đứng đầu, phần khớp được tô đậm',
  res.n > 0 && /Phở/i.test(res.first) && res.hl === true, res.n + ' dòng · ' + res.first);
check('có nút "Quay trong N kết quả" khi ≥2 kết quả', res.spin === true);

// bấm 1 dòng -> mở thẳng popup đúng món
await page.click('#searchBody .srow[data-id="' + res.firstId + '"]');
await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden, null, { timeout: 8000 });
await page.waitForTimeout(300);
const win = await page.evaluate(() => ({
  name: (document.querySelector('#winDialog .win-name') || {}).textContent || '',
  searchClosed: document.querySelector('#searchBackdrop').hidden,
  winner: window.__mgd.state.lastWinner ? window.__mgd.state.lastWinner.id : ''
}));
check('bấm một dòng -> mở đúng popup món (không quay), lớp tìm đóng lại',
  win.winner === res.firstId && win.searchClosed === true, win.winner + ' · ' + win.name.trim());
await page.evaluate(() => window.__mgd.closeModals());
await page.waitForTimeout(200);

// tìm xuyên bộ lọc: "pizza" khi "chỉ món Việt" đang bật
await page.click('#btnSearch');
await page.fill('#searchInput', 'pizza');
await page.waitForTimeout(320);
const pizza = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#searchBody .srow')];
  const first = rows[0];
  return {
    n: rows.length,
    id: first ? first.dataset.id : '',
    name: first ? first.querySelector('.s-name').textContent.trim() : '',
    off: first ? !!(first.querySelector('.s-off') && /ngoài bộ lọc/.test(first.textContent)) : false,
    vnOnly: window.__mgd.state.vnOnly
  };
});
check('"pizza" vẫn ra dù đang bật "chỉ món Việt" + có nhãn "ngoài bộ lọc"',
  pizza.n > 0 && pizza.id === 'pizza' && pizza.off === true && pizza.vnOnly === true, JSON.stringify(pizza));
await page.click('#searchBody .srow[data-id="pizza"]');
await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden, null, { timeout: 8000 });
const pizzaWin = await page.evaluate(() => ({
  winner: window.__mgd.state.lastWinner.id,
  vnOnly: window.__mgd.state.vnOnly
}));
check('mở popup Pizza, KHÔNG đổi bộ lọc "chỉ món Việt"', pizzaWin.winner === 'pizza' && pizzaWin.vnOnly === true);
await page.evaluate(() => window.__mgd.closeModals());
await page.waitForTimeout(200);

// "Quay trong N kết quả": chỉ quay món trong kết quả, xong thì pool trả lại
const poolBefore = await page.evaluate(() => window.__mgd.pool().length);
await page.click('#btnSearch');
await page.fill('#searchInput', 'lau');
await page.waitForTimeout(320);
const spinIds = await page.evaluate(() => [...document.querySelectorAll('#searchBody .srow')].map((b) => b.dataset.id));
check('kết quả "lau" đủ để quay (≥2)', spinIds.length >= 2, spinIds.length + ' món');
await page.click('#searchBody [data-act="spin"]');
await page.waitForTimeout(400);
const during = await page.evaluate(() => ({
  closed: document.querySelector('#searchBackdrop').hidden,
  only: window.__mgd.searchOnly() ? window.__mgd.searchOnly().size : 0,
  pool: window.__mgd.pool().length
}));
check('bấm "Quay trong N kết quả" -> đóng lớp tìm, pool tạm = đúng kết quả',
  during.closed === true && during.only === spinIds.length && during.pool === spinIds.length, JSON.stringify(during));
await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden, null, { timeout: 20000 });
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  winner: window.__mgd.state.lastWinner.id,
  only: window.__mgd.searchOnly() ? window.__mgd.searchOnly().size : 0,
  pool: window.__mgd.pool().length
}));
check('món trúng nằm TRONG kết quả tìm kiếm', spinIds.includes(after.winner), after.winner);
check('quay xong -> bỏ phạm vi tạm, pool trở lại như trước', after.only === 0 && after.pool === poolBefore,
  after.pool + '/' + poolBefore);
await page.evaluate(() => window.__mgd.closeModals());
await page.waitForTimeout(200);

// tìm gần đây: lưu khi mở kết quả / quay, còn sau reload
const histLS = await page.evaluate(() => JSON.parse(localStorage.getItem('mgd.searchHist') || '[]'));
check('lưu từ khoá gần đây vào mgd.searchHist (≤8)', Array.isArray(histLS) && histLS.length > 0 && histLS.length <= 8, JSON.stringify(histLS));
await page.reload({ waitUntil: 'load' });
await boot();
await page.click('#btnSearch');
await page.waitForTimeout(250);
const histUI = await page.evaluate(() => ({
  n: document.querySelectorAll('#searchBody .shist').length,
  txt: (document.querySelector('#searchBody') || {}).textContent || ''
}));
check('sau reload, lớp tìm vẫn hiện "Tìm gần đây"',
  histUI.n > 0 && /Tìm gần đây/.test(histUI.txt), histUI.n + ' từ khoá');

// xoá từ khoá
await page.click('#searchBody [data-act="hist-clear"]');
await page.waitForTimeout(200);
const cleared = await page.evaluate(() => ({
  ls: JSON.parse(localStorage.getItem('mgd.searchHist') || '[]'),
  n: document.querySelectorAll('#searchBody .shist').length
}));
check('nút xoá -> sạch tìm gần đây (localStorage + UI)', cleared.ls.length === 0 && cleared.n === 0, JSON.stringify(cleared));

// tìm theo nguyên liệu: chỉ khi phần nặng đã tải
const ing = await page.evaluate(async () => {
  const M = window.__mgd;
  await M.ensureDetail(M.ALL()[0]);
  for (const d of M.ALL()) {
    if (!d.facts || !Array.isArray(d.facts.ingredients)) continue;
    for (const raw of d.facts.ingredients) {
      const w = String(raw || '').trim();
      if (w.length < 5) continue;
      const r = M.searchDishes(w, { limit: 30 });
      const hit = r.find((x) => x.dish.id === d.id);
      if (hit) return { dish: d.name, word: w, why: hit.why };
    }
  }
  return null;
});
check('tìm theo facts.ingredients sau khi mảnh chi tiết đã tải (why: nguyên liệu)',
  !!ing && /nguyên liệu/i.test(ing.why), ing ? ing.dish + ' · ' + ing.word + ' · ' + ing.why : 'không dựng được kịch bản');

// ô #fSearch trong sheet Lọc: lọc pool không dấu
const fsearch = await page.evaluate(async () => {
  const inp = document.querySelector('#fSearch');
  window.__mgd.state.q = '';
  inp.value = 'pho';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const p = window.__mgd.pool();
  const folded = p.map((d) => window.__mgd.fold([d.name, d.descr, (d.tags || []).join(' '), (d.kw || []).join(' '), d.origin || ''].join(' ')));
  return { n: p.length, allMatch: folded.every((f) => f.includes('pho')), q: window.__mgd.state.q };
});
check('#fSearch lọc pool KHÔNG DẤU ("pho" ra món Phở) và tìm cả trong kw',
  fsearch.n > 0 && fsearch.allMatch === true, fsearch.n + ' món · q=' + fsearch.q);
await page.evaluate(() => {
  const inp = document.querySelector('#fSearch');
  inp.value = ''; window.__mgd.state.q = ''; window.__mgd.renderSearch('');
  window.__mgd.syncPool();
});

// Esc đóng lớp tìm (desktop) — kiểm ở viewport 1280 bên dưới; ở mobile kiểm nút ✕
await page.click('#searchBody [data-act="hist-clear"]').catch(() => {});
await page.click('#btnCloseSearch').catch(() => {});
await page.waitForTimeout(150);
check('nút ✕ đóng lớp tìm, mở khoá cuộn trang',
  await page.evaluate(() => document.querySelector('#searchBackdrop').hidden && document.body.style.overflow === ''));

/* -------- 375 / 390 / 458px: không tràn ngang, tap ≥44px -------- */
for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 844 }, { w: 458, h: 1017 }]) {
  const c = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const e2 = []; p.on('pageerror', (e) => e2.push(e.message));
  await p.route(/open-meteo|ipapi\.co|photon\.komoot\.io|overpass/, (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
  await p.click('#btnSearch');
  await p.fill('#searchInput', 'pho');
  await p.waitForTimeout(320);
  const m = await p.evaluate(() => {
    const dlg = document.querySelector('#searchDialog');
    const small = [...dlg.querySelectorAll('button')]
      .filter((b) => { const r = b.getBoundingClientRect(); return r.height > 0 && r.width > 0 && r.height < 44; })
      .map((b) => (b.className || b.id) + '=' + Math.round(b.getBoundingClientRect().height));
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      scrollW: document.documentElement.scrollWidth,
      vw: innerWidth,
      dialogW: Math.round(dlg.getBoundingClientRect().width),
      small: [...new Set(small)],
      rows: document.querySelectorAll('#searchBody .srow').length
    };
  });
  const err2 = e2.length;
  check(vp.w + 'px: lớp tìm không tràn ngang, tap ≥44px, có kết quả',
    m.overflow === false && m.small.length === 0 && m.rows > 0 && err2 === 0,
    'rộng ' + m.scrollW + '/' + m.vw + ' · hộp ' + m.dialogW + 'px · tap nhỏ: ' + (m.small.join(',') || 'không'));
  await c.close();
}

/* -------- desktop: phím "/" mở, Esc đóng, hộp nổi -------- */
const dc = await browser.newContext({ viewport: { width: 1280, height: 820 } });
const dp = await dc.newPage();
const e3 = []; dp.on('pageerror', (e) => e3.push(e.message));
await dp.route(/open-meteo|ipapi\.co|photon\.komoot\.io|overpass/, (r) => r.abort());
await dp.goto(BASE + '/', { waitUntil: 'load' });
await dp.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
await dp.keyboard.press('/');
await dp.waitForTimeout(300);
const desk = await dp.evaluate(() => {
  const dlg = document.querySelector('#searchDialog'), r = dlg.getBoundingClientRect();
  return {
    open: !document.querySelector('#searchBackdrop').hidden,
    focus: document.activeElement && document.activeElement.id,
    w: Math.round(r.width), h: Math.round(r.height), vh: innerHeight,
    left: Math.round(r.left), vw: innerWidth
  };
});
check('desktop: phím "/" mở lớp tìm, con trỏ vào ô, hộp NỔI (không full màn)',
  desk.open && desk.focus === 'searchInput' && desk.w <= 660 && desk.h < desk.vh * .85 && desk.left > 0,
  JSON.stringify(desk));
await dp.fill('#searchInput', 'banh mi');
await dp.waitForTimeout(350);
const deskRows = await dp.evaluate(() => document.querySelectorAll('#searchBody .srow').length);
check('desktop: gõ "banh mi" ra kết quả', deskRows > 0, deskRows + ' dòng');
await dp.keyboard.press('Escape');
await dp.waitForTimeout(250);
check('desktop: Esc đóng lớp tìm, mở khoá cuộn trang',
  await dp.evaluate(() => document.querySelector('#searchBackdrop').hidden && document.body.style.overflow === ''));
await dc.close();

check('không lỗi JS', errs.length === 0 && e3.length === 0, errs.concat(e3).slice(0, 3).join(' | '));

await ctx.close(); await browser.close();
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
