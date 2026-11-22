// ==========================================================================
// lib/saved-places.js — "quán đã lưu" (mgd.savedPlaces): hàm THUẦN, không DOM.
// app.js lưu/đọc localStorage, module này chỉ chuẩn hoá + thêm/bớt/sửa.
// Một quán lưu gồm:
//   { key, name, address, lat, lng, osm, open, dishes[], note, ts, maps }
//   open  = chuỗi opening_hours OSM ('' = chưa rõ) — trạng thái mở/đóng tính lại mỗi lần hiện
//   dishes= id món đã tìm ra quán này (đã đi qua idNow() ở app.js)
// ==========================================================================

export const SAVED_MAX = 120;        // chặn phình localStorage
export const NOTE_MAX = 160;

export function placeKey(p) {
  if (!p) return '';
  if (p.key) return String(p.key);
  if (p.osm) return 'osm:' + p.osm;
  const n = String(p.name == null ? '' : p.name).trim().toLowerCase();
  if (!n) return '';
  const lat = Number(p.lat), lng = Number(p.lng);
  if (!isFinite(lat) || !isFinite(lng)) return 'name:' + n;
  return 'geo:' + lat.toFixed(5) + ',' + lng.toFixed(5);
}

// bỏ id món trùng / rỗng, giới hạn số lượng
function cleanIds(a) {
  const out = [];
  for (const x of (Array.isArray(a) ? a : [])) {
    const v = String(x == null ? '' : x).trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 60);
}
export function cleanNote(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
}

// chuẩn hoá 1 bản ghi đọc từ localStorage (dữ liệu cũ có thể thiếu trường)
export function normalizePlace(p) {
  if (!p || typeof p !== 'object') return null;
  const name = String(p.name == null ? '' : p.name).trim().slice(0, 90);
  if (!name) return null;
  const lat = Number(p.lat), lng = Number(p.lng);
  const out = {
    name: name,
    address: String(p.address == null ? '' : p.address).trim().slice(0, 160),
    lat: isFinite(lat) ? lat : null,
    lng: isFinite(lng) ? lng : null,
    osm: p.osm ? String(p.osm).slice(0, 40) : '',
    open: p.open ? String(p.open).slice(0, 160) : '',
    dishes: cleanIds(p.dishes),
    note: cleanNote(p.note),
    ts: isFinite(Number(p.ts)) && Number(p.ts) > 0 ? Number(p.ts) : Date.now(),
    maps: p.maps ? String(p.maps).slice(0, 400) : ''
  };
  out.key = placeKey(out);
  if (!out.key) return null;
  if (!out.maps && out.lat != null && out.lng != null) {
    out.maps = 'https://www.google.com/maps/dir/?api=1&destination=' + out.lat + ',' + out.lng + '&travelmode=driving';
  }
  return out;
}
export function loadSaved(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [], seen = new Set();
  for (const it of arr) {
    const p = normalizePlace(it);
    if (!p || seen.has(p.key)) continue;
    seen.add(p.key); out.push(p);
  }
  return out.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, SAVED_MAX);
}
export const hasSaved = (list, key) => (Array.isArray(list) ? list : []).some((p) => p.key === key);

// lưu quán (đã lưu rồi thì chỉ bổ sung món + nâng cấp giờ mở cửa nếu mới có)
export function addSaved(list, place, dishId) {
  const arr = loadSaved(list);
  const p = normalizePlace(place);
  if (!p) return arr;
  const i = arr.findIndex((x) => x.key === p.key);
  if (i >= 0) {
    const cur = arr[i];
    cur.dishes = cleanIds([...(dishId ? [dishId] : []), ...cur.dishes]);
    if (!cur.open && p.open) cur.open = p.open;
    if (!cur.address && p.address) cur.address = p.address;
    if (!cur.note && p.note) cur.note = p.note;
    return arr;
  }
  if (dishId) p.dishes = cleanIds([dishId, ...p.dishes]);
  return [p, ...arr].slice(0, SAVED_MAX);
}
export function removeSaved(list, key) {
  return loadSaved(list).filter((p) => p.key !== key);
}
export function toggleSaved(list, place, dishId) {
  const key = placeKey(place);
  return hasSaved(list, key) ? { list: removeSaved(list, key), saved: false, key: key }
    : { list: addSaved(list, place, dishId), saved: true, key: key };
}
export function setNote(list, key, note) {
  const arr = loadSaved(list);
  const hit = arr.find((p) => p.key === key);
  if (hit) hit.note = cleanNote(note);
  return arr;
}
// gắn thêm 1 id món vào quán đã lưu (khi tìm quán từ popup món khác)
export function attachDish(list, key, dishId) {
  const arr = loadSaved(list);
  const hit = arr.find((p) => p.key === key);
  if (hit && dishId) hit.dishes = cleanIds([dishId, ...hit.dishes]);
  return arr;
}
export function savedForDish(list, dishId) {
  if (!dishId) return [];
  return loadSaved(list).filter((p) => p.dishes.includes(String(dishId)));
}
export function savedDishIds(list) {
  const s = new Set();
  for (const p of loadSaved(list)) for (const id of p.dishes) s.add(id);
  return s;
}
