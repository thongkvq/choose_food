// tools/test-vung.mjs — verify bộ lọc VÙNG MIỀN (Bắc/Trung/Nam/Tây Nam Bộ/Tây Nguyên/Cả nước)
import { createRequire } from 'module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
console.log('KIỂM TRA: ' + BASE);

const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/alsa-lib:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/gbm' }
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

// bỏ lọc bữa ăn tự động theo giờ để đo đúng phần vùng miền
const clearMeals = () => page.evaluate(() => {
  const s = window.__mgd;
  s.state.meals.clear(); s.state.vung.clear();
  document.querySelectorAll('#mealChips .chip.on, #vungChips .chip.on').forEach(c => c.classList.remove('on'));
});
const snap = (label) => page.evaluate((label) => {
  const s = window.__mgd, p = s.pool();
  const hist = {};
  p.forEach(d => hist[d.vung || '(thiếu)'] = (hist[d.vung || '(thiếu)'] || 0) + 1);
  return { label, pool: p.length, hist, status: (document.querySelector('#poolStatusText') || {}).textContent };
}, label);

// mở sheet lọc để bấm được chip
await page.click('#btnOpenSheet');
await page.waitForTimeout(600);
const chips = await page.evaluate(() => [...document.querySelectorAll('#vungChips .chip')].map(c => c.dataset.k));
console.log('chips vùng miền:', chips.join(', '));

const total = await page.evaluate(() => window.__mgd.ALL().length);
await clearMeals();
const a = await snap('BỎ LỌC BỮA (chưa chọn vùng)');
console.log('[' + a.label + '] pool=' + a.pool + '/' + total);

const click = async (k) => { await page.click('#vungChips .chip[data-k="' + k + '"]'); await page.waitForTimeout(200); };

await clearMeals(); await click('tay-nam-bo');
const b = await snap('MIỀN TÂY NAM BỘ');
console.log('[' + b.label + '] pool=' + b.pool, JSON.stringify(b.hist), '| status:', b.status);

await clearMeals(); await click('nam');
const c = await snap('MIỀN NAM');
console.log('[' + c.label + '] pool=' + c.pool, JSON.stringify(c.hist));

await clearMeals(); await click('bac');
const d = await snap('MIỀN BẮC');
console.log('[' + d.label + '] pool=' + d.pool, JSON.stringify(d.hist));

await clearMeals(); await click('trung');
const e = await snap('MIỀN TRUNG');
console.log('[' + e.label + '] pool=' + e.pool, JSON.stringify(e.hist));

await clearMeals(); await click('tay-nguyen');
const f = await snap('TÂY NGUYÊN');
console.log('[' + f.label + '] pool=' + f.pool, JSON.stringify(f.hist));

await clearMeals(); await click('vn');
const g = await snap('CẢ NƯỚC');
console.log('[' + g.label + '] pool=' + g.pool, JSON.stringify(g.hist));

// nhiều vùng cùng lúc: Bắc + Trung
await clearMeals(); await click('bac'); await click('trung');
const h = await snap('BẮC + TRUNG');
console.log('[' + h.label + '] pool=' + h.pool, JSON.stringify(h.hist));

// chip "Ngoài Việt Nam" phải tự tắt chế độ chỉ món Việt
await clearMeals(); await click('ngoai');
const i = await snap('NGOÀI VIỆT NAM');
const vnOnlyAfter = await page.evaluate(() => window.__mgd.state.vnOnly);
console.log('[' + i.label + '] pool=' + i.pool, JSON.stringify(i.hist), '| vnOnly đã tắt:', vnOnlyAfter === false);

// preset "Đặc sản miền Tây" (đóng sheet trước vì preset nằm ở trang chính)
await page.click('#btnResetFilters'); await page.waitForTimeout(250);
await page.click('#btnCloseSheet'); await page.waitForTimeout(400);
await page.click('.preset[data-preset="vungTay"]'); await page.waitForTimeout(300);
const k = await snap('PRESET ĐẶC SẢN MIỀN TÂY');
const presetOn = await page.evaluate(() => { const b = document.querySelector('.preset[data-preset="vungTay"]'); return b.classList.contains('on'); });
console.log('[' + k.label + '] pool=' + k.pool, JSON.stringify(k.hist), '| preset sáng:', presetOn);

// popup: có dòng "Vùng miền"
await page.click('#btnOpenSheet'); await page.waitForTimeout(500);
await page.click('#btnResetFilters'); await page.waitForTimeout(250);
await page.click('#btnCloseSheet'); await page.waitForTimeout(400);
await page.evaluate(() => { const s = window.__mgd; s.state.vung.add('tay-nam-bo'); s.state.vung.add('nam'); s.state.vung.add('bac'); s.state.vung.add('trung'); s.state.vung.add('vn'); s.state.vung.add('tay-nguyen'); });
await page.click('#btnSpinSingle');
await page.waitForSelector('#modalBackdrop:not([hidden]) .win-dialog', { timeout: 15000 });
await page.waitForTimeout(500);
const popup = await page.evaluate(() => {
  const dlg = document.querySelector('.win-dialog');
  const rows = [...dlg.querySelectorAll('.info-row')].map(r => r.querySelector('.k').textContent + '=' + r.querySelector('.v').textContent);
  const meta = [...dlg.querySelectorAll('.win-meta .pill')].map(p => p.textContent);
  return { rows, meta, hasVungToggle: !!dlg.querySelector('.info-toggle') };
});
// mở "Xem thêm" để chắc chắn dòng Vùng miền hiện ra
if (popup.hasVungToggle) { await page.click('.win-dialog .info-toggle'); await page.waitForTimeout(200); }
const popup2 = await page.evaluate(() => [...document.querySelectorAll('.win-dialog .info-row')].map(r => r.querySelector('.k').textContent + '=' + r.querySelector('.v').textContent));
console.log('popup rows:', popup2.join(' | '));
console.log('popup meta:', popup.meta.join(' | '));

// ===== FIX "chọn vùng xong không quay được": vùng 0 món do BỮA ĂN TỰ ĐỘNG =====
await page.evaluate(() => { document.querySelectorAll(".win-close").forEach(b => b.click()); });
await page.waitForTimeout(300);
// bữa Sáng do đồng hồ tự chọn + Tây Nguyên (chỉ có 1 món, không bán buổi sáng) => 0 món
await page.evaluate(() => { const s = window.__mgd; s.state.vung.clear(); s.state.meals.clear(); s.state.meals.add("sang"); s.state.mealAuto = true; });
await page.click("#btnOpenSheet"); await page.waitForTimeout(500);
await page.click('#vungChips .chip[data-k="tay-nguyen"]'); await page.waitForTimeout(500);
const rescue = await page.evaluate(() => ({
  pool: window.__mgd.pool().length, meals: [...window.__mgd.state.meals], mealAuto: window.__mgd.state.mealAuto,
  disabled: document.querySelector("#btnSpinSingle").disabled,
  toast: [...document.querySelectorAll(".toast")].map(t => t.textContent).join(" ~ ")
}));
console.log("[CỨU 0 MÓN] pool=" + rescue.pool + " meals=" + JSON.stringify(rescue.meals) + " | nút quay bị khoá: " + rescue.disabled);
console.log("  toast:", rescue.toast.slice(0, 120));
await page.click("#btnCloseSheet"); await page.waitForTimeout(400);
await page.click("#btnSpinSingle");
await page.waitForTimeout(8000);
const rescueSpin = await page.evaluate(() => ({ spinning: window.__mgd.state.spinning, modal: !document.querySelector("#modalBackdrop").hidden, winner: window.__mgd.state.lastWinner && window.__mgd.state.lastWinner.name }));
console.log("[QUAY SAU KHI CỨU]", JSON.stringify(rescueSpin));
await page.evaluate(() => { document.querySelectorAll(".win-close").forEach(b => b.click()); });
await page.waitForTimeout(300);

// ===== người dùng TỰ chọn bữa thì KHÔNG được tự bỏ (chỉ báo + mở sheet) =====
await page.evaluate(() => { const s = window.__mgd; s.state.vung.clear(); s.state.meals.clear(); });
await page.click("#btnOpenSheet"); await page.waitForTimeout(500);
await page.click('#mealChips .chip[data-k="sang"]'); await page.waitForTimeout(200);
await page.click('#vungChips .chip[data-k="tay-nguyen"]'); await page.waitForTimeout(400);
const manual = await page.evaluate(() => ({
  pool: window.__mgd.pool().length, meals: [...window.__mgd.state.meals],
  sheetOpen: document.querySelector("#filterPanel").classList.contains("open"),
  status: document.querySelector("#poolStatusText").textContent
}));
console.log("[BỮA DO NGƯỜI DÙNG CHỌN] pool=" + manual.pool + " meals=" + JSON.stringify(manual.meals) + " | sheet mở: " + manual.sheetOpen + " | " + manual.status);

// ===== chip vùng hiện số món =====
const chipTexts = await page.evaluate(() => [...document.querySelectorAll("#vungChips .chip")].map(c => c.textContent));
console.log("nhãn chip:", chipTexts.join(" | "));
const countsOk = chipTexts.length === 7 && chipTexts.every(t => /·\s*\d+$/.test(t.replace(/\s+/g, " ").trim()));
const zeroDim = await page.evaluate(() => document.querySelectorAll("#vungChips .chip.empty").length);
console.log("  -> có số món trên chip:", countsOk, "| chip 0 món bị mờ:", zeroDim);
await page.click("#btnCloseSheet"); await page.waitForTimeout(300);

await browser.close();

const flat = (o) => Object.keys(o.hist);
const ck = {
  chips: chips.length === 7 && chips.includes('tay-nam-bo') && chips.includes('tay-nguyen'),
  bac: d.pool > 0 && flat(d).every(x => x === 'bac'),
  trung: e.pool > 0 && flat(e).every(x => x === 'trung'),
  tayNB: b.pool > 0 && flat(b).every(x => x === 'tay-nam-bo'),
  tayNguyen: f.pool > 0 && flat(f).every(x => x === 'tay-nguyen'),
  namGomTay: c.pool > 0 && flat(c).every(x => x === 'nam' || x === 'tay-nam-bo') && c.hist['tay-nam-bo'] > 0,
  caNuoc: g.pool > 0 && flat(g).every(x => x === 'vn'),
  nhieuVung: h.pool > 0 && flat(h).every(x => x === 'bac' || x === 'trung'),
  ngoaiTatVnOnly: i.pool > 0 && flat(i).every(x => x === 'ngoai') && vnOnlyAfter === false,
  preset: k.pool > 0 && flat(k).every(x => x === 'tay-nam-bo') && presetOn,
  popupVung: popup2.some(t => t.startsWith('Vùng miền=')),
  cuu0Mon: rescue.pool > 0 && rescue.meals.length === 0 && rescue.mealAuto === false && rescue.disabled === false,
  quaySauKhiCuu: rescueSpin.spinning === false && rescueSpin.modal === true,
  khongTuBoBuaNguoiDung: manual.pool === 0 && manual.meals.length === 1 && manual.sheetOpen === true,
  chipHienSoMon: countsOk && zeroDim > 0,
  khongLoiJs: errs.length === 0
};
console.log('---');
for (const [kk, vv] of Object.entries(ck)) console.log((vv ? 'PASS' : 'FAIL') + '  ' + kk);
const pass = Object.values(ck).every(Boolean);
if (errs.length) console.log('lỗi JS:', errs.join(' | '));
console.log(pass ? 'KẾT QUẢ: PASS' : 'KẾT QUẢ: FAIL');
process.exit(pass ? 0 : 1);
