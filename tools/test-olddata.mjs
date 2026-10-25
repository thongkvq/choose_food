// tools/test-olddata.mjs — dữ liệu CACHE CŨ vẫn phải hiện popup bình thường.
// Bản mới: app tải `data/dishes-lite.json` (phần nhẹ) + `data/dishes-detail-*.json` (tải khi mở popup).
// Kịch bản cũ: lite cache thiếu hết trường mới (điểm, calo, giá, nguồn ảnh…) và KHÔNG có mảnh chi tiết.
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));   // project hiện tại, không hard-code đường dẫn cũ
const NEW_FIELDS = ['rating','stars','calories','protein','proteinLabel','priceRange','fullness','bestFor','bestTime','origin','imageVia','imageSource'];
const HEAVY_FIELDS = ['review','intro','introSource','wikiUrl','wikiTitle','introEn','facts','detail','tip'];
const raw = JSON.parse(await readFile(ROOT + '/data/dishes-lite.json', 'utf8'));
for (const d of raw.dishes) for (const k of NEW_FIELDS.concat(HEAVY_FIELDS)) delete d[k];
const old = JSON.stringify(raw);

const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/data/dishes-lite.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: old }));
await page.route('**/data/dishes-detail-*.json', r => r.abort());   // cache cũ không có mảnh chi tiết
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(1300);
await page.click('#btnSpinSingle');
await page.waitForTimeout(7700);
const p = await page.evaluate(() => {
  const dlg = document.querySelector('.win-dialog');
  return {
    open: !document.querySelector('#modalBackdrop').hidden,
    name: dlg.querySelector('.win-name')?.textContent.trim(),
    rows: [...dlg.querySelectorAll('.info-row')].map(r => r.querySelector('.k').textContent),
    score: dlg.querySelector('.score-num')?.textContent || '(không có — đúng, vì dữ liệu cũ không có điểm)',
    hasActions: !!dlg.querySelector('[data-act="lock"]'),
    share: !!dlg.querySelector('[data-act="sharelink"]'),
    heavyNote: ((dlg.querySelector('.heavy-loading') || {}).textContent || '(không có khung chờ)').trim(),
    heavySlot: ((dlg.querySelector('#heavySlot') || {}).innerHTML || '(không có #heavySlot)').slice(0, 90),
    failedChunks: [...(window.__mgd ? window.__mgd.DETAIL.failed : [])].join(','),
    loadedChunks: [...(window.__mgd ? window.__mgd.DETAIL.loaded : [])].join(',')
  };
});
console.log('DỮ LIỆU CŨ (lite thiếu trường mới + không có mảnh chi tiết) → popup hiện:', p.open, '| món:', p.name);
console.log('   điểm:', p.score);
console.log('   các dòng thông tin:', p.rows.join(', '));
console.log('   có nút chốt:', p.hasActions, '| nút chia sẻ:', p.share);
console.log('   phần chi tiết:', p.heavyNote.slice(0, 70));
console.log('   heavySlot:', p.heavySlot, '| mảnh lỗi:', p.failedChunks, '| mảnh đã tải:', p.loadedChunks);
console.log('   lỗi JS:', errs.length ? errs.join(' | ') : 'không');
await ctx.close(); await browser.close();
console.log(p.open && p.hasActions && errs.length === 0 ? 'KẾT QUẢ: OK' : 'KẾT QUẢ: FAIL');
process.exit(p.open && p.hasActions && errs.length === 0 ? 0 : 1);
