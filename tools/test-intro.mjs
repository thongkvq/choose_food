import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const browser = await chromium.launch({ executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
for (const vp of [{ w: 390, h: 844 }, { w: 375, h: 667 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const b = await page.locator('#btnSpinSingle').boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(7600);
  const p = await page.evaluate(() => {
    const dlg = document.querySelector('.win-dialog');
    const R = (el) => el ? Math.round(el.getBoundingClientRect().height) : 0;
    const intro = dlg.querySelector('.intro');
    return {
      open: !document.querySelector('#modalBackdrop').hidden,
      name: dlg.querySelector('.win-name')?.textContent.trim(),
      score: dlg.querySelector('.score-num')?.textContent,
      intro: intro ? intro.textContent.slice(0, 110) : '(không có)',
      introH: R(intro), moreBtn: !!dlg.querySelector('[data-act="intro"]'),
      src: dlg.querySelector('.intro-src')?.textContent.trim().slice(0, 70),
      rows: [...dlg.querySelectorAll('.info-row')].map(r => r.querySelector('.k').textContent),
      dlgH: R(dlg), scrollInside: dlg.scrollHeight - dlg.clientHeight, vh: innerHeight
    };
  });
  console.log('\n' + vp.w + 'x' + vp.h + ' | popup mở:', p.open, '|', p.name, '| điểm', p.score);
  console.log('   giới thiệu (' + p.introH + 'px): ' + p.intro);
  console.log('   nút đọc thêm:', p.moreBtn, '| nguồn:', p.src);
  console.log('   ' + p.rows.length + ' dòng:', p.rows.join(', '));
  console.log('   thẻ cao ' + p.dlgH + 'px / màn ' + p.vh + ' | cuộn trong: ' + (p.scrollInside > 2 ? p.scrollInside + 'px' : 'không'));
  // thử nút đọc thêm
  if (p.moreBtn) {
    const before = await page.evaluate(() => document.querySelector('.intro').getBoundingClientRect().height);
    await page.click('#winDialog [data-act="intro"]');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ h: Math.round(document.querySelector('.intro').getBoundingClientRect().height), label: document.querySelector('[data-act="intro"]').textContent.trim() }));
    console.log('   bấm Đọc thêm: ' + before + 'px → ' + after.h + 'px | nút: ' + after.label);
  }
  console.log('   lỗi JS:', errs.length ? errs.join(' | ') : 'không');
  await ctx.close();
}
await browser.close();
