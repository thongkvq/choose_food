// sw.js — service worker của "Món Gì Đây?"
// Chiến lược:
//   · HTML / JS / CSS / webmanifest  -> NETWORK-FIRST (bản mới lên ngay), offline thì lấy cache
//   · data/*.json                    -> STALE-WHILE-REVALIDATE (hiện ngay, cập nhật ngầm)
//   · ảnh upload.wikimedia.org       -> CACHE-FIRST, tối đa 150 ảnh (xoá ảnh cũ nhất)
//   · API ngoài (Photon, Overpass, Open-Meteo, ipapi…) -> KHÔNG cache, luôn ra mạng
// Đổi VERSION khi deploy để xoá cache cũ trong activate.
const VERSION = 'mgd-v24-1';
const SHELL_CACHE = 'shell-' + VERSION;
const DATA_CACHE = 'data-' + VERSION;
const IMG_CACHE = 'img-' + VERSION;
const KEEP = [SHELL_CACHE, DATA_CACHE, IMG_CACHE];
const IMG_MAX = 150;

const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'art.js', 'lib/nearby-core.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'
];
const PRECACHE_DATA = ['data/dishes-lite.json'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL.map((u) => shell.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    const data = await caches.open(DATA_CACHE);
    await Promise.all(PRECACHE_DATA.map((u) => data.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.ok && res.type !== 'opaque') cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await caches.open(SHELL_CACHE);
      const idx = (await shell.match('index.html')) || (await shell.match('./'));
      if (idx) return idx;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res && res.ok && res.type !== 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) return hit;                       // có cache: trả ngay, cập nhật ngầm
  const res = await net;
  if (res) return res;
  throw new Error('offline và không có cache: ' + req.url);
}

// ảnh: thêm header thời điểm vào bản lưu để biết ảnh nào cũ nhất
async function cacheFirstImage(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req, { mode: 'no-cors' });
  if (res && (res.ok || res.type === 'opaque')) {
    try {
      const body = await res.clone().blob();
      const stamped = new Response(body, {
        status: res.status === 0 ? 200 : res.status,
        statusText: res.statusText,
        headers: { 'content-type': res.headers.get('content-type') || 'image/jpeg', 'x-cached-at': String(Date.now()) }
      });
      await cache.put(req, stamped);
      await trim(cache, max);
    } catch (e) { /* ảnh lỗi thì thôi, không cache */ }
  }
  return res;
}

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  const entries = await Promise.all(keys.map(async (k) => {
    const r = await cache.match(k, { ignoreVary: true });
    return { k: k, t: Number(r && r.headers.get('x-cached-at')) || 0 };
  }));
  entries.sort((a, b) => a.t - b.t);                 // cũ nhất trước
  for (const e of entries.slice(0, entries.length - max)) await cache.delete(e.k);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (url.origin === self.location.origin) {
    const p = url.pathname;
    if (/\/data\/[^/]*\.json$/.test(p)) return event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    if (req.mode === 'navigate' || /\.(?:html?|js|css|webmanifest)$/.test(p) || p.endsWith('/')) {
      return event.respondWith(networkFirst(req, SHELL_CACHE));
    }
    return;                                          // tài nguyên cùng origin khác (icon, ảnh nội bộ): để trình duyệt lo
  }

  if (url.hostname === 'upload.wikimedia.org') return event.respondWith(cacheFirstImage(req, IMG_CACHE, IMG_MAX));
  // Photon / Overpass / Open-Meteo / ipapi / ShopeeFood / Grab / Google Maps: KHÔNG cache, luôn ra mạng.
});
