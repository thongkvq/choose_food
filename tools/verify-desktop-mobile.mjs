
import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';

const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' }
});

const DESKTOPS = [
  { name: 'Desk_1024', w: 1024, h: 768 },
  { name: 'Desk_1280', w: 1280, h: 800 },
  { name: 'Desk_1440', w: 1440, h: 900 },
  { name: 'Desk_1920', w: 1920, h: 1080 }
];

console.log('--- Checking Desktop Sizes ---');
for (const vp of DESKTOPS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const bMain = main ? main.getBoundingClientRect() : null;
    const reel = document.querySelector('.reel-card');
    const bReel = reel ? reel.getBoundingClientRect() : null;
    const filter = document.querySelector('.filter-panel');
    const bFilter = filter ? filter.getBoundingClientRect() : null;
    const side = document.querySelector('.side-feed');
    const bSide = side ? side.getBoundingClientRect() : null;

    const isOverflown = document.documentElement.scrollWidth > window.innerWidth;
    return {
      mainWidth: bMain ? Math.round(bMain.width) : 0,
      reelWidth: bReel ? Math.round(bReel.width) : 0,
      filterWidth: bFilter ? Math.round(bFilter.width) : 0,
      sideWidth: bSide ? Math.round(bSide.width) : 0,
      isOverflown,
      scrollH: document.documentElement.scrollHeight
    };
  });
  console.log(vp.name, metrics);
  await page.screenshot({ path: 'tools/screenshots/' + vp.name + '_full.png', fullPage: true });
  await page.close();
}

console.log('--- Checking Desktop Interactions & Popups at 1440x900 ---');
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
await page.waitForTimeout(600);

// 1. Click filter button on desktop
await page.click('#btnOpenSheet');
await page.waitForTimeout(400);
const filterClickState = await page.evaluate(() => {
  const backdrop = document.querySelector('#sheetBackdrop');
  return {
    backdropHidden: backdrop ? backdrop.hidden : null,
    backdropDisplay: backdrop ? window.getComputedStyle(backdrop).display : null,
    bodyOverflow: document.body.style.overflow,
    activeElement: document.activeElement ? document.activeElement.id : null
  };
});
console.log('Filter click state on desktop:', filterClickState);

// 2. Spin single dish -> Result popup
await page.click('#btnSpinSingle');
await page.waitForSelector('#modalBackdrop:not([hidden])', { timeout: 10000 });
await page.waitForTimeout(500);
const winLayoutState = await page.evaluate(() => {
  const win = document.querySelector('#winDialog');
  const b = win ? win.getBoundingClientRect() : null;
  const layout = win ? win.querySelector('.win-layout') : null;
  const visual = win ? win.querySelector('.win-col-visual') : null;
  const bVis = visual ? visual.getBoundingClientRect() : null;
  const info = win ? win.querySelector('.win-col-info') : null;
  const bInfo = info ? info.getBoundingClientRect() : null;
  return {
    dialog: b ? { w: Math.round(b.width), h: Math.round(b.height) } : null,
    layoutDisplay: layout ? window.getComputedStyle(layout).display : null,
    visualWidth: bVis ? Math.round(bVis.width) : 0,
    infoWidth: bInfo ? Math.round(bInfo.width) : 0
  };
});
console.log('Win dialog state on desktop:', winLayoutState);
await page.screenshot({ path: 'tools/screenshots/Desk_win_popup.png' });

// Test keyboard Escape to close popup
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const afterEsc = await page.evaluate(() => document.querySelector('#modalBackdrop').hidden);
console.log('Modal closed by Esc:', afterEsc);

// 3. Spin 10 dishes -> Multi popup
await page.click('#btnSpinMulti');
await page.waitForSelector('#multiBackdrop:not([hidden])', { timeout: 10000 });
await page.waitForTimeout(500);
const multiState = await page.evaluate(() => {
  const m = document.querySelector('#multiDialog');
  const b = m ? m.getBoundingClientRect() : null;
  const grid = m ? m.querySelector('.multi-grid') : null;
  const cols = grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
  return {
    dialogWidth: b ? Math.round(b.width) : 0,
    columns: cols
  };
});
console.log('Multi dialog state on desktop:', multiState);
await page.screenshot({ path: 'tools/screenshots/Desk_multi_popup.png' });

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 4. Today dialog
await page.click('#btnToday');
await page.waitForSelector('#todayBackdrop:not([hidden])', { timeout: 5000 });
await page.waitForTimeout(400);
const todayState = await page.evaluate(() => {
  const dlg = document.querySelector('#todayDialog');
  const b = dlg ? dlg.getBoundingClientRect() : null;
  const slots = dlg ? dlg.querySelector('.slots') : null;
  const cols = slots ? window.getComputedStyle(slots).gridTemplateColumns.split(' ').length : 0;
  return { dialogWidth: b ? Math.round(b.width) : 0, slotCols: cols };
});
console.log('Today dialog state on desktop:', todayState);
await page.screenshot({ path: 'tools/screenshots/Desk_today_popup.png' });

await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.close();

console.log('--- Checking Mobile Views (No regression) ---');
const MOBILES = [
  { name: 'Mob_375', w: 375, h: 667 },
  { name: 'Mob_390', w: 390, h: 844 },
  { name: 'Mob_458', w: 458, h: 1017 }
];

for (const m of MOBILES) {
  const mPage = await browser.newPage({ viewport: { width: m.w, height: m.h }, isMobile: true, hasTouch: true });
  await mPage.goto('http://127.0.0.1:4321/', { waitUntil: 'load' });
  await mPage.waitForTimeout(600);

  // Spin to verify mobile win popup
  await mPage.click('#btnSpinSingle');
  await mPage.waitForSelector('#modalBackdrop:not([hidden])', { timeout: 10000 });
  await mPage.waitForTimeout(400);

  const mobCheck = await mPage.evaluate(() => {
    const dlg = document.querySelector('#winDialog');
    const b = dlg ? dlg.getBoundingClientRect() : null;
    const isOverflown = document.documentElement.scrollWidth > window.innerWidth;
    const actionBtn = dlg ? dlg.querySelector('.btn-lock') : null;
    const bAct = actionBtn ? actionBtn.getBoundingClientRect() : null;
    return {
      dialogWidth: b ? Math.round(b.width) : 0,
      isOverflown,
      actionVisible: bAct ? bAct.top < window.innerHeight : false
    };
  });
  console.log(m.name, mobCheck);
  await mPage.screenshot({ path: 'tools/screenshots/' + m.name + '_win_popup.png' });
  await mPage.close();
}

await browser.close();
console.log('ALL AUDITS COMPLETE!');
