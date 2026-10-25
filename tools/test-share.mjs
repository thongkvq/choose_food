// tools/test-share.mjs — KIỂM TRA link chia sẻ món: #mon=<id>.
// Kiểm: mở link là ra đúng popup món · đóng popup thì hash biến mất · nút "🔗 Chia sẻ" dùng
//       navigator.share (có thì share, không có thì copy link + toast) · đổi hash thì đổi popup ·
//       nút xuất ảnh vẫn còn · tap target ≥44px.
// Dùng: node tools/test-share.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const lite = JSON.parse(await readFile(ROOT + 'data/dishes-lite.json', 'utf8'));
const d1 = lite.dishes.find((d) => d.region === 'vn') || lite.dishes[0];
const d2 = lite.dishes.find((d) => d.id !== d1.id && d.region === 'vn') || lite.dishes[1];

const ok = [], bad = [];
const check = (name, cond, extra) => {
  (cond ? ok : bad).push(name);
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? ' — ' + extra : ''));
};

const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));

/* ---------- A. mở link #mon=<id> là ra popup đúng món ---------- */
await page.goto(BASE + '/#mon=' + encodeURIComponent(d1.id), { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden, null, { timeout: 15000 });
const a = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    name: (q('.win-name') || {}).textContent || '', descr: ((q('.win-descr') || {}).textContent || '').trim(),
    hash: location.hash, rows: document.querySelectorAll('.info-row').length,
    shareBtn: !!(q('[data-act="sharelink"]')), imgBtn: !!(q('[data-act="share"]')),
    lastWinner: window.__mgd.state.lastWinner ? window.__mgd.state.lastWinner.id : null
  };
});
console.log('=== LINK CHIA SẺ MÓN ===');
check('mở /#mon=' + d1.id + ' -> popup đúng món "' + d1.name + '"', a.name.includes(d1.name) && a.lastWinner === d1.id, a.name.trim());
check('popup có mô tả + bảng thông tin ngay (phần lite)', !!a.descr && a.rows >= 4, a.rows + ' dòng');
check('hash vẫn giữ #mon=<id> khi đang mở', a.hash === '#mon=' + encodeURIComponent(d1.id), a.hash);
check('popup có cả nút 🔗 Chia sẻ và 📤 Chia sẻ ảnh', a.shareBtn && a.imgBtn);

/* ---------- B. đóng popup -> hash bị xoá ---------- */
await page.click('#winDialog .win-close');
await page.waitForTimeout(250);
const b = await page.evaluate(() => ({ hidden: document.querySelector('#modalBackdrop').hidden, hash: location.hash, url: location.href }));
check('đóng popup -> hash mất, URL sạch', b.hidden && b.hash === '' && !/#mon=/.test(b.url), b.url);

/* ---------- C. đổi hash (hashchange) -> mở popup món khác ---------- */
await page.evaluate((id) => { location.hash = '#mon=' + encodeURIComponent(id); }, d2.id);
await page.waitForFunction((nm) => {
  const el = document.querySelector('.win-name');
  return !document.querySelector('#modalBackdrop').hidden && el && el.textContent.includes(nm);
}, d2.name, { timeout: 15000 }).catch(() => {});
const c = await page.evaluate(() => ({ name: (document.querySelector('.win-name') || {}).textContent || '', open: !document.querySelector('#modalBackdrop').hidden }));
check('đổi hash sang món khác -> popup đổi theo', c.open && c.name.includes(d2.name), c.name.trim());

/* ---------- D. nút 🔗 Chia sẻ: có navigator.share thì share, không thì copy ---------- */
const tap = await page.evaluate(() => {
  const el = document.querySelector('[data-act="sharelink"]');
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
});
check('nút 🔗 Chia sẻ tap target ≥44px', tap.h >= 44 && tap.w >= 44, tap.w + '×' + tap.h);

await page.evaluate(() => {
  window.__shared = null;
  Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: (o) => { window.__shared = o; return Promise.resolve(); } });
});
await page.click('[data-act="sharelink"]');
await page.waitForTimeout(250);
const d = await page.evaluate((id) => ({
  shared: window.__shared,
  expect: location.origin + location.pathname + location.search + '#mon=' + encodeURIComponent(id)
}), d2.id);
check('navigator.share được gọi kèm url #mon=<id>', d.shared && d.shared.url === d.expect, d.shared ? d.shared.url : '(không gọi)');
check('share kèm title + text có tên món', !!d.shared && d.shared.title === 'Món Gì Đây?' && d.shared.text.includes(d2.name), d.shared ? d.shared.text.slice(0, 50) : '');

// không có navigator.share -> copy link + toast
await page.evaluate(() => {
  try { delete navigator.share; } catch (e) { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); }
  window.__copied = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }
  });
});
await page.click('[data-act="sharelink"]');
await page.waitForTimeout(350);
const e = await page.evaluate((id) => ({
  copied: window.__copied,
  toast: document.querySelector('#toastNotification').textContent,
  toastHidden: document.querySelector('#toastNotification').hidden,
  id: id
}), d2.id);
check('không có navigator.share -> copy link vào clipboard', e.copied.length === 1 && /#mon=/.test(e.copied[0]), e.copied[0] || '(không copy)');
check('copy xong có toast báo', !e.toastHidden && /copy link/i.test(e.toast), e.toast.slice(0, 60));
check('link copy vẫn dùng id đã encode', /#mon=[A-Za-z0-9%._~-]+$/.test(e.copied[0] || ''), (e.copied[0] || '').split('#')[1] || '');

/* ---------- E. link tới món không tồn tại -> không mở popup, có báo ---------- */
await page.evaluate(() => window.__mgd.closeModals());
await page.goto(BASE + '/#mon=khong-co-mon-nay', { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });
await page.waitForTimeout(500);
const f = await page.evaluate(() => ({ open: !document.querySelector('#modalBackdrop').hidden, toast: document.querySelector('#toastNotification').textContent }));
check('link món không tồn tại -> không mở popup rỗng, có thông báo', !f.open && /không còn món này/.test(f.toast), f.toast.slice(0, 50));
check('không lỗi JS toàn luồng chia sẻ', errs.length === 0, errs.join(' | '));

await ctx.close(); await browser.close();
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
