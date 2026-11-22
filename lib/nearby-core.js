// ==========================================================================
// lib/nearby-core.js — LOGIC THUẦN dùng chung cho tìm quán gần đây.
// Không I/O, không DOM, không API Node: cả trình duyệt (app.js import './lib/…')
// lẫn server LAN (server.js import './lib/…') đều dùng đúng một bản.
// Trước đây phần này bị chép 3 nơi (server.js, 2 serverless function trong api/ — đã xoá, app.js)
// nên lệch nhau — điển hình: chọn 15km nhưng client vẫn chặn ở 10km.
// ==========================================================================

export const R_TIERS = [2500, 5000, 10000, 15000];   // 4 mức bán kính người dùng chọn
export const MAX_RADIUS = 15000;
export const DEFAULT_RADIUS = 5000;
export const MIN_RADIUS = 300;

// Loại địa điểm được coi là "quán ăn" (OSM amenity / shop)
export const FOOD_KINDS = ['restaurant', 'fast_food', 'cafe', 'food_court', 'ice_cream', 'bar', 'pub', 'bakery', 'deli', 'canteen'];

/* ---------- chuẩn hoá & khoảng cách ---------- */
export function norm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function distM(a, b, c, d) {
  const R = 6371000, t = (x) => x * Math.PI / 180;
  const dLat = t(c - a), dLon = t(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* ---------- mức bán kính ---------- */
export const snapTier = (v) => R_TIERS.find((t) => t >= v) || MAX_RADIUS;   // làm tròn LÊN mức gần nhất
export function clampRadius(asked) {
  const n = Number(asked);
  return snapTier(Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, isFinite(n) && n > 0 ? n : DEFAULT_RADIUS)));
}
export const ovBudgetFor = (rad) => (rad <= 2500 ? 5000 : rad <= 5000 ? 9000 : rad <= 10000 ? 15000 : 20000);
export const overpassLimit = (rad) => (rad <= 2500 ? 500 : rad <= 5000 ? 900 : rad <= 10000 ? 1600 : 2600);

/* ---------- khớp tên món ---------- */
export function dishWords(dish, kw) {
  return [...new Set((norm(dish) + ' ' + norm(kw)).split(' ').filter((t) => t.length >= 3))];
}
export function dishQueries(dish, kw) {
  return [...new Set([dish, String(kw || '').split('|')[0], dishWords(dish, kw).slice(0, 2).join(' ')]
    .filter((q) => q && q.trim().length >= 3))].slice(0, 3);
}
// Một địa điểm khớp món khi tên chứa từ khoá món, hoặc cùng nhóm ẩm thực
export function matchPlace(place, words, cuisineHint) {
  const n = norm(place.name);
  const cu = norm(cuisineHint);
  const hitName = words.filter((t) => n.includes(t));
  const hitCuisine = cu && norm(place.cuisine).includes(cu) ? [cu] : [];
  return { hitName, hitCuisine, ok: !!(hitName.length || hitCuisine.length) };
}
export const packMatched = (place, lat, lng, hit) => Object.assign({}, place, {
  dist: distM(lat, lng, place.lat, place.lng),
  score: hit.hitName.length * 3 + hit.hitCuisine.length * 2,
  hitName: hit.hitName, hitCuisine: hit.hitCuisine,
  maps: mapsDir(place.lat, place.lng)
});
export const sortMatched = (arr) => arr.sort((a, b) => (b.score - a.score) || (a.dist - b.dist));

/* ---------- bbox & URL ---------- */
export const mapsDir = (lat, lng) => 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng + '&travelmode=driving';
export function boxHalf(lat, radiusM) {
  const dLat = radiusM / 111000;
  return { dLat, dLng: radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))) };
}
// Photon: bbox = tây,nam,đông,bắc
export function photonBox(lat, lng, radiusM) {
  const dLat = radiusM / 111000;
  const dLng = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  return [(lng - dLng), (lat - dLat), (lng + dLng), (lat + dLat)].join(',');
}
export function photonSearchUrl(query, lat, lng, radiusM, limit) {
  return 'https://photon.komoot.io/api/?q=' + encodeURIComponent(query) +
    '&lat=' + lat + '&lon=' + lng + '&limit=' + (limit || 20) + '&bbox=' + photonBox(lat, lng, radiusM);
}
// Overpass: bbox = nam,tây,bắc,đông (KHÔNG dùng around: bán kính 10km bị trả 504)
export function overpassBox(lat, lng, rad) {
  const { dLat, dLng } = boxHalf(lat, rad);
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((v) => v.toFixed(6)).join(',');
}
export function overpassQuery(lat, lng, rad) {
  const box = overpassBox(lat, lng, rad);
  const am = '["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)"]';
  return '[out:json][timeout:25];(node' + am + '(' + box + ');way' + am + '(' + box + '););out center tags ' + overpassLimit(rad) + ';';
}
export const overpassGetUrl = (endpoint, lat, lng, rad) => endpoint + '?data=' + encodeURIComponent(overpassQuery(lat, lng, rad));

/* ---------- dựng dữ liệu quán (thuần) ---------- */
const sliced = (s) => String(s).slice(0, 90);
const addrOf = (t) => [t['addr:housenumber'], t['addr:street'], t['addr:district'], t['addr:city']].filter(Boolean).join(' ');
// id OSM dạng chuẩn hoá "N123"/"W456"/"R789" — Photon (osm_type+osm_id) và Overpass (type+id)
// phải ra CÙNG một chuỗi thì mới ghép được giờ mở cửa giữa hai nguồn.
export const osmKey = (type, id) => (type && id != null && id !== '')
  ? String(type).charAt(0).toUpperCase() + String(id) : '';

// Photon features -> quán (chỉ giữ chỗ là quán ăn)
export function placesFromPhoton(features) {
  const out = [];
  for (const f of (features || [])) {
    const pr = f.properties || {};
    const kind = String(pr.osm_value || pr.type || '').toLowerCase();
    if (pr.osm_key !== 'amenity' && !FOOD_KINDS.includes(kind)) continue;   // bỏ khu phố, công trình, cửa hàng…
    if (pr.osm_key === 'amenity' && !FOOD_KINDS.includes(kind)) continue;
    const co = (f.geometry && f.geometry.coordinates) || [];
    const name = pr.name || pr.street;
    if (!name || co.length < 2) continue;
    out.push({
      name: sliced(name), lat: co[1], lng: co[0], type: pr.osm_value || pr.type || '',
      cuisine: (pr.extra && pr.extra.cuisine) || '', ncuisine: norm((pr.extra && pr.extra.cuisine) || ''),
      nname: norm(name), osm: osmKey(pr.osm_type, pr.osm_id),
      address: [pr.housenumber, pr.street, pr.district, pr.city].filter(Boolean).join(' '),
      phone: (pr.extra && (pr.extra.phone || pr.extra['contact:phone'])) || '',
      open: (pr.extra && pr.extra.opening_hours) || ''
    });
  }
  return out;
}
export const photonSearchResult = (json) => placesFromPhoton(json && json.features);

// Overpass elements -> quán (kèm trường chuẩn hoá để chấm điểm "có tiếng")
export function poisFromOverpass(elements) {
  const list = [];
  for (const el of (elements || [])) {
    const tg = el.tags || {};
    const name = tg.name || tg['name:vi'] || tg['name:en'];
    if (!name) continue;
    const plat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const plng = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (plat == null || plng == null) continue;
    list.push({
      name: sliced(name), lat: plat, lng: plng, type: tg.amenity || '',
      cuisine: tg.cuisine || '', nname: norm(name), ncuisine: norm(tg.cuisine || ''),
      osm: osmKey(el.type, el.id),
      address: addrOf(tg), phone: tg.phone || tg['contact:phone'] || '', open: tg.opening_hours || '',
      brand: tg.brand || tg.operator || '', website: tg.website || tg['contact:website'] || '',
      wiki: tg.wikidata || tg.wikipedia || ''   // có hồ sơ bách khoa = dấu hiệu nổi tiếng thật
    });
  }
  return list;
}

/* ---------- giờ mở cửa: ghép Photon ↔ Overpass ----------
   Photon chỉ trả opening_hours khi tag có trong extra; Overpass (OSM tags) thì hay có.
   Ghép khi: cùng id OSM, hoặc tên chuẩn hoá giống nhau + cách nhau ≤ 60 m.
   Không ghép được -> coi là "chưa rõ giờ" (đừng đoán). */
export const HOURS_MATCH_M = 60;
// chỉ giữ quán CÓ giờ mở cửa -> index nhỏ, cache localStorage được (mgd.fame)
export function hoursIndex(pois) {
  const out = [];
  for (const p of (pois || [])) {
    if (!p || !p.open) continue;
    const n = p.nname || norm(p.name);
    if (!p.osm && !n) continue;
    out.push({ o: p.osm || '', n: n, lat: p.lat, lng: p.lng, h: String(p.open) });
  }
  return out;
}
export function openForPlace(place, index) {
  if (!place) return '';
  if (place.open) return place.open;                       // Photon đã có sẵn
  if (!index || !index.length) return '';
  if (place.osm) {
    for (const e of index) if (e.o && e.o === place.osm) return e.h;
  }
  const n = place.nname || norm(place.name);
  if (!n || !isFinite(place.lat) || !isFinite(place.lng)) return '';
  for (const e of index) {
    if (e.n !== n) continue;
    if (!isFinite(e.lat) || !isFinite(e.lng)) continue;
    if (distM(place.lat, place.lng, e.lat, e.lng) <= HOURS_MATCH_M) return e.h;
  }
  return '';
}
// điền p.open cho danh sách quán (không sửa object gốc)
export function attachHours(places, index) {
  return (places || []).map((p) => (p.open ? p : Object.assign({}, p, { open: openForPlace(p, index) })));
}

/* ---------- "quán có tiếng" ----------
   OSM không có sao/đánh giá của khách, nên "có tiếng" = dấu hiệu tin cậy được.
   KHÔNG phải điểm đánh giá của thực khách — UI ghi rõ điều này. */
export function fameScore(p, branches) {
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
export function branchCounts(list) {
  const m = new Map();
  for (const p of list) m.set(p.nname, (m.get(p.nname) || 0) + 1);
  return m;
}
// Gộp các chi nhánh cùng tên thành 1 dòng (giữ chi nhánh gần nhất, kèm số chi nhánh)
export function dedupByName(arr, counts) {
  const by = new Map();
  for (const p of arr) {
    const cur = by.get(p.nname);
    if (!cur || p.dist < cur.dist) by.set(p.nname, p);
  }
  return [...by.values()].map((p) => Object.assign({}, p, { branches: counts.get(p.nname) || 1 }));
}
export const filterByRadius = (list, rad) => list.filter((p) => p.dist <= rad);
export const withDistance = (list, lat, lng) => list.map((p) => Object.assign({}, p, { dist: distM(lat, lng, p.lat, p.lng) }));
export const sortByFame = (arr) => arr.sort((a, b) => (b.fame - a.fame) || (a.dist - b.dist));

export function packPoi(p, counts) {
  const f = fameScore(p, counts.get(p.nname) || 1);
  return {
    name: p.name, dist: p.dist, type: p.type, cuisine: p.cuisine, address: p.address, phone: p.phone,
    open: p.open || '', brand: p.brand || '', website: p.website || '',
    // lat/lng/osm: cần để LƯU QUÁN (chỉ đường) và để biết giờ mở cửa ghép đúng quán
    lat: p.lat, lng: p.lng, osm: p.osm || '',
    fame: f.s, why: f.why, branches: p.branches || counts.get(p.nname) || 1,
    maps: p.maps || mapsDir(p.lat, p.lng)
  };
}
// 2 danh sách "quán có tiếng": khớp món (≥4) và quanh đây (≥5)
export function fameLists(pois, lat, lng, radiusM, dish, kw, cuisine) {
  const counts = branchCounts(pois);
  const words = dishWords(dish, kw);
  const cu = norm(cuisine);
  const near = withDistance(pois, lat, lng).filter((p) => p.dist <= radiusM)
    .map((p) => { const f = fameScore(p, counts.get(p.nname) || 1); return Object.assign(p, { fame: f.s, why: f.why }); });
  const famousMatch = dedupByName(sortByFame(near.filter((p) => p.fame >= 4 &&
    (words.some((t) => p.nname.includes(t)) || (cu && p.ncuisine.includes(cu))))), counts).slice(0, 8);
  const famousNear = dedupByName(sortByFame(near.filter((p) => p.fame >= 5)), counts).slice(0, 10);
  return { famousMatch, famousNear };
}

/* ---------- URL ngoài ---------- */
export function nearbyUrls(lat, lng, dish) {
  const q = String(dish || '');
  return {
    mapsUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(q + ' gần đây') + '/@' + lat + ',' + lng + ',13z',
    mapsKeywordUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(q) + '/@' + lat + ',' + lng + ',13z',
    osmUrl: 'https://www.openstreetmap.org/#map=14/' + lat + '/' + lng
  };
}
