// tools/lib/chromium.mjs — mở chromium THẬT cho test/dev, KHÔNG hard-code đường dẫn của máy nào.
// playwright được tìm theo thứ tự: $PLAYWRIGHT_DIR → node_modules của project → $DSH_HOME/profiles/web.
// Chromium dùng đúng bản playwright đã cài (chromium.executablePath()); đổi bằng $CHROME_BIN.
// Dùng: import { launchChromium, ROOT, SHOT_DIR } from '../lib/chromium.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));                 // thư mục project
export const SHOT_DIR = fileURLToPath(new URL('../screenshots/', import.meta.url));   // tools/screenshots/
export const CHROME_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

const CANDIDATES = [
  process.env.PLAYWRIGHT_DIR,                                        // thư mục chứa node_modules/playwright
  ROOT,                                                             // node_modules của chính project
  process.env.DSH_HOME && process.env.DSH_HOME + '/profiles/web'      // profile web của harness
].filter(Boolean);

export function loadPlaywright() {
  const tried = [];
  for (const dir of CANDIDATES) {
    try {
      return createRequire(dir.endsWith('/') ? dir + 'x' : dir + '/x')('playwright');
    } catch (e) {
      tried.push(dir + ' → ' + (e.code || e.message));
    }
  }
  throw new Error('không nạp được playwright. Đặt $PLAYWRIGHT_DIR trỏ tới thư mục chứa node_modules/playwright.\nĐã thử:\n  ' + tried.join('\n  '));
}

export async function launchChromium(opts = {}) {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROME_BIN;
  return chromium.launch({ args: CHROME_ARGS, ...(executablePath ? { executablePath } : {}), ...opts });
}

export function chromiumApi() { return loadPlaywright().chromium; }
