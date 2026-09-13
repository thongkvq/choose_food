// tools/test-vnonly.mjs — verify "chỉ món Việt" mặc định BẬT
import { createRequire } from 'module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');

const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  env: { ...process.env, LD_LIBRARY_PATH: '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/alsa-lib:/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu/gbm' }
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  PAGE ERROR: ' + e.message));
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

const snap = async (label) => {
  const r = await page.evaluate(() => {
    const s = window.__mgd;
    const p = s.pool();
    const regions = {};
    p.forEach(d => regions[d.region] = (regions[d.region] || 0) + 1);
    return {
      vnOnly: s.state.vnOnly,
      pool: p.length,
      all: s.ALL().length,
      regions,
      chipOff: document.querySelectorAll('#regionChips .chip.foreign-off').length,
      switchChecked: document.querySelector('#fVnOnly') ? document.querySelector('#fVnOnly').checked : null,
      poolText: (document.querySelector('#poolStatusText') || {}).textContent
    };
  });
  console.log('[' + label + ']', JSON.stringify(r));
  return r;
};

const a = await snap('MẶC ĐỊNH');
const onlyVn = Object.keys(a.regions).every(k => k === 'vn');
console.log('  -> mặc định chỉ món Việt:', onlyVn, '| ẩn hết chip nước ngoài:', a.chipOff === 10, '| switch bật:', a.switchChecked === true);

// quay thử 6 lần, món trúng phải là món Việt
let bad = 0;
for (let i = 0; i < 6; i++) {
  const w = await page.evaluate(() => { const s = window.__mgd; const p = s.pool(); return s.drawOne(p).region; });
  if (w !== 'vn') bad++;
}
console.log('  -> 6 lần rút ngẫu nhiên: số món ngoại =', bad);

// mở khoá món quốc tế
await page.click('#btnOpenSheet');
await page.waitForTimeout(700);   // chờ sheet mở xong mới bấm
await page.click('label.switch:has(#fVnOnly) .track-ui', { force: true });  // bấm công tắc như người dùng
await page.waitForTimeout(300);
const b = await snap('SAU KHI TẮT SWITCH');
const hasForeign = Object.keys(b.regions).some(k => k !== 'vn');
console.log('  -> có lại món ngoại:', hasForeign);

// bấm chip Nhật => tự tắt vnOnly + lọc đúng Nhật
await page.click('#regionChips .chip[data-k="jp"]');
await page.waitForTimeout(250);
const c = await snap('CHIP NHẬT');
console.log('  -> chỉ còn Nhật:', Object.keys(c.regions).join(',') === 'jp', '| vnOnly đã tắt:', c.vnOnly === false);

// đặt lại
await page.click('#btnResetFilters');
await page.waitForTimeout(250);
const d = await snap('ĐẶT LẠI');
console.log('  -> reset quay về chỉ món Việt:', Object.keys(d.regions).every(k => k === 'vn') && d.vnOnly === true);

// reload: cài đặt phải nhớ (localStorage mgd.vnOnly)
await page.evaluate(() => { const el = document.querySelector('#fVnOnly'); el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(200);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mgd, null, { timeout: 20000 });
const e = await snap('SAU RELOAD (đã tắt từ trước)');
console.log('  -> nhớ trạng thái tắt:', e.vnOnly === false, '| có món ngoại:', Object.keys(e.regions).some(k => k !== 'vn'));

await browser.close();
const pass = onlyVn && bad === 0 && a.chipOff === 10 && hasForeign && c.vnOnly === false && d.vnOnly === true && e.vnOnly === false;
console.log(pass ? 'KẾT QUẢ: PASS' : 'KẾT QUẢ: FAIL');
process.exit(pass ? 0 : 1);
