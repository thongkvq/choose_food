
import { createRequire } from 'node:module';
const require = createRequire('/srv/ai-workspaces/dsh-home/profiles/web/');
const { chromium } = require('playwright');
const DEPS = '/var/lib/dsh/autogame/chromedeps/root/usr/lib/x86_64-linux-gnu';

const VPS = [
  { name: 'Desktop 1024x768', w: 1024, h: 768 },
  { name: 'Desktop 1280x800', w: 1280, h: 800 },
  { name: 'Desktop 1440x900', w: 1440, h: 900 },
  { name: 'Desktop 1920x1080', w: 1920, h: 1080 }
];

const browser = await chromium.launch({
  executablePath: '/var/lib/dsh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: DEPS + ':' + DEPS + '/alsa-lib:' + DEPS + '/gbm' }
});

for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const data = await page.evaluate(() => {
    const main = document.querySelector('.app-main');
    const mainBox = main ? main.getBoundingClientRect() : null;
    const reel = document.querySelector('.reel-card');
    const reelBox = reel ? reel.getBoundingClientRect() : null;
    const filter = document.querySelector('.filter-panel');
    const filterBox = filter ? filter.getBoundingClientRect() : null;
    const sideFeed = document.querySelector('.side-feed');
    const sideBox = sideFeed ? sideFeed.getBoundingClientRect() : null;
    const filterDisplay = filter ? getComputedStyle(filter).display : 'none';
    const filterPos = filter ? getComputedStyle(filter).position : 'none';
    const filterVis = filter ? getComputedStyle(filter).visibility : 'none';
    const filterTransform = filter ? getComputedStyle(filter).transform : 'none';
    const sideDisplay = sideFeed ? getComputedStyle(sideFeed).display : 'none';
    
    // Check elements in viewport or overflowing
    return {
      mainWidth: mainBox ? Math.round(mainBox.width) : 0,
      reelWidth: reelBox ? Math.round(reelBox.width) : 0,
      filterBox: filterBox ? { w: Math.round(filterBox.width), h: Math.round(filterBox.height), top: Math.round(filterBox.top), left: Math.round(filterBox.left) } : null,
      filterDisplay, filterPos, filterVis, filterTransform,
      sideDisplay,
      sideBox: sideBox ? { w: Math.round(sideBox.width), h: Math.round(sideBox.height), top: Math.round(sideBox.top), left: Math.round(sideBox.left) } : null,
      scrollH: document.documentElement.scrollHeight,
      scrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      vh: window.innerHeight
    };
  });

  console.log('=== ' + vp.name + ' ===', JSON.stringify(data, null, 2));
  await page.screenshot({ path: 'tools/screenshots/' + vp.name.replace(/\s+/g, '_') + '.png', fullPage: true });
  await ctx.close();
}

await browser.close();
