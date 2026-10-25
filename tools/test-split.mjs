// tools/test-split.mjs — KIỂM TRA việc tách dữ liệu (dishes-lite.json + dishes-detail-*.json).
// Kiểm: lần tải đầu KHÔNG tải dishes.json · popup mở ngay bằng dữ liệu lite rồi điền phần chi tiết
//       khi tải xong (có trạng thái đang tải) · lỗi mạng vẫn hiện phần lite · báo cáo dung lượng.
// Dùng: node tools/test-split.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const ok = [], bad = [];
const check = (name, cond, extra) => {
  (cond ? ok : bad).push(name);
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? ' — ' + extra : ''));
};

const lite = JSON.parse(await readFile(ROOT + 'data/dishes-lite.json', 'utf8'));
const dishesJson = await readFile(ROOT + 'data/dishes.json');
const liteText = await readFile(ROOT + 'data/dishes-lite.json', 'utf8');
let detailRaw = 0, detailGz = 0;
for (let k = 0; k < lite.detailChunks; k++) {
  const b = await readFile(ROOT + 'data/dishes-detail-' + k + '.json');
  detailRaw += b.length; detailGz += gzipSync(b).length;
}
const kb = (n) => (n / 1024).toFixed(1) + 'KB';
const srcGz = gzipSync(dishesJson).length, liteGz = gzipSync(Buffer.from(liteText)).length;
const cutRaw = (1 - Buffer.byteLength(liteText) / dishesJson.length) * 100;
const cutGz = (1 - liteGz / srcGz) * 100;
console.log('=== TÁCH DỮ LIỆU: LITE + DETAIL ===');
console.log('Lần tải đầu TRƯỚC: data/dishes.json     ' + kb(dishesJson.length).padStart(8) + ' thô · ' + kb(srcGz).padStart(8) + ' gzip');
console.log('Lần tải đầu SAU  : data/dishes-lite.json' + kb(Buffer.byteLength(liteText)).padStart(8) + ' thô · ' + kb(liteGz).padStart(8) + ' gzip');
console.log('Popup (tải muộn) : ' + lite.detailChunks + ' mảnh chi tiết      ' + kb(detailRaw).padStart(8) + ' thô · ' + kb(detailGz).padStart(8) + ' gzip (' + kb(detailGz / lite.detailChunks) + ' gzip/mảnh)');
console.log('Giảm lần tải đầu : -' + cutRaw.toFixed(1) + '% thô · -' + cutGz.toFixed(1) + '% gzip');
check('lite nhỏ hơn hẳn dishes.json (giảm ≥50% gzip)', cutGz >= 50, '-' + cutGz.toFixed(1) + '%');
check('lite giữ đủ ' + lite.count + ' món', lite.dishes.length === lite.count);

// món để thử: có đủ phần nặng (intro + detail) trong dishes.json
const full = JSON.parse(dishesJson.toString('utf8')).dishes;
const rich = full.find((d) => d.intro && Array.isArray(d.detail) && d.detail.length && d.facts && d.tip && d.review) || full.find((d) => d.intro) || full[0];

const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const newPage = async () => {
  // serviceWorkers: 'block' — test này đo luồng mạng THẬT (route chặn/abort mảnh chi tiết); PWA có test riêng.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
  return { ctx, page: await ctx.newPage() };
};

/* ---------- A. lần tải đầu chỉ lấy lite ---------- */
{
  const { ctx, page } = await newPage();
  const reqs = [], errs = [];
  page.on('request', (r) => reqs.push({ url: r.url(), t: Date.now() }));
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/data/dishes-detail-*.json', () => {});   // giữ mảnh chi tiết ở trạng thái chờ
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const loadedAt = Date.now();
  await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const has = (re) => reqs.filter((r) => re.test(r.url));
  check('lần tải đầu CÓ gọi data/dishes-lite.json', has(/data\/dishes-lite\.json/).length === 1, has(/data\/dishes-lite\.json/).length + ' lần');
  check('lần tải đầu KHÔNG gọi data/dishes.json', has(/data\/dishes\.json/).length === 0);
  const firstDetail = has(/data\/dishes-detail-\d+\.json/)[0];
  check('mảnh chi tiết chỉ tải SAU khi trang nạp xong (prefetch lúc rảnh)', !firstDetail || firstDetail.t >= loadedAt,
    firstDetail ? 'sau load ' + (firstDetail.t - loadedAt) + 'ms' : 'chưa gọi (sẽ gọi khi mở popup)');
  const st = await page.evaluate(() => ({
    n: window.__mgd.ALL().length, chunks: window.__mgd.DETAIL.chunks, size: window.__mgd.DETAIL.chunkSize,
    liteOk: window.__mgd.ALL().every((d) => d.id && d.name && d.descr && d.tier && Array.isArray(d.meals)),
    noHeavy: window.__mgd.ALL().every((d) => d.intro === undefined && d.detail === undefined && d.facts === undefined && d.tip === undefined && d.review === undefined)
  }));
  check('app nạp ' + st.n + ' món từ lite, chia ' + st.chunks + ' mảnh × ~' + st.size, st.n === lite.count && st.chunks === lite.detailChunks && st.liteOk);
  check('object lite KHÔNG chứa trường nặng', st.noHeavy);
  check('không lỗi JS khi nạp lite', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ---------- B. popup: hiện ngay lite, điền chi tiết khi mảnh về ---------- */
{
  const { ctx, page } = await newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  let release; const gate = new Promise((r) => { release = r; });
  let gated = 0;
  await page.route('**/data/dishes-detail-*.json', async (route) => { gated++; await gate; route.continue(); });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
  await page.evaluate((id) => window.__mgd.openWin(window.__mgd.dishById(id)), rich.id);
  await page.waitForTimeout(500);
  const early = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      open: !q('#modalBackdrop').hidden,
      name: (q('.win-name') || {}).textContent || '',
      descr: !!((q('.win-descr') || {}).textContent || '').trim(),
      score: !!q('.score-num'), rows: document.querySelectorAll('.info-row').length,
      loading: !!q('.heavy-loading'), heavy: !!q('#heavySlot .intro-wrap, #heavySlot .detail-toggle')
    };
  });
  check('popup mở NGAY bằng dữ liệu lite (tên + điểm + mô tả + bảng thông tin)', early.open && early.name.includes(rich.name) && early.descr && early.score && early.rows >= 4,
    early.rows + ' dòng thông tin');
  check('đang chờ mảnh chi tiết thì có trạng thái "đang tải"', early.loading && !early.heavy && gated > 0);
  release();
  await page.waitForFunction(() => {
    const hs = document.querySelector('#heavySlot');
    return hs && !document.querySelector('.heavy-loading') && hs.textContent.trim().length > 0;
  }, null, { timeout: 20000 });
  const after = await page.evaluate(() => ({
    heavy: !!document.querySelector('#heavySlot .intro-wrap, #heavySlot .detail-toggle'),
    intro: (document.querySelector('#introBox') || {}).textContent || '',
    tip: !!((document.querySelector('#tipSlot') || {}).textContent || '').trim(),
    review: !!document.querySelector('#heavySlot .review'),
    rows: document.querySelectorAll('.info-row').length,
    loading: !!document.querySelector('.heavy-loading'),
    caret: document.querySelector('#winDialog').scrollTop
  }));
  check('phần chi tiết được ĐIỀN vào popup đang mở (không cần mở lại)', after.heavy && !after.loading && after.intro.length > 40);
  check('review dài + tip + dòng facts cũng về cùng mảnh', after.review && after.tip && after.rows >= 6, after.rows + ' dòng');
  check('không nhảy về đầu thẻ khi điền (scrollTop giữ nguyên)', after.caret === 0);
  check('không lỗi JS ở luồng popup', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ---------- C. mảnh chi tiết lỗi mạng: vẫn hiện phần lite ---------- */
{
  const { ctx, page } = await newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/data/dishes-detail-*.json', (route) => route.abort());
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
  await page.evaluate((id) => window.__mgd.openWin(window.__mgd.dishById(id)), rich.id);
  await page.waitForFunction(() => {
    const el = document.querySelector('.heavy-loading');
    return el && el.classList.contains('err');
  }, null, { timeout: 20000 });
  const st = await page.evaluate(() => ({
    name: (document.querySelector('.win-name') || {}).textContent || '',
    err: (document.querySelector('.heavy-loading.err') || {}).textContent || '',
    rows: document.querySelectorAll('.info-row').length,
    lock: !!document.querySelector('[data-act="lock"]')
  }));
  check('mảnh lỗi: popup vẫn hiện tên + bảng thông tin + nút chốt', st.name.includes(rich.name) && st.rows >= 4 && st.lock);
  check('mảnh lỗi: có dòng báo không tải được phần chi tiết', /Không tải được phần chi tiết/.test(st.err), st.err.slice(0, 60));
  check('mảnh lỗi: không lỗi JS', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await browser.close();
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
