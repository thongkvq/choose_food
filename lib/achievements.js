// lib/achievements.js — THÀNH TỰU & CHUỖI NGÀY (thuần, không DOM, không dependency)
// Mọi thành tựu tính từ dữ liệu đã có: nhật ký (mgd.diary), món đã khám phá (mgd.seen),
// yêu thích (mgd.favs), thực đơn hôm nay (mgd.menu) + thuộc tính của món trong dishes-lite.
// Không đếm riêng gì mới, không ghi mạng, không làm chậm lúc quay (chỉ lọc vài mảng nhỏ).

export const DAY_MS = 864e5;
const VN_VUNG = ['bac', 'trung', 'nam', 'tay-nam-bo', 'tay-nguyen'];

export function dayKey(ts) {
  const d = new Date(ts || 0);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function sizeOf(x) { return x instanceof Set ? x.size : (Array.isArray(x) ? x.length : 0); }

// Món đã ăn theo nhật ký (bỏ id lạ/không còn trong dữ liệu), không trùng
export function eatenDishes(ctx) {
  const byId = ctx && ctx.byId;
  const out = [], seen = new Set();
  for (const it of (ctx && Array.isArray(ctx.diary) ? ctx.diary : [])) {
    if (!it || !it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    const d = byId ? byId(it.id) : null;
    if (d) out.push(d);
  }
  return out;
}

// Số ngày liên tiếp có ghi nhật ký (tính cả hôm nay nếu có)
export function maxDayStreak(diary) {
  const days = [...new Set((Array.isArray(diary) ? diary : []).filter((x) => x && x.ts).map((x) => dayKey(x.ts)))].sort();
  let best = 0, run = 0, prev = 0;
  for (const k of days) {
    const t = new Date(k + 'T00:00:00').getTime();
    run = (prev && Math.round((t - prev) / DAY_MS) === 1) ? run + 1 : 1;
    prev = t;
    if (run > best) best = run;
  }
  return best;
}

// Chuỗi ngày liên tiếp KHÔNG lặp món nào trong cả chuỗi (mỗi ngày phải có ít nhất 1 món)
export function noRepeatRun(diary) {
  const byDay = new Map();
  for (const x of (Array.isArray(diary) ? diary : [])) {
    if (!x || !x.id || !x.ts) continue;
    const k = dayKey(x.ts);
    if (!byDay.has(k)) byDay.set(k, new Set());
    byDay.get(k).add(x.id);
  }
  const keys = [...byDay.keys()].sort();
  let best = 0;
  for (let i = 0; i < keys.length; i++) {
    const used = new Set();
    let prev = 0, run = 0;
    for (let j = i; j < keys.length; j++) {
      const t = new Date(keys[j] + 'T00:00:00').getTime();
      if (prev && Math.round((t - prev) / DAY_MS) !== 1) break;
      const ids = [...byDay.get(keys[j])];
      if (ids.some((id) => used.has(id))) break;    // lặp món -> dừng chuỗi
      ids.forEach((id) => used.add(id));
      prev = t; run++;
      if (run > best) best = run;
    }
  }
  return best;
}

const countBy = (list, fn) => list.filter(fn).length;

/* 14 thành tựu. n(ctx) = tiến độ hiện tại; target = mốc mở khoá. */
export const ACHV = [
  { id: 'quay-dau', icon: '🎰', name: 'Lần quay đầu tiên', desc: 'Quay ra món ăn đầu tiên', target: 1,
    n: (c) => sizeOf(c.seen) },
  { id: 'kham-pha-50', icon: '🧭', name: 'Người khám phá', desc: 'Xem/khám phá 50 món', target: 50,
    n: (c) => sizeOf(c.seen) },
  { id: 'kham-pha-150', icon: '🗺️', name: 'Nhà thám hiểm ẩm thực', desc: 'Xem/khám phá 150 món', target: 150,
    n: (c) => sizeOf(c.seen) },
  { id: 'chot-5', icon: '✅', name: 'Chốt món đầu tay', desc: 'Chốt 5 món vào nhật ký', target: 5,
    n: (c) => (Array.isArray(c.diary) ? c.diary.length : 0) },
  { id: 'chot-20', icon: '🍽️', name: 'Ăn thật đấy', desc: 'Chốt 20 món vào nhật ký', target: 20,
    n: (c) => (Array.isArray(c.diary) ? c.diary.length : 0) },
  { id: 'du-5-vung', icon: '🇻🇳', name: 'Ăn đủ 5 vùng miền', desc: 'Đã ăn món gốc của cả 5 vùng Việt Nam', target: 5,
    n: (c) => new Set(eatenDishes(c).filter((d) => d.region === 'vn' && VN_VUNG.includes(d.vung)).map((d) => d.vung)).size },
  { id: 'quoc-te-10', icon: '🌏', name: 'Chốt 10 món quốc tế', desc: 'Đã ăn 10 món ngoài Việt Nam', target: 10,
    n: (c) => countBy(eatenDishes(c), (d) => d.region !== 'vn') },
  { id: 'dac-san-20', icon: '🏅', name: 'Thử 20 món đặc sản', desc: 'Đã ăn 20 món đặc sản địa phương', target: 20,
    n: (c) => countBy(eatenDishes(c), (d) => d.dacSan === true) },
  { id: 'chay-5', icon: '🌱', name: 'Ăn chay 5 món', desc: 'Đã ăn 5 món chay', target: 5,
    n: (c) => countBy(eatenDishes(c), (d) => d.veg === 1) },
  { id: 'chuoi-3', icon: '📅', name: 'Chuỗi 3 ngày', desc: 'Ghi nhật ký 3 ngày liên tiếp', target: 3,
    n: (c) => maxDayStreak(c.diary) },
  { id: 'chuoi-7', icon: '🔥', name: 'Chuỗi 7 ngày', desc: 'Ghi nhật ký 7 ngày liên tiếp', target: 7,
    n: (c) => maxDayStreak(c.diary) },
  { id: 'khong-lap-7', icon: '🔁', name: '7 ngày liền không lặp món', desc: 'Mỗi ngày một món khác nhau, 7 ngày liền', target: 7,
    n: (c) => noRepeatRun(c.diary) },
  { id: 'yeu-thich-10', icon: '♥', name: 'Bộ sưu tập 10 món', desc: 'Lưu 10 món vào yêu thích', target: 10,
    n: (c) => sizeOf(c.favs) },
  { id: 'du-3-bua', icon: '🍱', name: 'Đủ 3 bữa hôm nay', desc: 'Điền đủ sáng · trưa · tối cho thực đơn hôm nay', target: 3,
    n: (c) => ['sang', 'trua', 'toi'].filter((k) => c.menu && c.menu[k]).length }
];

// Tính tiến độ cho cả bộ (dùng cho panel Hôm nay + kiểm tra mở khoá)
export function computeAchv(ctx) {
  const c = ctx || {};
  return ACHV.map((a) => {
    let n = 0;
    try { n = Math.max(0, Math.round(Number(a.n(c)) || 0)); } catch (e) { n = 0; }
    const target = a.target;
    return {
      id: a.id, icon: a.icon, name: a.name, desc: a.desc,
      n: Math.min(n, target), raw: n, target: target,
      pct: Math.max(0, Math.min(100, Math.round(n / target * 100))),
      done: n >= target
    };
  });
}

// Khoá lưu: { unlocked: { '<id>': ts } }  (mgd.achv)
export function unlockedMap(store) {
  return (store && store.unlocked && typeof store.unlocked === 'object') ? store.unlocked : {};
}

// Thành tựu VỪA mở khoá (đã đạt nhưng chưa có trong khoá lưu) — dùng để toast 1 lần
export function newUnlocks(list, unlocked) {
  const u = unlocked || {};
  return (Array.isArray(list) ? list : []).filter((a) => a && a.done && !u[a.id]);
}

// Ghi thêm id vừa mở khoá vào khoá lưu, giữ thời điểm mở lần đầu
export function mergeUnlocked(store, ids, ts) {
  const base = (store && typeof store === 'object') ? store : {};
  const u = Object.assign({}, unlockedMap(base));
  const t = Number(ts) || Date.now();
  for (const id of (Array.isArray(ids) ? ids : [])) if (id && !u[id]) u[id] = t;
  return Object.assign({}, base, { unlocked: u });
}

export const achvCount = (list) => (Array.isArray(list) ? list.filter((a) => a && a.done).length : 0);
