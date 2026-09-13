// server.js — static + API: định vị theo IP, cache quán theo khu vực, tìm quán bán món gần bạn
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { createGzip, constants as zc } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 4321);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const HOST = process.env.HOST || '0.0.0.0';
const CERT_DIR = join(ROOT, 'certs');
const UA = 'MonGiDay/2.4 (personal LAN food app)';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
const TIERS = [2500, 5000, 10000, 15000];  // 4 mức người dùng chọn
const MAX_RADIUS = 15000;
const DEFAULT_RADIUS = 5000;
const snapTier = (v) => TIERS.find((t) => t >= v) || MAX_RADIUS;   // làm tròn LÊN mức gần nhất
const cache = new Map();
const areaPending = new Map();

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
  }
  return out;
}
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function distM(a, b, c, d) {
  const R = 6371000, t = (x) => x * Math.PI / 180;
  const dLat = t(c - a), dLon = t(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
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
      const j = await jsonFetch('http://ip-api.com/json/?fields=status,country,city,regionName,lat,lon');
      if (j.status !== 'success') throw new Error('ip-api');
      return { lat: j.lat, lng: j.lon, city: j.city, region: j.regionName, country: j.country, source: 'ip' };
    },
    async () => {
      const j = await jsonFetch('https://ipapi.co/json/');
      if (!j.latitude) throw new Error('ipapi');
      return { lat: j.latitude, lng: j.longitude, city: j.city, region: j.region, country: j.country_name, source: 'ip' };
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
    label: [pr.name, pr.street, pr.district, pr.city, pr.country].filter(Boolean).join(', ')
  };
}

/* ---------- Photon (komoot, OSM): tìm quán THEO TÊN MÓN quanh toạ độ ---------- */
async function photonSearch(query, lat, lng, radiusM, limit) {
  const dLat = radiusM / 111000;
  const dLng = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const bbox = (lng - dLng) + "," + (lat - dLat) + "," + (lng + dLng) + "," + (lat + dLat);
  const u = "https://photon.komoot.io/api/?q=" + encodeURIComponent(query) +
    "&lat=" + lat + "&lon=" + lng + "&limit=" + (limit || 20) + "&bbox=" + bbox;
  const j = await jsonFetch(u, null, 20000);
  const FOOD = new Set(['restaurant','fast_food','cafe','food_court','ice_cream','bar','pub','bakery','deli','canteen']);
  const out = [];
  for (const f of (j.features || [])) {
    const pr = f.properties || {};
    const kind = String(pr.osm_value || pr.type || '').toLowerCase();
    if (pr.osm_key !== 'amenity' && !FOOD.has(kind)) continue;   // bỏ khu phố, công trình, cửa hàng...
    if (pr.osm_key === 'amenity' && !FOOD.has(kind)) continue;
    const co = (f.geometry && f.geometry.coordinates) || [];
    const name = pr.name || pr.street;
    if (!name || co.length < 2) continue;
    out.push({
      name: String(name).slice(0, 90), lat: co[1], lng: co[0],
      type: pr.osm_value || pr.type || "",
      cuisine: (pr.extra && pr.extra.cuisine) || "",
      address: [pr.housenumber, pr.street, pr.district, pr.city].filter(Boolean).join(" "),
      phone: (pr.extra && (pr.extra.phone || pr.extra["contact:phone"])) || "",
      open: (pr.extra && pr.extra.opening_hours) || ""
    });
  }
  return out;
}

/* ---------- Overpass (tùy chọn): danh sách quán gần nhất ---------- */
async function overpass(lat, lng, rad, timeoutMs) {
  // Dùng bbox thay vì around(): với bán kính 10km kiểu around bị Overpass cho timeout 504,
  // bbox cùng vùng chỉ ~2s (đo thật). Khoảng cách thật vẫn được lọc lại bằng distM ở dưới.
  const dLat = rad / 111000;
  const dLng = rad / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((v) => v.toFixed(6)).join(',');
  const limit = rad <= 2500 ? 500 : rad <= 5000 ? 900 : rad <= 10000 ? 1600 : 2600;
  let q = '[out:json][timeout:25];(' +
    'node["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)"](BBOX);' +
    'way["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)"](BBOX);' +
    ');out center tags ' + limit + ';';
  q = q.replace(/BBOX/g, bbox);   // Overpass bbox = (nam,tây,bắc,đông)
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.osm.ch/api/interpreter'
  ];   // nhiều gương: Overpass hay trả 429 khi bị hỏi dồn
  let lastErr = null;
  for (const ep of endpoints) {
    try {
      return await jsonFetch(ep, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, timeoutMs || 15000);
    } catch (e) { lastErr = e; }
  }
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
    const list = [];
    for (const el of raw.elements || []) {
      const tg = el.tags || {};
      const name = tg.name || tg['name:vi'] || tg['name:en'];
      if (!name) continue;
      const plat = el.lat != null ? el.lat : (el.center && el.center.lat);
      const plng = el.lon != null ? el.lon : (el.center && el.center.lon);
      if (plat == null || plng == null) continue;
      list.push({
        name: String(name).slice(0, 90), lat: plat, lng: plng, type: tg.amenity || '',
        cuisine: tg.cuisine || '', nname: norm(name), ncuisine: norm(tg.cuisine || ''),
        address: [tg['addr:housenumber'], tg['addr:street'], tg['addr:district'], tg['addr:city']].filter(Boolean).join(' '),
        phone: tg.phone || tg['contact:phone'] || '', open: tg.opening_hours || '',
        brand: tg.brand || tg.operator || '', website: tg.website || tg['contact:website'] || '',
        wiki: tg.wikidata || tg.wikipedia || ''   // có hồ sơ bách khoa = dấu hiệu nổi tiếng thật
      });
    }
    cache.set('area:' + k, { t: Date.now(), data: list });
    areaPending.delete(k);
    console.error('nạp khu vực ' + k + ': ' + list.length + ' quán');
    return list;
  })().catch((e) => { areaPending.delete(k); throw e; });
  areaPending.set(k, job);
  return job;
}
function warmArea(lat, lng) { getArea(lat, lng, DEFAULT_RADIUS).catch(() => {}); }

/* ---------- "Quán có tiếng": chấm điểm từ dữ liệu mở OSM ----------
   OSM không có sao/đánh giá của khách, nên "có tiếng" ở đây = dấu hiệu tin cậy được:
   thương hiệu/chuỗi, có website, có giờ mở cửa, có điện thoại, có địa chỉ, có khai báo loại quán.
   KHÔNG phải điểm đánh giá của thực khách — UI ghi rõ điều này. */
function fameScore(p, branches) {
  let s = 0; const why = [];
  if (p.wiki) { s += 4; why.push('có hồ sơ Wikipedia/Wikidata'); }
  if (p.brand) { s += 3; why.push('thương hiệu ' + p.brand); }
  if (branches >= 3) { s += 2; why.push(branches + ' chi nhánh trong vùng'); }
  if (p.website) { s += 2; why.push('có website'); }
  if (p.open) { s += 1; why.push('có giờ mở cửa'); }
  if (p.phone) { s += 1; why.push('có điện thoại'); }
  if (p.address) { s += 1; why.push('có địa chỉ'); }
  if (p.cuisine) { s += 1; why.push('có loại quán'); }
  return { s: s, why: why };
}
// Đếm số chi nhánh theo tên chuẩn hoá trong vùng đã quét
function branchCounts(list) {
  const m = new Map();
  for (const p of list) m.set(p.nname, (m.get(p.nname) || 0) + 1);
  return m;
}
// Gộp các chi nhánh cùng tên thành 1 dòng (giữ chi nhánh gần nhất, kèm số chi nhánh)
function dedupByName(arr, counts) {
  const by = new Map();
  for (const p of arr) {
    const cur = by.get(p.nname);
    if (!cur || p.dist < cur.dist) by.set(p.nname, p);
  }
  return [...by.values()].map((p) => Object.assign({}, p, { branches: counts.get(p.nname) || 1 }));
}

/* ---------- gộp kết quả ---------- */
async function nearby(lat, lng, radius, dish, kw, cuisineHint) {
  const words = [...new Set((norm(dish) + " " + norm(kw)).split(" ").filter((t) => t.length >= 3))];
  const queries = [...new Set([dish, (kw || "").split("|")[0], words.slice(0, 2).join(" ")].filter((q) => q && q.trim().length >= 3))].slice(0, 3);

  // 1) Photon theo tên món (mở rộng bán kính dần) + 2) Overpass quán gần nhất — CHẠY SONG SONG
  const photonJob = (async () => {
    const attempts = [Math.min(radius, MAX_RADIUS)];   // đúng mức người dùng chọn, không tự nới
    for (const rad of attempts) {
      const seen = new Map();
      const results = await Promise.all(queries.map((q) => photonSearch(q, lat, lng, rad, 20).catch(() => [])));
      for (const got of results) for (const pl of got) {
        const k = pl.name + "@" + pl.lat.toFixed(4) + "," + pl.lng.toFixed(4);
        if (seen.has(k)) continue;
        const n = norm(pl.name);
        const hitName = words.filter((t) => n.includes(t));
        const hitCuisine = [norm(cuisineHint)].filter(Boolean).filter((t) => norm(pl.cuisine).includes(t));
        if (!hitName.length && !hitCuisine.length) continue;
        seen.set(k, Object.assign({}, pl, {
          dist: distM(lat, lng, pl.lat, pl.lng), score: hitName.length * 3 + hitCuisine.length * 2,
          hitName: hitName, hitCuisine: hitCuisine,
          maps: "https://www.google.com/maps/dir/?api=1&destination=" + pl.lat + "," + pl.lng + "&travelmode=driving"
        }));
      }
      // Photon trả theo ô vuông nên có quán nhích ra ngoài bán kính — cắt cho đúng mức đã chọn
      const matched = [...seen.values()].filter((p) => p.dist <= rad).sort((a, b) => (b.score - a.score) || (a.dist - b.dist));
      if (matched.length >= 3 || rad >= MAX_RADIUS) return { matched: matched.slice(0, 12), usedRadius: rad };
    }
    return { matched: [], usedRadius: radius };
  })();

  const overpassJob = (async () => {
    const all = await getArea(lat, lng, radius);
    const near = all.map((p) => Object.assign({}, p, { dist: distM(lat, lng, p.lat, p.lng) }))
      .filter((p) => p.dist <= Math.min(radius, MAX_RADIUS)).sort((a, b) => a.dist - b.dist);
    const cu = norm(cuisineHint);
    const sameCuisine = near.filter((p) => cu && p.ncuisine.includes(cu)).slice(0, 12);
    const counts = branchCounts(all);
    const pack = (p) => {
      const f = fameScore(p, counts.get(p.nname) || 1);
      return { name: p.name, dist: p.dist, type: p.type, cuisine: p.cuisine, address: p.address, phone: p.phone,
        open: p.open || '', brand: p.brand || '', website: p.website || '', fame: f.s, why: f.why, branches: p.branches || 1,
        maps: "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lng + "&travelmode=driving" };
    };
    // "quán có tiếng bán món này": khớp tên món/ẩm thực + có dấu hiệu tin cậy
    const words2 = [...new Set((norm(dish) + " " + norm(kw)).split(" ").filter((t) => t.length >= 3))];
    const famousMatch = dedupByName(near.map((p) => Object.assign({}, p, { fame: fameScore(p, counts.get(p.nname) || 1).s }))
      .filter((p) => p.fame >= 4 && (words2.some((t) => p.nname.includes(t)) || (cu && p.ncuisine.includes(cu))))
      .sort((a, b) => (b.fame - a.fame) || (a.dist - b.dist)), counts).slice(0, 8);
    // "quán có tiếng quanh đây" (chuỗi/thương hiệu, có website…) — không cần khớp tên món
    const famousNear = dedupByName(near.map((p) => Object.assign({}, p, { fame: fameScore(p, counts.get(p.nname) || 1).s }))
      .filter((p) => p.fame >= 5).sort((a, b) => (b.fame - a.fame) || (a.dist - b.dist)), counts).slice(0, 10);
    return { areaTotal: all.length, nearest: near.slice(0, 12).map(pack), sameCuisine: sameCuisine.map(pack),
      famousMatch: famousMatch.map(pack), famousNear: famousNear.map(pack) };
  })().catch((e) => ({ areaTotal: 0, nearest: [], sameCuisine: [], areaError: String((e && e.message) || e) }));

  // bán kính càng lớn Overpass càng lâu -> nới thời gian chờ theo mức người dùng chọn
  const ovBudget = radius <= 2500 ? 5000 : radius <= 5000 ? 9000 : radius <= 10000 ? 15000 : 20000;   // ô lạnh 15km ~10s
  const [ph, ov] = await Promise.all([photonJob, withTimeout(overpassJob, ovBudget, { areaTotal: 0, nearest: [], sameCuisine: [], areaError: 'hết thời gian chờ Overpass', timedOut: true })]);
  // Hết giờ thì vẫn nạp tiếp ở nền (không giới hạn chặt) rồi cache 30 phút:
  // lần bấm 🔄 Tìm lại sau đó là có ngay, lần đầu chỉ chậm.
  let areaWarming = false;
  if (ov.timedOut) { areaWarming = true; getArea(lat, lng, radius, Math.max(60000, ovBudget * 4)).catch(() => {}); }
  return {
    center: { lat: lat, lng: lng }, radius: radius, usedRadius: ph.usedRadius,
    matched: ph.matched, nearest: ov.nearest || [], sameCuisine: ov.sameCuisine || [],
    famousMatch: ov.famousMatch || [], famousNear: ov.famousNear || [],
    areaTotal: ov.areaTotal || 0, areaError: ov.areaError || null, areaWarming: areaWarming,
    mapsUrl: "https://www.google.com/maps/search/" + encodeURIComponent(dish + " gần đây") + "/@" + lat + "," + lng + ",13z",
    mapsKeywordUrl: "https://www.google.com/maps/search/" + encodeURIComponent(dish) + "/@" + lat + "," + lng + ",13z",
    osmUrl: "https://www.openstreetmap.org/#map=14/" + lat + "/" + lng
  };
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const send = (code, obj) => {
    const body = Buffer.from(JSON.stringify(obj));
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': body.length });
    res.end(body);
  };
  try {
    if (url.pathname === '/api/whereami') { const w = await whereAmI(); warmArea(w.lat, w.lng); return send(200, w); }
    if (url.pathname === '/api/weather') {
      const lat = Number(url.searchParams.get('lat')), lng = Number(url.searchParams.get('lng'));
      if (!isFinite(lat) || !isFinite(lng)) return send(400, { error: 'thiếu lat/lng' });
      try { return send(200, await weather(lat, lng)); } catch (e) { return send(200, { error: String((e && e.message) || e) }); }
    }
    if (url.pathname === '/api/geocode') {
      const q = (url.searchParams.get('q') || '').slice(0, 120);
      if (q.length < 3) return send(400, { error: 'thiếu địa chỉ' });
      return send(200, await geocode(q));
    }
    if (url.pathname === '/api/nearby') {
      const lat = Number(url.searchParams.get('lat')), lng = Number(url.searchParams.get('lng'));
      if (!isFinite(lat) || !isFinite(lng)) return send(400, { error: 'thiếu lat/lng' });
      const r = snapTier(Math.min(MAX_RADIUS, Math.max(300, Number(url.searchParams.get('r')) || DEFAULT_RADIUS)));
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
