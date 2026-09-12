// api/_lib.js — tiện ích dùng chung cho các Vercel Serverless Function
const UA = 'MonGiDay/3.0 (food gacha; vercel)';
const cache = new Map();

export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function distM(a, b, c, d) {
  const R = 6371000, t = (x) => x * Math.PI / 180;
  const dLat = t(c - a), dLon = t(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
export function cached(key, ttlMs) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < ttlMs) return c.data;
  return null;
}
export function setCache(key, data) { cache.set(key, { t: Date.now(), data: data }); }

export async function jsonFetch(url, opts, timeout) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout || 20000);
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
export function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise,
    new Promise((res) => { timer = setTimeout(() => res(fallback), ms); })
  ]).finally(() => clearTimeout(timer));
}

/* ---------- vị trí gần đúng theo IP ---------- */
export async function whereAmI() {
  const c = cached('whereami', 30 * 60 * 1000);
  if (c) return c;
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
    try { const d = await p(); setCache('whereami', d); return d; } catch (e) {}
  }
  throw new Error('không lấy được vị trí theo IP');
}

/* ---------- thời tiết ---------- */
export async function weather(lat, lng) {
  const key = 'w:' + lat.toFixed(2) + ',' + lng.toFixed(2);
  const c = cached(key, 15 * 60 * 1000);
  if (c) return c;
  const j = await jsonFetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
    '&current=temperature_2m,apparent_temperature,precipitation,weather_code,is_day,wind_speed_10m&timezone=auto', null, 12000);
  const cur = j.current || {}, code = Number(cur.weather_code);
  const rain = code >= 51 || Number(cur.precipitation) > 0.15;
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const storm = code >= 95;
  const out = {
    temp: cur.temperature_2m, feels: cur.apparent_temperature, code: code,
    desc: storm ? 'giông bão' : snow ? 'có tuyết' : rain ? (code >= 63 ? 'mưa to' : 'mưa nhẹ')
      : (code === 45 || code === 48) ? 'có sương mù' : code === 3 ? 'nhiều mây' : code === 2 ? 'ít mây' : code === 1 ? 'trời quang' : 'trời trong',
    rain: rain, snow: snow, storm: storm, isDay: cur.is_day === 1, wind: cur.wind_speed_10m, hour: new Date().getHours()
  };
  setCache(key, out);
  return out;
}

/* ---------- địa chỉ -> toạ độ ---------- */
export async function geocode(q) {
  const j = await jsonFetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=1', null, 12000);
  const f = (j.features || [])[0];
  if (!f) throw new Error('không tìm thấy địa chỉ');
  const pr = f.properties || {}, co = (f.geometry && f.geometry.coordinates) || [];
  if (co.length < 2) throw new Error('không có toạ độ');
  return { lat: co[1], lng: co[0], label: [pr.name, pr.street, pr.district, pr.city, pr.country].filter(Boolean).join(', ') };
}

/* ---------- Photon: quán theo tên món ---------- */
const FOOD = new Set(['restaurant', 'fast_food', 'cafe', 'food_court', 'ice_cream', 'bar', 'pub', 'bakery', 'deli', 'canteen']);
export async function photonSearch(query, lat, lng, radiusM, limit) {
  const dLat = radiusM / 111000;
  const dLng = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const bbox = (lng - dLng) + ',' + (lat - dLat) + ',' + (lng + dLng) + ',' + (lat + dLat);
  const j = await jsonFetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(query) +
    '&lat=' + lat + '&lon=' + lng + '&limit=' + (limit || 20) + '&bbox=' + bbox, null, 12000);
  const out = [];
  for (const f of (j.features || [])) {
    const pr = f.properties || {};
    const kind = String(pr.osm_value || pr.type || '').toLowerCase();
    if (pr.osm_key !== 'amenity' || !FOOD.has(kind)) continue;
    const co = (f.geometry && f.geometry.coordinates) || [];
    const name = pr.name || pr.street;
    if (!name || co.length < 2) continue;
    out.push({
      name: String(name).slice(0, 90), lat: co[1], lng: co[0], type: pr.osm_value || '',
      cuisine: (pr.extra && pr.extra.cuisine) || '',
      address: [pr.housenumber, pr.street, pr.district, pr.city].filter(Boolean).join(' '),
      phone: (pr.extra && (pr.extra.phone || pr.extra['contact:phone'])) || '',
      open: (pr.extra && pr.extra.opening_hours) || ''
    });
  }
  return out;
}

/* ---------- Overpass: quán gần nhất (tùy chọn, có thể bỏ) ---------- */
export async function overpassNear(lat, lng, rad) {
  const key = 'area:' + lat.toFixed(2) + ',' + lng.toFixed(2) + ':' + rad;
  const c = cached(key, 30 * 60 * 1000);
  if (c) return c;
  const q = '[out:json][timeout:20];(' +
    'node["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)"](around:' + rad + ',' + lat + ',' + lng + ');' +
    'way["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)"](around:' + rad + ',' + lat + ',' + lng + ');' +
    ');out center tags 400;';
  const eps = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let data = null, lastErr = null;
  for (const ep of eps) {
    try {
      data = await jsonFetch(ep, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, 20000);
      break;
    } catch (e) { lastErr = e; }
  }
  if (!data) throw new Error('Overpass: ' + ((lastErr && lastErr.message) || 'lỗi'));
  const list = [];
  for (const el of data.elements || []) {
    const tg = el.tags || {};
    const name = tg.name || tg['name:vi'] || tg['name:en'];
    if (!name) continue;
    const plat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const plng = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (plat == null || plng == null) continue;
    list.push({
      name: String(name).slice(0, 90), lat: plat, lng: plng, type: tg.amenity || '',
      cuisine: tg.cuisine || '', ncuisine: norm(tg.cuisine || ''),
      address: [tg['addr:housenumber'], tg['addr:street'], tg['addr:district'], tg['addr:city']].filter(Boolean).join(' '),
      phone: tg.phone || tg['contact:phone'] || ''
    });
  }
  setCache(key, list);
  return list;
}
