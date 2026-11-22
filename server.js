// server.js — static + API: định vị theo IP, cache quán theo khu vực, tìm quán bán món gần bạn
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { createGzip, constants as zc } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
// Logic tìm quán dùng CHUNG với app.js (một bản duy nhất, không chép lại)
import {
  attachHours, branchCounts, clampRadius, DEFAULT_RADIUS, dishQueries, dishWords, fameLists, filterByRadius,
  hoursIndex, matchPlace, MAX_RADIUS, nearbyUrls, norm, ovBudgetFor, overpassQuery, packMatched, packPoi,
  photonSearchResult, photonSearchUrl, poisFromOverpass, sortMatched, withDistance
} from './lib/nearby-core.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 4321);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const HOST = process.env.HOST || '0.0.0.0';
const CERT_DIR = join(ROOT, 'certs');
const UA = 'MonGiDay/2.4 (personal LAN food app)';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
const cache = new Map();
const areaPending = new Map();

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
  }
  return out;
}
function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([promise, new Promise((res) => { timer = setTimeout(() => res(fallback), ms); })]).finally(() => clearTimeout(timer));
}
async function jsonFetch(url, opts, timeout) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout || 25000);
  try {
    const o = opts || {};
    const r = await fetch(url, {
      method: o.method || 'GET', body: o.body, signal: ctl.signal,
      headers: Object.assign({ 'user-agent': UA, accept: 'application/json' }, o.headers || {})
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

/* ---------- vị trí gần đúng theo IP ---------- */
async function whereAmI() {
  const c = cache.get('whereami');
  if (c && Date.now() - c.t < 30 * 60 * 1000) return c.data;
  const providers = [
    async () => {
      const j = await jsonFetch('http://ip-api.com/json/?fields=status,country,countryCode,city,regionName,lat,lon');
      if (j.status !== 'success') throw new Error('ip-api');
      return { lat: j.lat, lng: j.lon, city: j.city, region: j.regionName, country: j.country, countryCode: j.countryCode, source: 'ip' };
    },
    async () => {
      const j = await jsonFetch('https://ipapi.co/json/');
      if (!j.latitude) throw new Error('ipapi');
      return { lat: j.latitude, lng: j.longitude, city: j.city, region: j.region, country: j.country_name, countryCode: j.country_code, source: 'ip' };
    }
  ];
  for (const p of providers) {
    try { const d = await p(); cache.set('whereami', { t: Date.now(), data: d }); return d; } catch (e) {}
  }
  throw new Error('không lấy được vị trí theo IP');
}

/* ---------- Thời tiết hiện tại (Open-Meteo, không cần API key) ---------- */
async function weather(lat, lng) {
  const k = "w:" + lat.toFixed(2) + "," + lng.toFixed(2);
  const c = cache.get(k);
  if (c && Date.now() - c.t < 15 * 60 * 1000) return c.data;
  const u = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code,is_day,wind_speed_10m&timezone=auto";
  const j = await jsonFetch(u, null, 15000);
  const cur = j.current || {};
  const code = Number(cur.weather_code);
  const rain = code >= 51 || Number(cur.precipitation) > 0.15;   // mưa/giông/mưa phùn
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const storm = code >= 95;
  const desc = storm ? "giông bão" : snow ? "có tuyết" : rain ? (code >= 63 ? "mưa to" : "mưa nhẹ")
    : code === 45 || code === 48 ? "có sương mù" : code === 3 ? "nhiều mây" : code === 2 ? "ít mây" : code === 1 ? "trời quang" : "trời trong";
  const out = {
    temp: cur.temperature_2m, feels: cur.apparent_temperature, code: code, desc: desc,
    rain: rain, snow: snow, storm: storm, isDay: cur.is_day === 1, wind: cur.wind_speed_10m,
    hour: new Date().getHours()
  };
  cache.set(k, { t: Date.now(), data: out });
  return out;
}
/* ---------- Photon: địa chỉ -> toạ độ ---------- */
async function geocode(q) {
  const u = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=1';
  const j = await jsonFetch(u, null, 20000);
  const f = (j.features || [])[0];
  if (!f) throw new Error('không tìm thấy địa chỉ');
  const pr = f.properties || {}, co = (f.geometry && f.geometry.coordinates) || [];
  if (co.length < 2) throw new Error('không có toạ độ');
  return {
    lat: co[1], lng: co[0],
    city: pr.city, region: pr.state || pr.region, district: pr.district, country: pr.country, countryCode: pr.countrycode || pr.country_code,
     label: [pr.name, pr.street, pr.district, pr.city, pr.state, pr.country].filter(Boolean).join(', ')
  };
}

async function reverseGeocode(lat, lng) {
  const u = 'https://photon.komoot.io/reverse?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng);
  const j = await jsonFetch(u, null, 12000);
  const f = (j.features || [])[0], pr = f && f.properties || {};
  return {
    lat, lng, city: pr.city, region: pr.state || pr.region, district: pr.district,
    country: pr.country, countryCode: pr.countrycode || pr.country_code,
    label: [pr.name, pr.street, pr.district, pr.city, pr.state, pr.country].filter(Boolean).join(', '), source: 'reverse'
  };
}

/* ---------- Photon (komoot, OSM): tìm quán THEO TÊN MÓN quanh toạ độ ---------- */
async function photonSearch(query, lat, lng, radiusM, limit) {
  const j = await jsonFetch(photonSearchUrl(query, lat, lng, radiusM, limit), null, 20000);
  return photonSearchResult(j);
}

/* ---------- Overpass (tùy chọn): danh sách quán gần nhất ---------- */
async function overpass(lat, lng, rad, timeoutMs) {
  // Truy vấn bbox (nam,tây,bắc,đông) dựng trong lib/nearby-core.js — giống hệt bản trình duyệt.
  const q = overpassQuery(lat, lng, rad);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.osm.ch/api/interpreter'
  ];   // nhiều gương: Overpass hay trả 429/502 khi bị hỏi dồn
  let lastErr = null, empty = null;
  for (const ep of endpoints) {
    try {
      const j = await jsonFetch(ep, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, timeoutMs || 15000);
      // Gương trả 200 nhưng RỖNG thì chưa chắc khu vực không có quán: osm.ch chỉ có dữ liệu
      // Thuỵ Sĩ nên trả 0 POI cho Việt Nam. Thử tiếp gương khác, chỉ khi mọi gương đều rỗng
      // mới coi là khu vực trống.
      if (!(j.elements || []).length) { empty = j; continue; }
      return j;
    } catch (e) { lastErr = e; }
  }
  if (empty) return empty;
  throw new Error('Overpass không phản hồi: ' + ((lastErr && lastErr.message) || ''));
}
const areaKey = (lat, lng, rad) => (Math.round(lat * 100) / 100) + ',' + (Math.round(lng * 100) / 100) + ':' + rad;
function getArea(lat, lng, rad, timeoutMs) {
  const r = rad || DEFAULT_RADIUS;
  const k = areaKey(lat, lng, r);
  const c = cache.get('area:' + k);
  if (c && Date.now() - c.t < 30 * 60 * 1000) return Promise.resolve(c.data);
  if (areaPending.has(k)) return areaPending.get(k);
  const job = (async () => {
    const raw = await overpass(lat, lng, r, timeoutMs);
    const list = poisFromOverpass(raw.elements);
    cache.set('area:' + k, { t: Date.now(), data: list });
    areaPending.delete(k);
    console.error('nạp khu vực ' + k + ': ' + list.length + ' quán');
    return list;
  })().catch((e) => { areaPending.delete(k); throw e; });
  areaPending.set(k, job);
  return job;
}
function warmArea(lat, lng) { getArea(lat, lng, DEFAULT_RADIUS).catch(() => {}); }

/* ---------- gộp kết quả (logic chấm điểm/nổi tiếng nằm trong lib/nearby-core.js) ---------- */
async function nearby(lat, lng, radius, dish, kw, cuisineHint) {
  const words = dishWords(dish, kw);
  const queries = dishQueries(dish, kw);

  // 1) Photon theo tên món + 2) Overpass quán gần nhất — CHẠY SONG SONG
  const photonJob = (async () => {
    const rad = Math.min(radius, MAX_RADIUS);   // đúng mức người dùng chọn, không tự nới
    const seen = new Map();
    const results = await Promise.all(queries.map((q) => photonSearch(q, lat, lng, rad, 20).catch(() => [])));
    for (const got of results) for (const pl of got) {
      const k = pl.name + "@" + pl.lat.toFixed(4) + "," + pl.lng.toFixed(4);
      if (seen.has(k)) continue;
      const hit = matchPlace(pl, words, cuisineHint);
      if (!hit.ok) continue;
      seen.set(k, packMatched(pl, lat, lng, hit));
    }
    // Photon trả theo ô vuông nên có quán nhích ra ngoài bán kính — cắt cho đúng mức đã chọn
    const matched = sortMatched(filterByRadius([...seen.values()], rad));
    return { matched: matched.slice(0, 12), usedRadius: rad };
  })();

  const overpassJob = (async () => {
    const all = await getArea(lat, lng, radius);
    const near = withDistance(all, lat, lng).filter((p) => p.dist <= Math.min(radius, MAX_RADIUS))
      .sort((a, b) => a.dist - b.dist);
    const cu = norm(cuisineHint);
    const sameCuisine = near.filter((p) => cu && p.ncuisine.includes(cu)).slice(0, 12);
    const counts = branchCounts(all);
    const lists = fameLists(all, lat, lng, Math.min(radius, MAX_RADIUS), dish, kw, cuisineHint);
    return { areaTotal: all.length, nearest: near.slice(0, 12).map((p) => packPoi(p, counts)), sameCuisine: sameCuisine.map((p) => packPoi(p, counts)),
      famousMatch: lists.famousMatch.map((p) => packPoi(p, counts)), famousNear: lists.famousNear.map((p) => packPoi(p, counts)),
      hours: hoursIndex(all) };   // Photon thường thiếu opening_hours -> ghép từ OSM (cùng osm id / tên + ≤60m)
  })().catch((e) => ({ areaTotal: 0, nearest: [], sameCuisine: [], hours: [], areaError: String((e && e.message) || e) }));

  // bán kính càng lớn Overpass càng lâu -> nới thời gian chờ theo mức người dùng chọn
  const ovBudget = ovBudgetFor(radius);   // ô lạnh 15km ~10s
  const [ph, ov] = await Promise.all([photonJob, withTimeout(overpassJob, ovBudget, { areaTotal: 0, nearest: [], sameCuisine: [], hours: [], areaError: 'hết thời gian chờ Overpass', timedOut: true })]);
  const matched = attachHours(ph.matched, ov.hours || []);   // quán Photon + giờ mở cửa của OSM
  // Hết giờ thì vẫn nạp tiếp ở nền (không giới hạn chặt) rồi cache 30 phút:
  // lần bấm 🔄 Tìm lại sau đó là có ngay, lần đầu chỉ chậm.
  let areaWarming = false;
  if (ov.timedOut) { areaWarming = true; getArea(lat, lng, radius, Math.max(60000, ovBudget * 4)).catch(() => {}); }
  return Object.assign({
    center: { lat: lat, lng: lng }, radius: radius, usedRadius: ph.usedRadius,
    matched: matched, nearest: ov.nearest || [], sameCuisine: ov.sameCuisine || [],
    hoursKnown: matched.filter((p) => p.open).length,   // tỉ lệ quán biết giờ mở cửa (chẩn đoán)
    famousMatch: ov.famousMatch || [], famousNear: ov.famousNear || [],
    areaTotal: ov.areaTotal || 0, areaError: ov.areaError || null, areaWarming: areaWarming
  }, nearbyUrls(lat, lng, dish));
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  // Number(null) === 0 nên "thiếu lat/lng" từng bị coi là toạ độ 0,0 -> phải phân biệt rõ
  const num = (key) => { const v = url.searchParams.get(key); return (v == null || v === '') ? NaN : Number(v); };
  const send = (code, obj) => {
    const body = Buffer.from(JSON.stringify(obj));
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': body.length });
    res.end(body);
  };
  try {
    if (url.pathname === '/api/whereami') { const w = await whereAmI(); warmArea(w.lat, w.lng); return send(200, w); }
    if (url.pathname === '/api/weather') {
      const lat = num('lat'), lng = num('lng');
      if (!isFinite(lat) || !isFinite(lng)) return send(400, { error: 'thiếu lat/lng' });
      try { return send(200, await weather(lat, lng)); } catch (e) { return send(200, { error: String((e && e.message) || e) }); }
    }
    if (url.pathname === '/api/geocode') {
      const q = (url.searchParams.get('q') || '').slice(0, 120);
      if (q.length < 3) return send(400, { error: 'thiếu địa chỉ' });
      return send(200, await geocode(q));
    }
    if (url.pathname === '/api/reverse-geocode') {
      const lat = num('lat'), lng = num('lng');
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return send(400, { error: 'thiếu lat/lng' });
      return send(200, await reverseGeocode(lat, lng));
    }
    if (url.pathname === '/api/nearby') {
      const lat = num('lat'), lng = num('lng');
      if (!isFinite(lat) || !isFinite(lng)) return send(400, { error: 'thiếu lat/lng' });
      const r = clampRadius(url.searchParams.get('r'));
      const q = (url.searchParams.get('q') || '').slice(0, 60);
      const kw = (url.searchParams.get('kw') || '').slice(0, 160);
      const cu = (url.searchParams.get('cuisine') || '').slice(0, 60);
      return send(200, await nearby(lat, lng, r, q, kw, cu));
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('method not allowed'); return; }
    let p = decodeURIComponent(url.pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404'); return; }
    const type = MIME[extname(file)] || 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': 'no-cache, must-revalidate', 'vary': 'Accept-Encoding' };
    const body = await readFile(file);
    if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 1024) {
      headers['content-encoding'] = 'gzip';
      res.writeHead(200, headers);
      if (req.method === 'HEAD') return res.end();
      const gz = createGzip({ level: zc.Z_BEST_SPEED }); gz.pipe(res); gz.end(body); return;
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    if (url.pathname.indexOf('/api/') === 0) return send(500, { error: String((e && e.message) || e) });
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('500 ' + e.message);
  }
}

http.createServer(handle).listen(PORT, HOST, () => {
  console.log('Món Gì Đây? đang chạy:');
  console.log('  http://127.0.0.1:' + PORT + '   (máy này)');
  for (const ip of lanAddresses()) console.log('  http://' + ip + ':' + PORT + '   (LAN / điện thoại)');
});

/* HTTPS tự ký: cần cho GPS (trình duyệt chỉ cho lấy vị trí trên https/localhost) */
try {
  const key = await readFile(join(CERT_DIR, 'key.pem'));
  const crt = await readFile(join(CERT_DIR, 'cert.pem'));
  https.createServer({ key: key, cert: crt }, handle).listen(HTTPS_PORT, HOST, () => {
    for (const ip of lanAddresses()) console.log('  https://' + ip + ':' + HTTPS_PORT + '   (LAN, dùng GPS được — sẽ có cảnh báo chứng chỉ, chọn Tiếp tục)');
  });
} catch (e) {
  console.log('  (không có certs/key.pem + certs/cert.pem nên bỏ qua HTTPS)');
}
