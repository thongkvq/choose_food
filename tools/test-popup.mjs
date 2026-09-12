import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const ROOT = '/var/lib/dsh/Choose foody';
const NEW_FIELDS = ['rating','stars','review','calories','protein','proteinLabel','priceRange','fullness','bestFor','bestTime','origin','tip','imageVia','imageSource'];

const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });

// ---------- PHẦN 1: hành vi chạm ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const spinning = () => page.evaluate(() => document.querySelector('#btnSpinSingle').disabled);

  // 1a. chạm vào khung quay
  const vp = await page.locator('#rouletteViewport').boundingBox();
  await page.touchscreen.tap(vp.x + vp.width / 2, vp.y + vp.height / 2);
  await page.waitForTimeout(900);
  console.log('1a. CHẠM vào khung quay  → có quay không:', await spinning(), '(phải là false)');
  await page.touchscreen.tap(vp.x + 30, vp.y + vp.height - 20);
  await page.waitForTimeout(900);
  console.log('1b. CHẠM mép khung quay  → có quay không:', await spinning(), '(phải là false)');
  // 1c. chạm vào thẻ món
  const card = await page.locator('#rouletteTrack .rcard').first().boundingBox();
  await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
  await page.waitForTimeout(900);
  console.log('1c. CHẠM vào thẻ món    → có quay không:', await spinning(), '(phải là false)');

  // 2. bấm nút QUAY 1 MÓN
  const btn = await page.locator('#btnSpinSingle').boundingBox();
  await page.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await page.waitForTimeout(900);
  console.log('2a. BẤM nút QUAY 1 MÓN  → có quay không:', await spinning(), '(phải là true)');
  await page.waitForTimeout(7400);
  const pop = await page.evaluate(() => {
    const dlg = document.querySelector('.win-dialog');
    const r = dlg.getBoundingClientRect();
    return { open: !document.querySelector('#modalBackdrop').hidden, name: dlg.querySelector('.win-name')?.textContent.trim(),
      score: dlg.querySelector('.score-num')?.textContent, rows: dlg.querySelectorAll('.info-row').length,
      w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), vh: innerHeight };
  });
  console.log('2b. POPUP hiện:', pop.open, '|', pop.name, '| điểm', pop.score, '|', pop.rows, 'dòng | khung', pop.w + 'x' + pop.h, '@' + pop.top, '(màn ' + pop.vh + ')');
  await page.click('#winDialog [data-act="close"]');
  await page.waitForTimeout(400);

  // 3. bấm x10
  const mb = await page.locator('#btnSpinMulti').boundingBox();
  await page.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2);
  await page.waitForTimeout(900);
  console.log('3a. BẤM nút x10          → có quay không:', await spinning(), '(phải là true)');
  await page.waitForTimeout(7600);
  console.log('3b. POPUP 10 món hiện:', await page.evaluate(() => !document.querySelector('#multiBackdrop').hidden), '| số thẻ:', await page.evaluate(() => document.querySelectorAll('#multiDialog .mcell').length));
  console.log('lỗi JS:', errs.length ? errs.join(' | ') : 'không');
  await ctx.close();
}

// ---------- PHẦN 2: dữ liệu CŨ (cache bản cũ, thiếu hết trường mới) ----------
{
  const raw = JSON.parse(await readFile(ROOT + '/data/dishes.json', 'utf8'));
  for (const d of raw.dishes) for (const k of NEW_FIELDS) delete d[k];
  const old = JSON.stringify(raw);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/data/dishes.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: old }));
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('#btnSpinSingle');
  await page.waitForTimeout(7600);
  const p2 = await page.evaluate(() => {
    const dlg = document.querySelector('.win-dialog');
    return { open: !document.querySelector('#modalBackdrop').hidden, name: dlg.querySelector('.win-name')?.textContent.trim(),
      rows: dlg.querySelectorAll('.info-row').length, score: dlg.querySelector('.score-num')?.textContent || '(không có - đúng vì data cũ)' };
  });
  console.log('4. DỮ LIỆU CŨ (không có điểm/calo): popup vẫn hiện:', p2.open, '|', p2.name, '|', p2.rows, 'dòng | điểm:', p2.score);
  console.log('   lỗi JS:', errs.length ? errs.join(' | ') : 'không');
  await ctx.close();
}
await browser.close();
