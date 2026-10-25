// tools/dev/probe-static.mjs — server TĨNH thuần (không /api) để mô phỏng bản Vercel.
// Dùng: node tools/dev/probe-static.mjs [port]   (mặc định 4399)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PORT = Number(process.argv[2] || 4399);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8'   // giống Vercel khi deploy thật
};
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {   // Vercel tĩnh: /api/* KHÔNG tồn tại
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 (bản tĩnh không có /api)');
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '') p = '/index.html';
  const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  const s = await stat(file).catch(() => null);
  if (!s || !s.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404'); return; }
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
}).listen(PORT, '127.0.0.1', () => console.log('static server: http://127.0.0.1:' + PORT + ' (không có /api)'));
