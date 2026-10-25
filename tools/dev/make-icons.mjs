import { launchChromium } from '../lib/chromium.mjs';
// tools/dev/make-icons.mjs — vẽ logo SVG rồi xuất PNG cho PWA (192 / 512 / maskable 512).
// Không dùng thư viện ngoài: render SVG bằng chromium có sẵn (Playwright) rồi chụp ảnh.
// Dùng: node tools/dev/make-icons.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'icons/';

// Màu lấy đúng theo styles.css: --bg #0a0710 · --bg2 #140f22 (theme tối, mặc định)
// và meta theme-color #0b0812. Logo = tô món ăn + đũa + tia gacha.
export function logoSVG(scale = 1) {
  const g = 512 * (1 - scale) / 2;                 // maskable: thu nhỏ logo vào vùng an toàn 80%
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1030"/><stop offset=".55" stop-color="#140f22"/><stop offset="1" stop-color="#3a1018"/>
    </linearGradient>
    <linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe9c9"/><stop offset="1" stop-color="#ffb27a"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".42" r=".5">
      <stop offset="0" stop-color="#ffbe2e" stop-opacity=".55"/><stop offset="1" stop-color="#ffbe2e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="250" r="200" fill="url(#glow)"/>
  <g transform="translate(${g} ${g}) scale(${scale})">
    <g transform="translate(256 336)">
      <path d="M-124 0a124 124 0 0 0 248 0z" fill="url(#bowl)"/>
      <path d="M-140 -16h280a13 13 0 0 1 0 26h-280a13 13 0 0 1 0-26z" fill="#ff5722"/>
      <path d="M-84 -30c22 16 44 -16 66 0s44 -16 66 0" fill="none" stroke="#fff6e8" stroke-width="11" stroke-linecap="round"/>
      <path d="M-58 -62c-16-24 12-32 0-58" fill="none" stroke="#22d3ee" stroke-width="11" stroke-linecap="round" opacity=".9"/>
      <path d="M-4 -70c-16-26 14-34 0-64" fill="none" stroke="#22d3ee" stroke-width="11" stroke-linecap="round" opacity=".7"/>
    </g>
    <g stroke="#cbb7ff" stroke-width="15" stroke-linecap="round">
      <path d="M296 158 L432 74"/><path d="M318 200 L454 116"/>
    </g>
    <path d="M152 78l14 40 40 14-40 14-14 40-14-40-40-14 40-14z" fill="#ffbe2e"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await writeFile(OUT + 'logo.svg', logoSVG(1), 'utf8');
  const browser = await launchChromium();
  const jobs = [
    { file: 'icon-192.png', size: 192, scale: .84 },
    { file: 'icon-512.png', size: 512, scale: .84 },
    { file: 'maskable-512.png', size: 512, scale: .62 }   // maskable: logo trong vùng an toàn 80%
  ];
  for (const j of jobs) {
    const ctx = await browser.newContext({ viewport: { width: j.size, height: j.size }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>' + logoSVG(j.scale), { waitUntil: 'load' });
    await page.screenshot({ path: OUT + j.file, omitBackground: false });
    await ctx.close();
    const buf = await readFile(OUT + j.file);
    const ok = buf.length > 1000 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG';
    console.log((ok ? 'OK  ' : 'FAIL') + ' icons/' + j.file + '  ' + j.size + 'x' + j.size + '  ' + (buf.length / 1024).toFixed(1) + 'KB' + (j.file.startsWith('maskable') ? '  (maskable)' : ''));
  }
  await browser.close();
  console.log('Đã ghi icons/logo.svg + 3 PNG (màu theo styles.css: #0a0710 / #140f22, theme-color #0b0812)');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
