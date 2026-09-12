import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';
const CHROME = '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

async function run(label, url, geo) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' } });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    ignoreHTTPSErrors: true, permissions: geo ? ['geolocation'] : [], geolocation: geo || undefined
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  console.log('\n=== ' + label + ' ===');
  console.log('secure context:', await page.evaluate(() => window.isSecureContext));
  const b = await page.locator('#btnSpinSingle').boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(7600);
  console.log('món:', await page.textContent('.win-name'));
  await page.click('[data-act="nearby"]');
  await page.waitForTimeout(3000);
  // nhập địa chỉ nếu có ô nhập
  const hasInput = await page.evaluate(() => !!document.querySelector('#locInput'));
  console.log('có ô nhập địa chỉ:', hasInput, '| có gợi ý HTTPS:', await page.evaluate(() => !!document.querySelector('.loc-https')));
  if (hasInput) {
    await page.fill('#locInput', 'Chợ Bến Thành, Hồ Chí Minh');
    await page.click('[data-act="loc-go"]');
    await page.waitForTimeout(22000);
  } else {
    await page.waitForTimeout(22000);
  }
  const r = await page.evaluate(() => {
    const out = document.querySelector('#nearbyOut');
    return {
      info: out.querySelector('.loc-info')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 130),
      note: [...out.querySelectorAll('.nearby-note')].map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(x => !/http|HTTPS/.test(x)).slice(-1)[0],
      shops: [...out.querySelectorAll('.shop')].slice(0, 5).map(s => s.querySelector('b').textContent + ' | ' + s.querySelector('.shop-dist').textContent),
      links: [...out.querySelectorAll('.nearby-link')].map(a => a.textContent.trim())
    };
  });
  console.log('vị trí:', r.info);
  console.log('kết quả:', r.note);
  r.shops.forEach(s => console.log('   ' + s));
  console.log('nút:', r.links.join(' / '));
  console.log('lỗi JS:', errs.length ? errs.join(' | ') : 'không');
  await ctx.close(); await browser.close();
}
await run('HTTPS + GPS (toạ độ Bến Thành)', 'https://127.0.0.1:8443/', { latitude: 10.7725, longitude: 106.698 });
