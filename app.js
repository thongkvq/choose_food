// ==========================================================================
// MÓN GÌ ĐÂY? — app.js (mobile-first)
// Băng chuyền ngang, hãm phanh 2 pha, rung + âm thanh, filter sheet, dock ngón cái
// ==========================================================================
import { renderArt } from './art.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const IS_TOUCH = matchMedia('(hover: none)').matches || 'ontouchstart' in window;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW_END = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 4;

const R_TIERS = [2500, 5000, 10000, 15000];   // 4 mức bán kính tìm quán cho người dùng chọn
const MEALS = { sang: 'Sáng 🌅', trua: 'Trưa ☀️', xe: 'Xế 🌤️', toi: 'Tối 🌙', khuya: 'Khuya 🌌', vat: 'Ăn vặt 🍿' };
const REGIONS = { vn: 'Việt 🇻🇳', cn: 'Trung Hoa 🇨🇳', jp: 'Nhật 🇯🇵', kr: 'Hàn 🇰🇷', th: 'Thái 🇹🇭', it: 'Ý 🇮🇹', fr: 'Âu 🇫🇷', us: 'Mỹ 🇺🇸', mx: 'Mexico 🇲🇽', in: 'Ấn 🇮🇳', tr: 'Trung Đông 🇹🇷' };
// Vùng miền Việt Nam — bộ lọc theo nơi món ĐANG CÓ BÁN, không chỉ nơi món ra đời
const VUNG = {
  bac: 'Miền Bắc 🏯', trung: 'Miền Trung 🌾', nam: 'Miền Nam 🏙️',
  'tay-nam-bo': 'Miền Tây Nam Bộ 🛶', 'tay-nguyen': 'Tây Nguyên ☕',
  vn: 'Cả nước 🇻🇳', ngoai: 'Ngoài Việt Nam 🌍'
};
const VN_VUNG_KEYS = ['bac', 'trung', 'nam', 'tay-nam-bo', 'tay-nguyen'];
const VUNG_CHIPS = { bac: VUNG.bac, trung: VUNG.trung, nam: VUNG.nam,
  'tay-nam-bo': VUNG['tay-nam-bo'], 'tay-nguyen': VUNG['tay-nguyen'], vn: VUNG.vn, ngoai: VUNG.ngoai };
const vungLabel = (k) => VUNG[k] || k || '—';
// Miền Nam bao gồm miền Tây Nam Bộ; món phổ biến có vungCo[] để hiện ở nhiều vùng.
const VUNG_INCLUDE = { nam: ['nam', 'tay-nam-bo'] };
const VUNG_AVAIL = { bac: 'Miền Bắc', trung: 'Miền Trung', nam: 'Miền Nam', 'tay-nam-bo': 'Miền Tây Nam Bộ', 'tay-nguyen': 'Tây Nguyên' };
const STYLES = { nuoc: 'Món nước 🍜', kho: 'Món khô 🥡', chien: 'Chiên 🍳', nuong: 'Nướng 🔥', hap: 'Hấp 🥟', tron: 'Trộn 🥗', cuon: 'Cuộn 🌯', lau: 'Lẩu 🍲', ngot: 'Ngọt 🍰', uong: 'Đồ uống 🥤' };
const TIERS = {
  1: { name: 'Phổ Thông', short: 'R', w: 45, color: '#8c98a8', glow: 'rgba(140,152,168,.45)' },
  2: { name: 'Ngon', short: 'SR', w: 30, color: '#00f2a9', glow: 'rgba(0,242,169,.5)' },
  3: { name: 'Đặc Sắc', short: 'SSR', w: 18, color: '#b05cf8', glow: 'rgba(176,92,248,.6)' },
  4: { name: 'Huyền Thoại', short: 'UR', w: 7, color: '#ffbe2e', glow: 'rgba(255,190,46,.75)' }
};
const THUMB_LADDER = [500, 960, 1280];   // Wikimedia chi phuc vu 3 bac nay (320/640/800 tra 400)
const thumb = (u, w) => { if (!u) return u; const t = THUMB_LADDER.find(s => s >= w) || 1280; return u.replace(/\/(\d+)px-/, '/' + t + 'px-'); };

let ALL = [];
const state = {
  meals: new Set(), regions: new Set(), styles: new Set(),
  vung: new Set(Array.isArray(LS.get('mgd.vungSelection', [])) ? LS.get('mgd.vungSelection', []) : []),
  vungGocOnly: LS.get('mgd.vungGocOnly', false),
  vungManual: LS.get('mgd.vungManual', false),
  vungGeo: LS.get('mgd.vungGeo', null),
  autoVung: LS.get('mgd.autoVung', true),
  veg: false, mild: false, topRated: false, price: 4, time: 300, q: '', preset: null,
  mealAuto: false,   // bữa ăn do đồng hồ tự chọn (được phép tự bỏ khi vùng miền không có món nào)
  vnOnly: LS.get('mgd.vnOnly', true),   // mặc định BẬT: chỉ món Việt, ẩn món nước ngoài
  radius: R_TIERS.includes(LS.get('mgd.radius', 5000)) ? LS.get('mgd.radius', 5000) : 5000,   // bán kính tìm quán (m) người dùng chọn
  favs: LS.get('mgd.favs', []), hist: LS.get('mgd.hist', []), seen: new Set(LS.get('mgd.seen', [])),
  sound: LS.get('mgd.sound', true), pity: LS.get('mgd.pity', 0),
  lastWinner: null, spinning: false
};
function vungCandidates(d) {
  if (!d || d.region !== 'vn' || d.vung === 'ngoai') return [];
  // Chỉ đặc sản gốc: dùng nơi món ra đời; mặc định: dùng nơi món đang bán.
  if (state.vungGocOnly) return d.vung ? [d.vung] : [];
  return Array.isArray(d.vungCo) && d.vungCo.length ? d.vungCo : (d.vung ? [d.vung] : []);
}
function vungAvailable(d, k) {
  if (!d) return false;
  if (k === 'ngoai') return d.region !== 'vn' || d.vung === 'ngoai';
  // Giữ "Cả nước" = 62 món có vùng gốc vn; không nhầm với vungCo (5 vùng).
  if (k === 'vn') return d.region === 'vn' && d.vung === 'vn';
  const available = vungCandidates(d);
  const wanted = k === 'nam' ? ['nam', 'tay-nam-bo'] : [k];
  return wanted.some(x => available.includes(x));
}
function vungMatchesKey(d, k) { return vungAvailable(d, k); }
function vungAvailabilityKeys(d) {
  if (!d || d.region !== 'vn') return [];
  const keys = Array.isArray(d.vungCo) ? d.vungCo.filter(k => VN_VUNG_KEYS.includes(k)) : [];
  return [...new Set(keys.length ? keys : (d.vung ? [d.vung] : []))];
}
function vungSummary(d) {
  const keys = vungAvailabilityKeys(d);
  if (!keys.length) return d && d.vung ? vungLabel(d.vung) : '';
  if (VN_VUNG_KEYS.every(k => keys.includes(k))) return 'Cả nước';
  return keys.map(vungLabel).join(', ');
}
function vungHit(d) {
  // Giữ tương thích với hook cũ nếu ai gọi vungHit('bac') trực tiếp.
  if (typeof d === 'string') return !state.vung.size || [...state.vung].some(k => k === d || (VUNG_INCLUDE[k] || []).includes(d));
  if (!state.vung.size) return true;
  for (const k of state.vung) if (vungAvailable(d, k)) return true;
  return false;
}
// Mapper địa điểm Việt Nam: ưu tiên tên tỉnh/thành cụ thể, không fuzzy broad match.
const VN_COUNTRY_CODES = new Set(['vn']);
const VN_COUNTRY_NAMES = new Set(['vietnam', 'viet nam', 'vn']);
const VUNG_PLACE_RULES = [
  { key: 'tay-nam-bo', names: ['can tho', 'cantho', 'an giang', 'kien giang', 'dong thap', 'tien giang', 'vinh long', 'ben tre', 'tra vinh', 'soc trang', 'bac lieu', 'ca mau', 'hau giang', 'long an'] },
  { key: 'tay-nguyen', names: ['da lat', 'dalat', 'lam dong', 'lamdong', 'buon ma thuot', 'buonmathuot', 'dak lak', 'daklak', 'dak nong', 'daknong', 'gia lai', 'gialai', 'kon tum', 'kontum', 'pleiku'] },
  { key: 'nam', names: ['ho chi minh city', 'ho chi minh', 'tp ho chi minh', 'tphcm', 'hcmc', 'sai gon', 'saigon', 'ba ria', 'vung tau', 'dong nai', 'binh duong', 'binh phuoc', 'tay ninh', 'long an'] },
  { key: 'trung', names: ['thanh hoa', 'nghe an', 'ha tinh', 'quang binh', 'quang tri', 'thua thien hue', 'hue', 'da nang', 'quang nam', 'hoi an', 'quang ngai', 'binh dinh', 'quy nhon', 'phu yen', 'khanh hoa', 'nha trang', 'ninh thuan', 'phan rang', 'binh thuan', 'phan thiet'] },
  { key: 'bac', names: ['ha noi', 'hanoi', 'ha noi municipality', 'hai phong', 'quang ninh', 'bac ninh', 'bac giang', 'hai duong', 'hung yen', 'thai binh', 'nam dinh', 'ninh binh', 'ha nam', 'vinh phuc', 'phu tho', 'tuyen quang', 'ha giang', 'cao bang', 'bac kan', 'lang son', 'thai nguyen', 'lao cai', 'yen bai', 'dien bien', 'lai chau', 'son la', 'hoa binh'] }
];
function isVietnamPlace(info) {
  const code = dirNorm(info && (info.countryCode || info.country_code || ''));
  const country = dirNorm(info && info.country || '');
  if (code && !VN_COUNTRY_CODES.has(code)) return false;
  if (country && !VN_COUNTRY_NAMES.has(country)) return false;
  // GPS path marks Vietnam explicitly; name-only test remains conservative.
  if (!code && !country) return false;
  return true;
}
function placeHaystack(info) {
  const values = [info && info.city, info && info.region, info && info.state, info && info.county, info && info.label].filter(Boolean);
  const normalized = values.map(v => dirNorm(v)).join(' ');
  const compact = values.map(v => dirNorm(v).replace(/\s+/g, '')).join(' ');
  return ' ' + normalized + ' ' + compact + ' ';
}
function vungFromPlace(info) {
  if (!info || !isVietnamPlace(info)) return null;
  const h = placeHaystack(info);
  for (const rule of VUNG_PLACE_RULES) {
    if (rule.names.some(name => h.includes(' ' + dirNorm(name) + ' '))) return rule.key;
  }
  return null;
}
function vungFromCoords(lat, lng, info) {
  if (!isVietnamPlace(info || {}) || !isFinite(lat) || !isFinite(lng)) return null;
  // BBox Việt Nam, sau đó dùng vùng địa lý gần đúng khi reverse geocode không có tên.
  if (lat < 8.1 || lat > 23.5 || lng < 102.0 || lng > 109.7) return null;
  if (lng >= 107.2 && lng <= 108.8 && lat >= 11.4 && lat <= 15.5) return 'tay-nguyen';
  if (lat <= 10.8 && lng <= 106.6) return 'tay-nam-bo';
  if (lat >= 20.0) return 'bac';
  if (lat >= 10.3 && lng >= 106.3 && lng <= 108.2) return 'nam';
  return 'trung';
}
function placeLabel(info) {
  return String((info && (info.label || [info.city, info.region].filter(Boolean).join(', '))) || 'vị trí của bạn');
}

/* ============================ ÂM THANH ============================ */
let AC = null, audioReady = false;
function unlockAudio() {
  if (audioReady) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    audioReady = true;
  } catch {}
}
document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
document.addEventListener('pointerdown', unlockAudio, { once: true });

function tone(f, dur = .1, type = 'sine', gain = .05, delay = 0) {
  if (!state.sound || !audioReady) return;
  try {
    const t0 = AC.currentTime + delay;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + .02);
  } catch {}
}
let lastTick = 0;
const sfx = {
  tick() {
    const now = performance.now();
    if (now - lastTick < 45) return;           // chống dội âm thanh khi quay nhanh
    lastTick = now;
    tone(560 + Math.random() * 220, .03, 'triangle', .022);
  },
  lever() { tone(180, .16, 'sawtooth', .045); tone(120, .22, 'triangle', .045, .05); },
  fall() { tone(500, .25, 'sine', .035); },
  win(tier) {
    const notes = { 1: [523, 659], 2: [523, 659, 784], 3: [587, 740, 880, 1175], 4: [659, 831, 988, 1319, 1661] }[tier] || [523, 659];
    notes.forEach((f, i) => tone(f, .3, 'triangle', .07, i * .07));
  },
  click() { tone(600, .04, 'sine', .025); }
};
function buzz(pattern) { if (IS_TOUCH && navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} } }

/* ============================ CONFETTI ============================ */
const fx = $('#fx'), ctx = fx.getContext('2d');
let parts = [], fxRunning = false;
function sizeFx() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);   // chặn DPR cao cho nhẹ máy
  fx.width = Math.floor(innerWidth * dpr); fx.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', sizeFx, { passive: true });
addEventListener('orientationchange', () => setTimeout(sizeFx, 250));
sizeFx();

function burst(x, y, n, colors) {
  if (REDUCED) return;
  const scale = innerWidth < 700 ? .5 : innerWidth < 1024 ? .75 : 1;
  const count = Math.round((n || 70) * scale * (LOW_END ? .7 : 1));
  const cols = colors || ['#ff5722', '#ffbe2e', '#00f2a9', '#b05cf8', '#22d3ee'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3.5, r: 3 + Math.random() * 4,
      c: cols[(Math.random() * cols.length) | 0], life: 1, sq: Math.random() < .5, rot: Math.random() * 6, vr: (Math.random() - .5) * .3 });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(loop); }
}
function loop() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += .22; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.life -= .012; p.rot += p.vr;
    if (p.life <= 0 || p.y > innerHeight + 40) { parts.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    if (p.sq) ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2);
    else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }
  if (parts.length) requestAnimationFrame(loop);
  else { ctx.clearRect(0, 0, innerWidth, innerHeight); fxRunning = false; }
}

/* ============================ TIỆN ÍCH ============================ */
let toastTimer;
function toast(html, ms = 2300) {
  const t = $('#toastNotification');
  t.innerHTML = html; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
const dishById = (id) => ALL.find(d => d.id === id);
// sao 0–5 (bước 0.5) + điểm số
function starsHtml(r) {
  const v = Math.max(0, Math.min(5, Number(r) || 0));
  const full = Math.floor(v), half = v - full >= 0.5;
  return '★'.repeat(full) + (half ? '⯨' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
}
// Mọi trường đều có giá trị dự phòng: dữ liệu cũ/thiếu cũng KHÔNG được làm popup lỗi
function scoreBlock(d) {
  const r = Number(d.rating);
  if (!isFinite(r) || r <= 0) return '';
  const tone = r >= 9 ? 'top' : r >= 8.5 ? 'great' : r >= 8 ? 'good' : 'ok';
  return '<div class="score ' + tone + '">' +
      '<div class="score-num">' + r.toFixed(1) + '<small>/10</small></div>' +
      '<div class="score-stars">' + starsHtml(d.stars != null ? d.stars : Math.round(r / 2 * 2) / 2) + '</div>' +
    '</div>';
}
function infoGrid(d) {
  const rows = [];
  const full = Math.max(0, Math.min(5, Number(d.fullness) || 0));
  if (d.calories) rows.push(['🔥', 'Năng lượng', d.calories + ' kcal <i>(ước tính/phần)</i>']);
  if (d.protein) rows.push(['💪', 'Đạm', d.protein + ' g' + (d.proteinLabel ? ' · ' + d.proteinLabel : '')]);
  if (full) rows.push(['🍚', 'Độ no', '●'.repeat(full) + '○'.repeat(5 - full) + ' (' + full + '/5)']);
  if (d.priceRange) rows.push(['💵', 'Giá tham khảo', d.priceRange]);
  if (d.region === 'vn' && (d.vung || vungAvailabilityKeys(d).length)) {
    const sold = vungSummary(d);
    const origin = d.vung && d.vung !== 'vn' && d.vung !== 'ngoai' ? ' · gốc ' + vungLabel(d.vung) : '';
    rows.push(['🗺️', 'Vùng miền', esc('Có bán: ' + sold + origin)]);
  } else if (d.vung) rows.push(['🗺️', 'Vùng miền', esc(vungLabel(d.vung))]);
  if (d.origin) rows.push(['📍', 'Xuất xứ', esc(d.origin)]);
  if (d.bestTime) rows.push(['⏰', 'Ngon nhất', d.bestTime]);
  const f = d.facts || {};
  if (f.originCountry) rows.push(['🌐', 'Quốc gia gốc', esc(f.originCountry)]);
  if (f.cuisine) rows.push(['🍽️', 'Nền ẩm thực', esc(f.cuisine)]);
  if (f.ingredients && f.ingredients.length) rows.push(['🥢', 'Nguyên liệu chính', esc(f.ingredients.join(', '))]);
  if (f.type) rows.push(['🏷️', 'Loại món', esc(f.type)]);
  rows.push(['🍳', 'Cách chế biến', (STYLES[d.style] || d.style || '—')]);
  rows.push(['🌏', 'Ẩm thực', (REGIONS[d.region] || d.region || '—')]);
  rows.push(['⏱️', 'Thời gian', (d.minutes || '?') + ' phút' + (d.spicy > 0 ? ' · ' + '🌶️'.repeat(d.spicy) : ' · không cay')]);
  const row = (r) => '<div class="info-row"><span class="ic">' + r[0] + '</span><span class="k">' + r[1] + '</span><span class="v">' + r[2] + '</span></div>';
  const HEADN = (typeof innerHeight === 'number' && innerHeight < 760) ? 4 : 6;   // màn thấp: chỉ hiện 4 dòng đầu
  const head = rows.slice(0, HEADN), rest = rows.slice(HEADN);
  return '<div class="info-grid">' + head.map(row).join('') +
    (rest.length
      ? '<div class="info-more" id="infoMore" hidden>' + rest.map(row).join('') + '</div>' +
        '<button class="info-toggle" data-act="rows">＋ Xem thêm ' + rest.length + ' thông tin ▾</button>'
      : '') +
    '</div>';
}
// ===== Tìm quán gần đây: ưu tiên GPS (nếu trang chạy https/localhost), không thì lấy vị trí theo IP =====
const CUISINE_BY_REGION = {
  vn: 'vietnamese', cn: 'chinese', jp: 'japanese', kr: 'korean', th: 'thai',
  it: 'italian', fr: 'french', us: 'american', mx: 'mexican', in: 'indian', tr: 'turkish'
};
let positionPromise = null;
function getPosition() {
  if (positionPromise) return positionPromise;
  const p = (async () => {
    // GPS chỉ chạy trên https hoặc localhost; qua LAN http sẽ bị chặn -> dùng IP
    if (navigator.geolocation && window.isSecureContext) {
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000, maximumAge: 300000, enableHighAccuracy: false }));
        return { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps', acc: Math.round(pos.coords.accuracy), country: 'Vietnam', countryCode: 'vn' };
      } catch (e) { /* rơi xuống IP */ }
    }
    const j = await apiJSON('/api/whereami', dirWhereAmI);
    if (!isFinite(j.lat)) throw new Error(j.error || 'không có toạ độ');
    return { lat: j.lat, lng: j.lng, source: 'ip', city: j.city, region: j.region, country: j.country, countryCode: j.countryCode || j.country_code };
  })();
  positionPromise = p;
  p.catch(() => { if (positionPromise === p) positionPromise = null; });
  return p;
}
function money() { return ''; }
let nearbyControlsMemo = '';
// người dùng nhập địa chỉ hoặc "lat,lng"
async function locateManual(text) {
  const t = String(text || '').trim();
  const m = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (m) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      return { lat, lng, source: 'manual', label: 'toạ độ bạn nhập' };
  }
  const j = await apiJSON('/api/geocode?q=' + encodeURIComponent(t), () => dirGeocode(t));
  if (j.error) throw new Error(j.error);
  return { lat: j.lat, lng: j.lng, source: 'manual', label: j.label };
}

function radiusChipsHTML() {
  return '<div class="rad-row" role="radiogroup" aria-label="Bán kính tìm quán">' +
    '<span class="rad-lbl">Tìm trong</span>' +
    R_TIERS.map((r) => '<button class="rad-chip' + (state.radius === r ? ' on' : '') + '" data-act="rad" data-rad="' + r + '"' +
      ' aria-checked="' + (state.radius === r) + '" role="radio">' + (r / 1000) + 'km</button>').join('') +
    '</div>';
}
function paintRadiusChips() {
  $$('#nearbyOut .rad-chip').forEach((c) => {
    const on = +c.dataset.rad === state.radius;
    c.classList.toggle('on', on); c.setAttribute('aria-checked', String(on));
  });
}
function setRadius(v) {
  if (!R_TIERS.includes(v) || v === state.radius) return;
  state.radius = v; LS.set('mgd.radius', v);
  nearbyControlsMemo = nearbyControlsHTML();   // dựng lại thanh chọn để chip đúng mức mới
  paintRadiusChips(); sfx.click(); buzz(8);
  toast('🔎 Tìm quán trong bán kính <b>' + (v / 1000) + 'km</b>');
  if (state.lastNearbyDish) findNearby(state.lastNearbyDish, state.loc || null, true);
}

function nearbyControlsHTML() {
  const httpsUrl = 'https://' + location.hostname + ':8443' + (location.pathname || '/');
  const secure = window.isSecureContext;
  return radiusChipsHTML() +
    '<div class="loc-row">' +
      '<input id="locInput" type="text" inputmode="text" placeholder="Nhập địa chỉ hoặc lat,lng…" autocomplete="off">' +
      '<button class="loc-go" data-act="loc-go">Tìm</button>' +
    '</div>' +
    (secure ? '' :
      '<div class="nearby-note">⚠️ Trang đang chạy <b>http</b> nên trình duyệt chặn GPS — đang dùng vị trí gần đúng theo IP. ' +
      'Muốn dùng <b>toạ độ chính xác của máy</b>: <a class="loc-https" href="' + esc(httpsUrl) + '">mở bản HTTPS</a> ' +
      '(bấm "Nâng cao" → "Tiếp tục truy cập" khi trình duyệt cảnh báo chứng chỉ).</div>');
}

function renderNearbyHeader(pos) {
  const src = pos.source === 'gps' ? ('GPS' + (pos.acc ? ' ±' + pos.acc + 'm' : ''))
    : pos.source === 'manual' ? 'bạn nhập'
    : ('theo IP' + (pos.city ? ' · ' + pos.city : ''));
  return '<div class="loc-info">📍 Vị trí đang dùng: <b>' + esc(src) + '</b>' +
    '<span class="loc-coord">' + pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5) + '</span>' +
    (pos.label ? '<span class="loc-label">' + esc(String(pos.label).slice(0, 90)) + '</span>' : '') + '</div>';
}

/* ---- QUÁN CÓ TIẾNG (miễn phí, dữ liệu mở OSM) ----
   Bản có server: server chấm sẵn. Bản tĩnh (Vercel): tự gọi Overpass bằng GET
   (Overpass có gửi Access-Control-Allow-Origin: * cho GET) rồi chấm y hệt. */
// Đo thật từ trình duyệt: overpass-api.de bị CORS chặn (net::ERR_FAILED), kumi chạy được;
// private.coffee trả XML lỗi, osm.ch chỉ có dữ liệu Thuỵ Sĩ -> chỉ giữ 2 cái dùng được.
const FAME_SRC = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const FAME_TTL = 6 * 60 * 60 * 1000;   // cache 6 giờ: bản tĩnh gọi Overpass khá chậm
function fameCacheKey(lat, lng, r, dish) { return lat.toFixed(2) + ',' + lng.toFixed(2) + ',' + r + ',' + dirNorm(dish); }
function fameCacheGet(lat, lng, r, dish) {
  const c = LS.get('mgd.fame', {});
  const e = c[fameCacheKey(lat, lng, r, dish)];
  return (e && Date.now() - e.t < FAME_TTL) ? e.v : null;
}
function fameCacheSet(lat, lng, r, dish, v) {
  const c = LS.get('mgd.fame', {});
  const keys = Object.keys(c);
  if (keys.length > 40) keys.slice(0, keys.length - 40).forEach((k) => delete c[k]);
  c[fameCacheKey(lat, lng, r, dish)] = { t: Date.now(), v: v };
  LS.set('mgd.fame', c);
}
function fameScoreOf(p, branches) {
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
function fameLists(pois, lat, lng, radiusM, dish, kw, cuisine) {
  const counts = new Map();
  for (const p of pois) counts.set(p.nname, (counts.get(p.nname) || 0) + 1);
  const near = pois.map((p) => Object.assign({}, p, { dist: dirDistM(lat, lng, p.lat, p.lng) }))
    .filter((p) => p.dist <= radiusM)
    .map((p) => Object.assign(p, { fame: fameScoreOf(p, counts.get(p.nname) || 1).s }));
  const words = [...new Set((dirNorm(dish) + ' ' + dirNorm(kw)).split(' ').filter((t) => t.length >= 3))];
  const cu = dirNorm(cuisine);
  const dedup = (arr) => {
    const by = new Map();
    for (const p of arr) { const cur = by.get(p.nname); if (!cur || p.dist < cur.dist) by.set(p.nname, p); }
    return [...by.values()].map((p) => Object.assign({}, p, { branches: counts.get(p.nname) || 1 }));
  };
  const match = dedup(near.filter((p) => p.fame >= 4 && (words.some((t) => p.nname.includes(t)) || (cu && p.ncuisine.includes(cu))))
    .sort((a, b) => (b.fame - a.fame) || (a.dist - b.dist))).slice(0, 8);
  const around = dedup(near.filter((p) => p.fame >= 5).sort((a, b) => (b.fame - a.fame) || (a.dist - b.dist))).slice(0, 10);
  return { famousMatch: match, famousNear: around };
}
async function dirFamous(lat, lng, radiusM, dish, kw, cuisine) {
  const cached = fameCacheGet(lat, lng, radiusM, dish);
  if (cached) return cached;
  const dLat = radiusM / 111000;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const box = [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((v) => v.toFixed(6)).join(',');
  const limit = radiusM <= 2500 ? 500 : radiusM <= 5000 ? 900 : radiusM <= 10000 ? 1600 : 2600;
  const am = '["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)"]';
  const ql = '[out:json][timeout:25];(node' + am + '(' + box + ');way' + am + '(' + box + '););out center tags ' + limit + ';';
  let data = null;
  for (const ep of FAME_SRC) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(ep + '?data=' + encodeURIComponent(ql), { signal: ctl.signal, cache: 'no-store' });
      if (res.ok) { const txt = await res.text(); data = JSON.parse(txt); break; }   // gương lỗi trả XML -> bỏ qua
    } catch (e) { /* thử gương kế tiếp */ } finally { clearTimeout(t); }
  }
  if (!data) return null;
  const pois = [];
  for (const el of data.elements || []) {
    const tg = el.tags || {};
    const name = tg.name || tg['name:vi'] || tg['name:en'];
    const plat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const plng = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (!name || plat == null || plng == null) continue;
    pois.push({
      name: String(name).slice(0, 90), lat: plat, lng: plng, nname: dirNorm(name), type: tg.amenity || '',
      cuisine: tg.cuisine || '', ncuisine: dirNorm(tg.cuisine || ''),
      address: [tg['addr:housenumber'], tg['addr:street'], tg['addr:district'], tg['addr:city']].filter(Boolean).join(' '),
      phone: tg.phone || tg['contact:phone'] || '', open: tg.opening_hours || '',
      brand: tg.brand || tg.operator || '', website: tg.website || tg['contact:website'] || '',
      wiki: tg.wikidata || tg.wikipedia || '',
      maps: 'https://www.google.com/maps/dir/?api=1&destination=' + plat + ',' + plng + '&travelmode=driving'
    });
  }
  const lists = fameLists(pois, lat, lng, radiusM, dish, kw, cuisine);
  fameCacheSet(lat, lng, radiusM, dish, lists);
  return lists;
}

// Khối "quán có tiếng": server trả sẵn, hoặc bản tĩnh tự gọi Overpass ở trên.
function famousHTML(match, near, already) {
  const list = already || [];
  const famMatch = (match || []).filter((p) => !list.some((q) => q.name === p.name && Math.abs(q.dist - p.dist) < 50));
  const famNear = (near || []).filter((p) => !famMatch.some((q) => q.name === p.name));
  if (!famMatch.length && !famNear.length) return '';
  return famousBlock('⭐ Quán có tiếng bán món này', famMatch, 'match') +
    famousBlock('⭐ Quán có tiếng quanh đây', famNear, 'near') +
    '<div class="nearby-note fam-note">"Có tiếng" = có hồ sơ Wikipedia/Wikidata, thương hiệu/chuỗi nhiều chi nhánh, website, giờ mở cửa trên dữ liệu mở OSM — không phải điểm đánh giá của khách.</div>';
}
function famousBlock(title, list, kind) {
  if (!list || !list.length) return '';
  return '<div class="fam-title">' + title + '</div>' +
    list.slice(0, kind === 'match' ? 6 : 5).map((p) =>
      '<a class="shop fam" href="' + esc(p.maps) + '" target="_blank" rel="noopener">' +
        '<b>' + esc(p.name) + '</b><span class="shop-dist">' + (p.dist < 1000 ? p.dist + ' m' : (p.dist / 1000).toFixed(1) + ' km') + '</span>' +
        '<span class="fam-why">' + ((p.branches > 1 ? [p.branches + ' chi nhánh'] : []).concat(p.why || [])).slice(0, 3).map(esc).join(' · ') + '</span>' +
        '<span class="shop-meta">' + [p.cuisine, p.address].filter(Boolean).map(esc).join(' · ') + '</span>' +
      '</a>').join('');
}

// Mở app/web giao đồ ăn để tìm & đặt món — CHỈ là link tìm kiếm, KHÔNG lấy dữ liệu quán từ họ.
function deliveryLinks(dishQ) {
  const q = encodeURIComponent(dishQ || '');
  return '<div class="nearby-note dl-hint">Đặt giao tận nhà (mở app, tự tìm món này):</div>' +
    '<div class="nearby-links">' +
    '<a class="nearby-link" href="https://shopeefood.vn/search?keyword=' + q + '" target="_blank" rel="noopener">🛵 ShopeeFood</a>' +
    '<a class="nearby-link" href="https://food.grab.com/vn/vi/restaurants?search=' + q + '" target="_blank" rel="noopener">🛵 GrabFood</a>' +
    '</div>';
}

async function findNearby(d, forcePos, keepPos) {
  const out = $('#nearbyOut'), btn = $('.nearby-btn');
  if (!out) return;
  state.lastNearbyDish = d;
  // keepPos: đổi bán kính thì truyền lại vị trí cũ để khỏi xin GPS lại
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tìm quán quanh bạn…'; }
  out.hidden = false;
  if (!nearbyControlsMemo) nearbyControlsMemo = nearbyControlsHTML();   // giữ riêng, không lấy lại từ innerHTML (tránh nhân đôi header cũ)
  const controls = nearbyControlsMemo;
  out.innerHTML = controls + '<div class="nearby-note">Đang xác định vị trí…</div>';
  try {
    const pos = forcePos || await getPosition();
    state.loc = pos;
    out.innerHTML = controls + renderNearbyHeader(pos) + '<div class="nearby-note">Đang tìm quán…</div>';
    const params = new URLSearchParams({
      lat: pos.lat, lng: pos.lng, r: state.radius,   // mức người dùng chọn: 2.5 / 5 / 10km
      q: (d.kw && d.kw[0]) || d.name,
      kw: (d.kw || []).join(' '),
      cuisine: CUISINE_BY_REGION[d.region] || ''
    });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 70000);
    // bản tĩnh (Vercel) không có /api/nearby -> chạy song song: Photon cho quán khớp món + Overpass cho quán có tiếng
    const famJob = ((await apiMode()) === 'direct')
      ? dirFamous(pos.lat, pos.lng, state.radius, params.get('q'), params.get('kw'), params.get('cuisine')).catch(() => null)
      : null;
    let j;
    try {
      j = await apiJSON('/api/nearby?' + params.toString(), () => dirNearby(pos.lat, pos.lng, state.radius, params.get('q'), params.get('kw'), params.get('cuisine')));
    } finally { clearTimeout(timer); }
    if (j.error) throw new Error(j.error);
    // chưa có quán khớp tên món -> hỏi thêm quán gần nhất (chậm hơn nên chỉ gọi khi cần)
    if (!(j.matched || []).length && await apiMode() === 'server') {
      try {
        const r2 = await fetch('/api/nearby?' + params.toString() + '&ov=1', { cache: 'no-store' });
        const j2 = await r2.json();
        if (!j2.error && ((j2.sameCuisine || []).length || (j2.nearest || []).length)) j = j2;
      } catch (e) {}
    }
    const list = (j.matched && j.matched.length) ? j.matched
      : (j.sameCuisine && j.sameCuisine.length) ? j.sameCuisine
      : (j.nearest || []);
    const kind = (j.matched && j.matched.length) ? 'bán đúng món này'
      : (j.sameCuisine && j.sameCuisine.length) ? 'cùng nhóm ẩm thực' : 'quán ăn gần nhất';
    const rad = ((j.usedRadius || j.radius || state.radius) / 1000);
    const km = (m) => m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km';
    const dishQ = (d.kw && d.kw[0]) || d.name;   // từ khoá để mở app đặt món
    let html = renderNearbyHeader(pos);
    html += '<div class="nearby-note">' + list.length + ' quán <b>' + kind + '</b> trong ~' + rad + 'km (bán kính bạn chọn)</div>';
    if (j.areaWarming) html += '<div class="nearby-note">⏳ Khu vực này đang nạp danh sách quán (lần đầu hơi lâu) — bấm <b>🔄 Tìm lại</b> sau ~10 giây là có.</div>';
    html += list.slice(0, 10).map(p =>
      '<a class="shop" href="' + esc(p.maps) + '" target="_blank" rel="noopener">' +
        '<b>' + esc(p.name) + '</b><span class="shop-dist">' + km(p.dist) + '</span>' +
        '<span class="shop-meta">' + [p.type === 'fast_food' ? 'quán nhanh' : p.type === 'cafe' ? 'quán cà phê' : p.type === 'food_court' ? 'khu ăn uống' : 'nhà hàng',
          p.cuisine, p.address, p.phone].filter(Boolean).map(esc).join(' · ') + '</span></a>').join('');
    // ⭐ Quán có tiếng (dữ liệu mở OSM: thương hiệu/chuỗi, website, giờ mở cửa…)
    html += '<div id="famSlot">' + famousHTML(j.famousMatch, j.famousNear, list) +
      (famJob ? '<div class="nearby-note">⏳ Đang lấy danh sách quán có tiếng…</div>' : '') + '</div>';
    html += '<div class="nearby-links">' +
      '<a class="nearby-link primary" href="' + esc(j.mapsKeywordUrl || j.mapsUrl) + '" target="_blank" rel="noopener">🗺️ Google Maps</a>' +
      '<button class="nearby-link" data-act="loc-again">🔄 Tìm lại</button>' +
      '</div>' + deliveryLinks(dishQ);
    out.innerHTML = controls + html;
    out.dataset.done = '1';
    if (btn) { btn.textContent = '📍 Quán gần đây (bấm để ẩn/hiện)'; btn.disabled = false; }
    // bản tĩnh: Overpass chậm nên hiện kết quả chính trước, quán có tiếng đổ vào sau
    if (famJob) {
      const token = (state._nearbyToken = (state._nearbyToken || 0) + 1);
      famJob.then((fam) => {
        if (token !== state._nearbyToken) return false;   // đã có lượt tìm mới hơn
        const slot = $('#famSlot');
        if (!slot) return false;
        const html2 = fam ? famousHTML(fam.famousMatch, fam.famousNear, list) : '';
        slot.innerHTML = html2 || '<div class="nearby-note">Chưa lấy được danh sách quán có tiếng (Overpass đang bận) — bấm 🔄 Tìm lại.</div>';
        return true;
      });
    }
  } catch (err) {
    out.innerHTML = controls + '<div class="nearby-note err">Không tìm được: ' + esc(err.message) + '</div>' +
      '<div class="nearby-links"><a class="nearby-link primary" href="https://www.google.com/maps/search/' +
      encodeURIComponent(d.name + ' gần đây') + '" target="_blank" rel="noopener">🗺️ Tìm trên Google Maps</a></div>' +
      deliveryLinks((d.kw && d.kw[0]) || d.name);
    if (btn) { btn.disabled = false; btn.textContent = '📍 Thử lại'; }
  }
}

function creditLine(d) {
  if (!d.imageVia) return '';
  const label = d.imageVia === 'commons' ? 'Wikimedia Commons' : d.imageVia === 'vi-wiki' ? 'Wikipedia tiếng Việt' : 'Wikipedia';
  return '<div class="credit">📷 ' + label + (d.imageSource ? ' · ' + esc(String(d.imageSource).replace(/^File:/, '')) : '') + '</div>';
}
// ignoreVung = true: bỏ qua bộ lọc vùng (dùng để đếm số món của TỪNG vùng cho chip)
function matchDish(d, ignoreVung, q) {
  return (!state.meals.size || d.meals.some(m => state.meals.has(m))) &&
    (!state.regions.size || state.regions.has(d.region)) &&
    (ignoreVung || vungHit(d)) &&
    (!state.vnOnly || d.region === 'vn') &&
    (!state.styles.size || state.styles.has(d.style)) &&
    (!state.veg || d.veg === 1) && (!state.mild || d.spicy === 0) &&
    (!state.topRated || d.rating >= 8.5) &&
    d.price <= state.price && d.minutes <= state.time &&
    (!q || (d.name + ' ' + d.descr + ' ' + d.tags.join(' ')).toLowerCase().includes(q));
}
function pool() {
  const q = state.q.trim().toLowerCase();
  return ALL.filter(d => matchDish(d, false, q));
}
function drawOne(list, minTier = 0) {
  let c = list.filter(d => d.tier >= minTier); if (!c.length) c = list;
  const w = c.map(d => TIERS[d.tier].w * (.55 + d.weight / 200) * biasOf(d));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < c.length; i++) { r -= w[i]; if (r <= 0) return c[i]; }
  return c[c.length - 1];
}
function drawMany(list, n) {
  const out = [], used = new Set();
  for (let i = 0; i < n; i++) {
    const l = list.filter(d => !used.has(d.id)); if (!l.length) break;
    const d = drawOne(l); used.add(d.id); out.push(d);
  }
  return out.sort((a, b) => b.tier - a.tier);
}

/* ============================ THẺ BĂNG CHUYỀN ============================ */
function cardHTML(d) {
  const t = TIERS[d.tier];
  const media = d.image
    ? '<img src="' + thumb(d.image, 480) + '" alt="' + esc(d.name) + '" loading="lazy" decoding="async" width="300" height="300"' +
      ' onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;block&quot;">' +
      '<div style="display:none;width:100%;height:100%">' + renderArt(d) + '</div>'
    : renderArt(d);
  return '<div class="rcard t' + d.tier + '" data-id="' + d.id + '">' +
    '<span class="tier">' + t.short + '</span>' +
    '<span class="rate">★ ' + (d.rating ? d.rating.toFixed(1) : '—') + '</span>' +
    '<div class="ph">' + media + '<span class="shade"></span></div>' +
    '<div class="nm"><b>' + d.emoji + ' ' + esc(d.name) + '</b><i>' + (REGIONS[d.region] || d.region) + ' · ' + (STYLES[d.style] || d.style) + '</i></div>' +
  '</div>';
}
function geom() {
  const track = $('#rouletteTrack');
  const first = track.firstElementChild;
  const cs = getComputedStyle(track);
  const gap = parseFloat(cs.columnGap || cs.gap) || 10;
  const padL = parseFloat(cs.paddingLeft) || 14;
  const w = (first && first.offsetWidth) || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 132;
  return { w, gap, step: w + gap, padL, vp: $('#rouletteViewport').clientWidth || innerWidth };
}
function idleTrack() {
  const track = $('#rouletteTrack'), p = pool();
  if (!p.length) { track.innerHTML = ''; return; }
  const n = Math.max(8, Math.ceil((innerWidth * 3) / 140));
  let html = '';
  for (let i = 0; i < n; i++) html += cardHTML(p[(Math.random() * p.length) | 0]);
  track.innerHTML = html;
  track.style.transform = 'translate3d(0,0,0)';
}

/* ============================ QUAY ============================ */
let spinRAF = null;
function spin(target, done) {
  const track = $('#rouletteTrack');
  const p = pool();
  state.spinning = true;
  $('#btnSpinSingle').disabled = true; $('#btnSpinMulti').disabled = true;
  unlockAudio(); sfx.lever(); buzz(18);

  // máy nhỏ thì ít thẻ hơn cho nhẹ máy
  const TOTAL = innerWidth < 480 ? 34 : innerWidth < 900 ? 46 : 60;
  const WIN = TOTAL - 6;
  let html = '';
  for (let i = 0; i < TOTAL; i++) html += cardHTML(i === WIN ? target : p[(Math.random() * p.length) | 0]);
  track.innerHTML = html;

  const g = geom();
  const winCard = track.children[WIN];
  const center = (winCard && winCard.offsetLeft ? winCard.offsetLeft : g.padL + WIN * g.step) + g.w / 2;
  const endX = -(center - g.vp / 2);

  const dur = REDUCED ? 900 : (innerWidth < 480 ? 5200 : 6400);
  const t0 = performance.now();
  let lastIdx = -1;
  const ease = (x) => 1 - Math.pow(1 - x, 4.6);

  function frame(now) {
    const pr = Math.min(1, (now - t0) / dur);
    const x = endX * ease(pr);
    track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    const idx = Math.floor((-x + g.vp / 2 - g.padL) / g.step);
    if (idx !== lastIdx && idx >= 0 && idx < TOTAL) { lastIdx = idx; sfx.tick(); if (idx % 3 === 0) buzz(6); }
    if (pr < 1) spinRAF = requestAnimationFrame(frame);
    else {
      track.style.transform = 'translate3d(' + endX.toFixed(2) + 'px,0,0)';
      winCard && winCard.classList.add('win');
      const r = $('#rouletteViewport').getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, target.tier >= 3 ? 130 : 70,
        target.tier >= 4 ? ['#ffbe2e', '#fff1c2', '#ff5722', '#ffcf5c'] : undefined);
      sfx.win(target.tier);
      buzz(target.tier >= 3 ? [25, 40, 25, 40, 60] : [30, 50, 30]);
      addHist(target);
      if (!state.seen.has(target.id)) { state.seen.add(target.id); LS.set('mgd.seen', [...state.seen]); }
      updateProgress();
      setTimeout(() => {
        state.spinning = false;
        $('#btnSpinSingle').disabled = false;
        $('#btnSpinMulti').disabled = pool().length < 2;
        done && done();
      }, target.tier >= 3 ? 900 : 620);
    }
  }
  spinRAF = requestAnimationFrame(frame);
}
function spinOnce() {
  if (state.spinning) return;
  let p = pool();
  if (!p.length) { ensurePlayable(); p = pool(); }          // tự cứu (bỏ bữa ăn tự động) rồi quay
  if (!p.length) return toast('⚠️ Không món nào khớp bộ lọc — nới lỏng chút nhé!');
  state.pity++;
  const force = state.pity >= 10 ? 3 : 0;
  const win = drawOne(p, force);
  if (win.tier >= 3) state.pity = 0;
  LS.set('mgd.pity', state.pity); updatePity();
  spin(win, () => openWin(win));
}
function spinTen() {
  if (state.spinning) return;
  let p = pool();
  if (p.length < 2) { ensurePlayable(); p = pool(); }
  if (p.length < 2) return toast('⚠️ Cần ít nhất 2 món trong bộ lọc để quay 10!');
  const best = drawMany(p, 10);
  spin(best[0], () => openMulti(best));
}
function updatePity() { const el = $('#pityVal'); if (el) { el.textContent = state.pity + '/10'; el.style.color = state.pity >= 9 ? '#ff5722' : 'var(--violet)'; } }
function updateProgress() {
  const total = ALL.length || 1, n = state.seen.size, pc = Math.round(n / total * 100);
  const v = $('#colVal'); if (v) v.textContent = n + '/' + total;
  const f = $('#colFill'); if (f) f.style.width = pc + '%';
}

/* ============================ WIN DIALOG ============================ */
function openWin(d) {
  state.lastWinner = d;
  try { renderWin(d); } catch (err) {
    // dữ liệu lạ cũng KHÔNG được chặn popup: hiện bản tối giản
    const dlg = $('#winDialog');
    dlg.innerHTML = '<button class="win-close" data-act="close" aria-label="Đóng">✕</button>' +
      '<div class="win-hero">' + renderArt(d) + '</div>' +
      '<h2 class="win-name">' + d.emoji + ' ' + esc(d.name) + '</h2>' +
      '<p class="win-descr">' + esc(d.descr || '') + '</p>' +
      '<div class="win-actions"><button class="btn-lock" data-act="close">✕ ĐÓNG</button></div>';
    $('#modalBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
  }
}
function renderWin(d) {
  const t = TIERS[d.tier] || TIERS[1], dialog = $('#winDialog');
  const fav = state.favs.includes(d.id);
  dialog.style.setProperty('--win-border', t.color);
  dialog.style.setProperty('--win-glow', t.glow);
  dialog.innerHTML =
    '<div class="win-rays"></div>' +
    '<button class="win-close" data-act="close" aria-label="Đóng">✕</button>' +
    '<div class="win-badges"><span class="win-tier" style="background:' + t.color + '">' + t.name + '</span>' +
      (d.veg === 1 ? '<span class="pill hot">🌱 Chay</span>' : '') +
      (d.spicy > 1 ? '<span class="pill hot">🌶️ Cay</span>' : '') + '</div>' +
    '<div class="win-hero">' + (d.image
      ? '<img src="' + thumb(d.image, 900) + '" alt="' + esc(d.name) + '" decoding="async" onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;block&quot;"><div style="display:none;width:100%;height:100%">' + renderArt(d) + '</div>'
      : renderArt(d)) + '</div>' +
    '<h2 class="win-name">' + d.emoji + ' ' + esc(d.name) + '</h2>' +
    scoreBlock(d) +
    '<p class="win-descr">' + esc(d.descr) + '</p>' +
    (d.review ? '<p class="review">“' + esc(d.review) + '”</p>' : '') +
    (d.intro
      ? '<div class="intro-wrap">' +
          '<div class="intro" id="introBox">' + esc(d.intro) + '</div>' +
          '<button class="intro-more" data-act="intro">Đọc thêm ▾</button>' +
          '<div class="intro-src">' + esc(d.introSource || 'Wikipedia') +
            (d.wikiUrl ? ' · <a href="' + esc(d.wikiUrl) + '" target="_blank" rel="noopener">Xem bài gốc ↗</a>' : '') +
          '</div>' +
        '</div>'
      : '') +
    (Array.isArray(d.detail) && d.detail.length
      ? '<div class="detail">' +
          '<button class="detail-toggle" data-act="detail">📖 Chi tiết (' + d.detail.map(x => esc(x.t)).join(' · ').slice(0, 70) + ') ▾</button>' +
          '<div class="detail-body" id="detailBody" hidden>' +
            d.detail.map(x => '<section><h4>' + esc(x.t) + '</h4><p>' + esc(x.body).replace(/\n+/g, '<br>') + '</p></section>').join('') +
          '</div>' +
        '</div>'
      : '') +
    infoGrid(d) +
    (Array.isArray(d.bestFor) && d.bestFor.length ? '<div class="fit"><span class="fit-label">Hợp với:</span>' + d.bestFor.map(x => '<span class="pill">' + esc(x) + '</span>').join('') + '</div>' : '') +
    (d.tip ? '<p class="tip">💡 ' + esc(d.tip) + '</p>' : '') +
    '<div class="nearby" id="nearbyBox">' +
      '<button class="nearby-btn" data-act="nearby">📍 Tìm quán bán món này gần tôi</button>' +
      '<div class="nearby-out" id="nearbyOut"></div>' +
    '</div>' +
    creditLine(d) +
    '<div class="win-meta">' +
      '<span class="pill">' + (REGIONS[d.region] || d.region) + '</span>' +
      (d.region === 'vn' && vungSummary(d) ? '<span class="pill">🗺️ ' + esc(vungSummary(d)) + '</span>' : '') +
      '<span class="pill">' + (STYLES[d.style] || d.style) + '</span>' +
      '<span class="pill">⏱️ ' + (d.minutes || '?') + ' phút</span>' +
      '<span class="pill">💰 ' + '₫'.repeat(Math.max(1, Math.min(4, Number(d.price) || 1))) + '</span>' +
      (Array.isArray(d.meals) ? '<span class="pill">' + d.meals.map(m => MEALS[m] || m).join(' · ') + '</span>' : '') +
    '</div>' +
    '<div class="win-actions">' +
      '<button class="btn-lock" data-act="lock">🎉 CHỐT MÓN NÀY!</button>' +
      '<div class="sub-row">' +
        '<button class="sub-btn" data-act="again">🎲 Quay lại</button>' +
        '<button class="sub-btn ' + (fav ? 'fav' : '') + '" data-act="fav">' + (fav ? '♥ Đã lưu' : '♥ Lưu') + '</button>' +
        '<button class="sub-btn" data-act="menu-add">📅 Vào thực đơn</button>' +
        '<button class="sub-btn" data-act="share">📤 Chia sẻ ảnh</button>' +
      '</div>' +
    '</div>';
  $('#modalBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  dialog.scrollTop = 0;                 // luôn mở từ đầu: thấy ngay ảnh + tên + điểm
  $('#modalBackdrop').scrollTop = 0;
}

/* ============================ 10-PULL ============================ */
function openMulti(list) {
  const dialog = $('#multiDialog');
  dialog.innerHTML =
    '<h2 class="multi-title">✨ ' + list.length + ' MÓN CHO BẠN</h2>' +
    '<div class="multi-grid">' + list.map((d, i) => {
      const t = TIERS[d.tier];
      const media = d.image
        ? '<img src="' + thumb(d.image, 480) + '" alt="' + esc(d.name) + '" loading="lazy" decoding="async" onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;block&quot;"><div style="display:none;width:100%;height:100%">' + renderArt(d) + '</div>'
        : renderArt(d);
      return '<div class="mcell t' + d.tier + '" data-id="' + d.id + '" style="animation-delay:' + (i * .04) + 's">' +
        '<span class="th">' + media + '</span><b>' + d.emoji + ' ' + esc(d.name) + '</b><i>' + t.short + ' · ★' + (d.rating ? d.rating.toFixed(1) : '—') + '</i></div>';
    }).join('') + '</div>' +
    '<div class="multi-actions"><button class="btn-lock" data-act="lucky">🎲 Chốt đại 1 món</button>' +
    '<button class="sub-btn" data-act="close" style="max-width:96px">Đóng</button></div>';
  list.forEach(d => { addHist(d); state.seen.add(d.id); });
  LS.set('mgd.seen', [...state.seen]); updateProgress();
  $('#multiBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  sfx.win(list[0].tier); buzz([20, 40, 20]);
  burst(innerWidth / 2, innerHeight * .45, 110);
}

/* ============================ SỰ KIỆN MODAL ============================ */
$('#modalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modalBackdrop') return closeModals();
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, d = state.lastWinner;
  sfx.click();
  if (act === 'close') return closeModals();
  if (act === 'lock') {
    // KHÔNG đóng: giữ nguyên thẻ thông tin món đã chọn, đổi nút thành "Đã chốt"
    const dlg = $('#winDialog');
    dlg.classList.add('locked');
    b.innerHTML = '✓ ĐÃ CHỐT MÓN NÀY';
    b.disabled = true;
    if (!dlg.querySelector('.locked-ribbon')) {
      dlg.insertAdjacentHTML('afterbegin', '<div class="locked-ribbon">✓ Đã chốt: ' + d.emoji + ' ' + esc(d.name) + '</div>');
    }
    const _meal = state.mealTarget || mealByHour(new Date().getHours());
    state.mealTarget = null;
    const _slot = MENU_SLOT[_meal];
    if (_slot) { state.menu[_slot] = d.id; state.menu.date = todayKey(); saveMenu(); }
    logDiary(d, _meal);
    bumpTaste(d, 1);
    updateDiaryBadge();
    burst(innerWidth / 2, innerHeight * .42, 140);
    buzz([30, 50, 80]);
    toast('🎉 ĐÃ CHỐT: <b>' + d.emoji + ' ' + esc(d.name) + '</b> — chúc ngon miệng!', 3000);
  } else if (act === 'rows') {
    const more = $('#infoMore');
    if (more) {
      const open = more.hidden;
      more.hidden = !open;
      b.textContent = open ? '－ Thu gọn ▴' : '＋ Xem thêm ' + more.querySelectorAll('.info-row').length + ' thông tin ▾';
    }
  } else if (act === 'loc-go') {
    const v = ($('#locInput') || {}).value || '';
    if (!v.trim()) return;
    locateManual(v)
      .then((pos) => findNearby(state.lastNearbyDish, pos))
      .catch((err) => { const out = $('#nearbyOut'); if (out) out.insertAdjacentHTML('beforeend', '<div class="nearby-note err">' + esc(err.message) + '</div>'); });
  } else if (act === 'rad') {
    setRadius(+b.dataset.rad);
  } else if (act === 'loc-again') {
    findNearby(state.lastNearbyDish);
  } else if (act === 'detail') {
    const body = $('#detailBody');
    if (body) {
      const open = body.hidden;
      body.hidden = !open;
      b.textContent = b.textContent.replace(open ? '▾' : '▴', open ? '▴' : '▾');
    }
  } else if (act === 'nearby') {
    findNearby(d);
  } else if (act === 'intro') {
    const box = $('#introBox');
    if (box) {
      const open = box.classList.toggle('expanded');
      b.textContent = open ? 'Thu gọn ▴' : 'Đọc thêm ▾';
    }
  } else if (act === 'menu-add') {
    const meal = state.mealTarget || mealByHour(new Date().getHours());
    state.mealTarget = null;
    const _slot2 = MENU_SLOT[meal];
    if (_slot2) { state.menu[_slot2] = d.id; state.menu.date = todayKey(); saveMenu(); }
    logDiary(d, meal);
    bumpTaste(d, 1);
    updateDiaryBadge();
    toast('📅 Đã thêm <b>' + d.emoji + ' ' + esc(d.name) + '</b> vào ' + (MEALS[meal] || meal));
  } else if (act === 'again') { if (d) bumpTaste(d, -1); closeModals(); setTimeout(spinOnce, 140); }
  else if (act === 'fav') { toggleFav(d.id); const on = state.favs.includes(d.id); b.textContent = on ? '♥ Đã lưu' : '♥ Lưu'; b.classList.toggle('fav', on); }
  else if (act === 'share') {
    const txt = d.emoji + ' ' + d.name + ' — ' + d.descr + ' (quay bằng Món Gì Đây?)';
    if (navigator.share) navigator.share({ title: 'Món Gì Đây?', text: txt }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('📋 Đã copy!'), () => toast(txt));
    else toast(txt);
  }
});
$('#multiBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'multiBackdrop') return closeModals();
  const cell = e.target.closest('.mcell');
  if (cell) { const d = dishById(cell.dataset.id); if (d) { closeModals(); setTimeout(() => openWin(d), 60); } return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'close') closeModals();
  if (b.dataset.act === 'lucky') {
    const cells = $$('#multiDialog .mcell');
    const pick = dishById(cells[(Math.random() * cells.length) | 0].dataset.id);
    closeModals(); setTimeout(() => openWin(pick), 60);
  }
});
function closeModals() {
  $('#modalBackdrop').hidden = true;
  $('#multiBackdrop').hidden = true;
  if ($('#filterPanel') && !$('#filterPanel').classList.contains('open')) document.body.style.overflow = '';
}

/* ============================ LỊCH SỬ / YÊU THÍCH ============================ */
function addHist(d) {
  state.hist = [d.id, ...state.hist.filter(x => x !== d.id)].slice(0, 20);
  LS.set('mgd.hist', state.hist); renderHist();
}
function renderHist() {
  const html = state.hist.length
    ? state.hist.slice(0, 12).map(id => {
        const d = dishById(id); if (!d) return '';
        return '<button class="hitem" data-id="' + d.id + '"><span class="em">' + d.emoji + '</span>' + esc(d.name) +
          '<span class="tag" style="background:' + TIERS[d.tier].glow + ';color:' + TIERS[d.tier].color + '">' + TIERS[d.tier].short + '</span></button>';
      }).join('')
    : '<span class="sub" style="font-size:12px">Chưa quay lần nào</span>';
  ['#historyFeed', '#historyFeedSheet', '#historyFeedDesktop'].forEach(sel => {
    const el = $(sel); if (el) el.innerHTML = html;
  });
}
// dải "Đã lưu" (mobile + desktop)
function renderFavStrip() {
  const html = state.favs.length
    ? state.favs.slice(0, 14).map(id => {
        const d = dishById(id); if (!d) return '';
        const media = d.image
          ? '<img src="' + thumb(d.image, 480) + '" alt="' + esc(d.name) + '" loading="lazy" decoding="async" onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;block&quot;"><div style="display:none;width:100%;height:100%">' + renderArt(d) + '</div>'
          : renderArt(d);
        return '<button class="favchip" data-id="' + d.id + '"><span class="th">' + media + '</span><b>' + d.emoji + ' ' + esc(d.name) + '</b></button>';
      }).join('')
    : '<span class="note">Chưa lưu món nào — quay rồi bấm ♥ trên thẻ kết quả nhé!</span>';
  ['#favStrip', '#favStripDesktop'].forEach(sel => { const el = $(sel); if (el) el.innerHTML = html; });
}
$('#clearHist').onclick = () => { state.hist = []; LS.set('mgd.hist', []); renderHist(); toast('Đã xoá lịch sử quay'); };
document.addEventListener('click', (e) => {
  const card = e.target.closest('.hitem, .favchip'); if (!card) return;
  const d = dishById(card.dataset.id); if (d) openWin(d);
});
function toggleFav(id) {
  const i = state.favs.indexOf(id);
  i >= 0 ? state.favs.splice(i, 1) : state.favs.unshift(id);
  LS.set('mgd.favs', state.favs); updateFav(); buzz(12);
  toast(i >= 0 ? 'Đã bỏ khỏi yêu thích' : '♥ Đã lưu vào yêu thích');
}
function updateFav() { const el = $('#favCount'); if (el) el.textContent = state.favs.length; renderFavStrip(); }
function openFavs() {
  const c = $('#drawerContent');
  $('#drawerFavCount').textContent = state.favs.length;
  c.innerHTML = state.favs.length
    ? state.favs.map(id => {
        const d = dishById(id); if (!d) return '';
        const media = d.image
          ? '<img src="' + thumb(d.image, 480) + '" alt="' + esc(d.name) + '" loading="lazy" decoding="async" onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;block&quot;"><div style="display:none;width:100%;height:100%">' + renderArt(d) + '</div>'
          : renderArt(d);
        return '<div class="favcell" data-id="' + d.id + '"><span class="th">' + media + '</span><b>' + d.emoji + ' ' + esc(d.name) + '</b>' +
          '<button data-rm="' + d.id + '">Bỏ lưu</button></div>';
      }).join('')
    : '<p class="sub" style="grid-column:1/-1;text-align:center;padding:28px;font-size:13px">Chưa có món yêu thích.<br>Quay rồi bấm ♥ để lưu nhé!</p>';
  $('#drawerBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
$('#btnFav').onclick = openFavs;
const openFavsBtn = $('#openFavsBtn'); if (openFavsBtn) openFavsBtn.onclick = openFavs;
const luckyBtn = $('#btnLuckyFooter');
if (luckyBtn) luckyBtn.onclick = () => { resetFilters(); applyFilterUI(); syncPool(); idleTrack(); buzz(12); toast('🍀 Đã bỏ hết bộ lọc — quay toàn bộ ' + ALL.length + ' món!'); setTimeout(spinOnce, 260); };
$('#btnCloseDrawer').onclick = () => { $('#drawerBackdrop').hidden = true; document.body.style.overflow = ''; };
$('#drawerBackdrop').onclick = (e) => {
  if (e.target.id === 'drawerBackdrop') { $('#drawerBackdrop').hidden = true; document.body.style.overflow = ''; return; }
  const rm = e.target.closest('[data-rm]');
  if (rm) { toggleFav(rm.dataset.rm); openFavs(); return; }
  const cell = e.target.closest('.favcell');
  if (cell) { const d = dishById(cell.dataset.id); if (d) { $('#drawerBackdrop').hidden = true; document.body.style.overflow = ''; openWin(d); } }
};

/* ============================ BỘ LỌC ============================ */
function chipRow(host, dict, set) {
  host.innerHTML = '';
  for (const [k, label] of Object.entries(dict)) {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = label; b.dataset.k = k; b.dataset.label = label;
    b.onclick = () => {
      // bấm chip ẩm thực nước ngoài => tự tắt chế độ "chỉ món Việt"
      if (set === state.regions && k !== 'vn' && state.vnOnly) setVnOnly(false, true);
      // bấm chip vùng "Ngoài Việt Nam" => tự tắt chế độ chỉ món Việt
      if (set === state.vung && k === 'ngoai' && state.vnOnly) setVnOnly(false, true);
      set.has(k) ? set.delete(k) : set.add(k);
      if (set === state.meals) state.mealAuto = false;   // người dùng tự chọn bữa -> không tự bỏ nữa
      if (set === state.vung) {
        state.vungManual = true;
        LS.set('mgd.vungManual', true); LS.set('mgd.vungSelection', [...state.vung]);
        state.vungGeo = null; LS.set('mgd.vungGeo', null);
      }
      b.classList.toggle('on', set.has(k));
      state.preset = null; $$('#presets .preset').forEach(p => p.classList.remove('on'));
      sfx.click(); buzz(8); syncPool(); ensurePlayable(); idleTrack();
    };
    host.appendChild(b);
  }
}
/* ---- CHỈ MÓN VIỆT (mặc định BẬT) ---- */
function paintRegionChips() {
  $$('#regionChips .chip').forEach(c => c.classList.toggle('foreign-off', state.vnOnly && c.dataset.k !== 'vn'));
  $$('#vungChips .chip').forEach(c => c.classList.toggle('foreign-off', state.vnOnly && c.dataset.k === 'ngoai'));
}
function setVnOnly(on, notify) {
  state.vnOnly = !!on;
  LS.set('mgd.vnOnly', state.vnOnly);
  const el = $('#fVnOnly'); if (el) el.checked = state.vnOnly;
  paintRegionChips(); syncPool();
  if (notify) toast(state.vnOnly
    ? '🇻🇳 Đã ẩn món nước ngoài — chỉ còn món Việt'
    : '🌏 Đã mở lại món quốc tế (Hàn, Nhật, Âu, Mỹ…)');
  idleTrack();
}
function activeFilterCount() {
  return state.meals.size + state.regions.size + state.styles.size + state.vung.size + (state.veg ? 1 : 0) + (state.mild ? 1 : 0) + (state.topRated ? 1 : 0) + (state.price < 4 ? 1 : 0) + (state.time < 300 ? 1 : 0) + (state.q ? 1 : 0);
}
function syncPool() {
  const p = pool();
  const el = $('#poolStatusText');
  if (el) {
    el.innerHTML = p.length ? '<b>' + p.length + '</b>/' + ALL.length + ' món · đã khám phá <b>' + state.seen.size + '</b>' : '⚠️ 0 món khớp lọc — bấm để mở lọc';
    el.style.cursor = p.length ? '' : 'pointer';           // 0 món: bấm vào dòng trạng thái là mở sheet
    el.onclick = p.length ? null : openSheet;
  }
  $('#btnSpinSingle').disabled = !p.length || state.spinning;
  $('#btnSpinMulti').disabled = p.length < 2 || state.spinning;
  const n = activeFilterCount();
  const badge = $('#filterCount');
  badge.hidden = n === 0; badge.textContent = n;
  $('#sheetCount').textContent = p.length + ' món';
  const s2 = $('#sheetCount2'); if (s2) s2.textContent = p.length;
  paintVungCounts();
}
// chip vùng hiện luôn số món khớp (bỏ qua chính bộ lọc vùng) — vùng 0 món bị làm mờ
function paintVungCounts() {
  if (!$('#vungChips')) return;
  const q = state.q.trim().toLowerCase();
  $$('#vungChips .chip').forEach(c => {
    const base = c.dataset.label || c.textContent;
    const k = c.dataset.k;
    const n = ALL.filter(d => matchDish(d, true, q) && vungMatchesKey(d, k)).length;
    c.textContent = base + ' · ' + n;
    c.classList.toggle('empty', n === 0);
  });
}
/* Cứu tình huống "0 món khớp lọc" (hay gặp khi chọn vùng miền + bữa ăn tự động theo giờ):
   1) nếu bữa ăn là do đồng hồ tự chọn -> bỏ lọc bữa, báo rõ lý do;
   2) còn lại thì báo + mở sheet để người dùng tự nới lọc. */
function ensurePlayable(openIfZero = true) {
  if (pool().length) return true;
  if (state.mealAuto && state.meals.size) {
    const was = [...state.meals].map(m => MEALS[m] || m).join(', ');
    state.meals.clear(); state.mealAuto = false;
    $$('#mealChips .chip').forEach(c => c.classList.remove('on'));
    syncPool();
    if (pool().length) {
      toast('🗺️ Bữa <b>' + was + '</b> không có món trong vùng này — đã bỏ lọc bữa ăn, còn <b>' + pool().length + '</b> món');
      return true;
    }
  }
  if (openIfZero) {
    toast('⚠️ 0 món khớp bộ lọc — bấm <b>Đặt lại</b> hoặc bớt lọc nhé!');
    const panel = $('#filterPanel');
    if (panel && !panel.classList.contains('open')) openSheet();
  }
  return false;
}
function renderVungLocationHint() {
  const el = $('#vungLocationHint'); if (!el) return;
  const geo = state.vungGeo;
  if (!state.autoVung) { el.textContent = 'Đã tắt tự gợi ý vùng.'; return; }
  if (!geo || !geo.vung) { el.textContent = ''; return; }
  const label = placeLabel(geo);
  const already = state.vung.size === 1 && state.vung.has(geo.vung);
  el.innerHTML = already
    ? '📍 Đang dùng gợi ý ' + esc(vungLabel(geo.vung)) + ' · ' + esc(label)
    : '📍 Gợi ý ' + esc(vungLabel(geo.vung)) + ' theo ' + esc(label) +
      ' <button type="button" id="btnUseGeoVung">Dùng vùng này</button>';
  const b = $('#btnUseGeoVung');
  if (b) b.onclick = () => applyGeoVung();
}
function applyGeoVung() {
  const geo = state.vungGeo;
  if (!geo || !geo.vung || state.vungManual) return;
  state.vung.clear(); state.vung.add(geo.vung);
  state.vungManual = true;
  LS.set('mgd.vungSelection', [...state.vung]); LS.set('mgd.vungManual', true);
  renderVungLocationHint(); applyFilterUI(); syncPool(); ensurePlayable();
  toast('📍 Đã dùng ' + esc(vungLabel(geo.vung)) + ' theo vị trí');
}
function setAutoVung(on) {
  state.autoVung = !!on; LS.set('mgd.autoVung', state.autoVung);
  if (!state.autoVung) renderVungLocationHint();
  else detectVungFromPosition();
  applyFilterUI();
}
async function detectVungFromPosition() {
  if (!state.autoVung || state.vungManual) return null;
  try {
    const pos = await getPosition();
    if (state.vungManual || !state.autoVung) return null;
    let info = pos;
    let vung = vungFromPlace(info);
    if (!vung) vung = vungFromCoords(pos.lat, pos.lng, info);
    if (!vung && pos.source === 'gps') {
      try {
        const rev = await apiJSON('/api/reverse-geocode?lat=' + encodeURIComponent(pos.lat) + '&lng=' + encodeURIComponent(pos.lng), () => dirReverseGeocode(pos.lat, pos.lng));
        info = Object.assign({}, pos, rev);
        vung = vungFromPlace(info) || vungFromCoords(pos.lat, pos.lng, info);
      } catch (e) {}
    }
    if (state.vungManual || !state.autoVung || !vung) return null;
    state.vungGeo = Object.assign({}, info, { vung });
    LS.set('mgd.vungGeo', state.vungGeo);
    renderVungLocationHint();
    return state.vungGeo;
  } catch (e) {
    return null;
  }
}
function openSheet() {
  $('#filterPanel').classList.add('open');
  $('#sheetBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  buzz(10);
}
function closeSheet() {
  $('#filterPanel').classList.remove('open');
  $('#sheetBackdrop').hidden = true;
  document.body.style.overflow = '';
}
$('#btnOpenSheet').onclick = openSheet;
$('#btnCloseSheet').onclick = closeSheet;
$('#sheetBackdrop').onclick = closeSheet;
$('#btnApplyFilters').onclick = () => { closeSheet(); idleTrack(); toast('Đã áp dụng: <b>' + pool().length + '</b> món'); };

const PRESETS = {
  lunch:  () => { state.meals.add('trua'); state.time = 35; },
  dinner: () => { state.meals.add('toi'); },
  late:   () => { state.meals.add('khuya'); },
  snack:  () => { state.meals.add('vat'); },
  veg:    () => { state.veg = true; },
  soup:   () => { state.styles.add('nuoc'); },
  quick:  () => { state.time = 20; },
  cheap:  () => { state.price = 1; },
  top:    () => { state.topRated = true; },
  vungBac:   () => { state.vung.add('bac'); },
  vungTrung: () => { state.vung.add('trung'); },
  vungTay:   () => { state.vung.add('tay-nam-bo'); }
};
$$('#presets .preset').forEach(btn => {
  btn.onclick = () => {
    const key = btn.dataset.preset;
    const wasOn = btn.classList.contains('on');
    resetFilters(false);
    if (!wasOn) {
      PRESETS[key] && PRESETS[key]();
      if (state.meals.size) state.mealAuto = false;   // preset là lựa chọn của người dùng
      if (state.vung.size) {
        state.vungManual = true;
        LS.set('mgd.vungSelection', [...state.vung]); LS.set('mgd.vungManual', true);
      }
      btn.classList.add('on'); state.preset = key;
      buzz(10); toast('Đã lọc: <b>' + btn.textContent.trim() + '</b>');
    }
    applyFilterUI(); syncPool(); idleTrack();
  };
});
function resetFilters(clearChips = true) {
  state.meals.clear(); state.regions.clear(); state.styles.clear(); state.vung.clear();
  state.veg = false; state.mild = false; state.topRated = false; state.price = 4; state.time = 300; state.q = ''; state.preset = null;
  state.vnOnly = true; LS.set('mgd.vnOnly', true); state.mealAuto = false;
  state.vungManual = false; state.vungGeo = null;
  LS.set('mgd.vungManual', false); LS.set('mgd.vungSelection', []); LS.set('mgd.vungGeo', null);
  if (clearChips) $$('#presets .preset').forEach(p => p.classList.remove('on'));
}
function applyFilterUI() {
  $('#fVeg').checked = state.veg; $('#fMild').checked = state.mild;
  const fv = $('#fVnOnly'); if (fv) fv.checked = state.vnOnly;
  const fg = $('#fVungGocOnly'); if (fg) fg.checked = state.vungGocOnly;
  const av = $('#fAutoVung'); if (av) av.checked = state.autoVung;
  paintRegionChips();
  const ft = $('#fTop'); if (ft) ft.checked = state.topRated;
  $('#fPrice').value = state.price; $('#fTime').value = state.time; $('#fSearch').value = state.q;
  $('#priceLabel').textContent = state.price === 4 ? 'Tất cả' : '₫'.repeat(state.price);
  $('#timeLabel').textContent = state.time === 300 ? '300 phút' : state.time + ' phút';
  $$('#mealChips .chip').forEach(c => c.classList.toggle('on', state.meals.has(c.dataset.k)));
  $$('#regionChips .chip').forEach(c => c.classList.toggle('on', state.regions.has(c.dataset.k)));
  $$('#vungChips .chip').forEach(c => c.classList.toggle('on', state.vung.has(c.dataset.k)));
  $$('#styleChips .chip').forEach(c => c.classList.toggle('on', state.styles.has(c.dataset.k)));
  renderVungLocationHint();
}
$('#btnResetFilters').onclick = () => { resetFilters(); applyFilterUI(); syncPool(); idleTrack(); toast('Đã đặt lại bộ lọc'); };
$('#fVeg').onchange = (e) => { state.veg = e.target.checked; syncPool(); };
$('#fMild').onchange = (e) => { state.mild = e.target.checked; syncPool(); };
const fvEl = $('#fVnOnly'); if (fvEl) fvEl.onchange = (e) => setVnOnly(e.target.checked, true);
const fVungGocEl = $('#fVungGocOnly'); if (fVungGocEl) fVungGocEl.onchange = (e) => { state.vungGocOnly = e.target.checked; LS.set('mgd.vungGocOnly', state.vungGocOnly); syncPool(); ensurePlayable(); };
const fAutoVungEl = $('#fAutoVung'); if (fAutoVungEl) fAutoVungEl.onchange = (e) => { setAutoVung(e.target.checked); if (!e.target.checked) { state.vungGeo = null; LS.set('mgd.vungGeo', null); } };
const fTopEl = $('#fTop'); if (fTopEl) fTopEl.onchange = (e) => { state.topRated = e.target.checked; syncPool(); };
$('#fPrice').oninput = (e) => { state.price = +e.target.value; $('#priceLabel').textContent = state.price === 4 ? 'Tất cả' : '₫'.repeat(state.price); syncPool(); };
$('#fTime').oninput = (e) => { state.time = +e.target.value; $('#timeLabel').textContent = state.time === 300 ? '300 phút' : state.time + ' phút'; syncPool(); };
let searchTimer;
$('#fSearch').oninput = (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = e.target.value; syncPool(); }, 180); };

/* ============================ NÚT QUAY ============================ */
// CHỈ quay bằng nút: "QUAY 1 MÓN" hoặc "x10". Khung quay không nhận chạm.
$('#btnSpinSingle').onclick = spinOnce;
const _chip = $('#ctxChip');
if (_chip) _chip.onclick = () => { state.ctxOn = !state.ctxOn; LS.set('mgd.ctxOn', state.ctxOn); renderCtxChip(); toast(state.ctxOn ? '🌦️ Bật ưu tiên theo thời tiết & giờ' : '🚫 Đã tắt ưu tiên theo bối cảnh'); };
const _btnToday = $('#btnToday');
if (_btnToday) _btnToday.onclick = openToday;
$('#todayBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'todayBackdrop') return closeToday();
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'close-today') return closeToday();
  if (act === 'slot-spin') return spinForMeal(b.dataset.meal);
  if (act === 'slot-clear') { state.menu[b.dataset.meal] = null; saveMenu(); renderToday(); return; }
  if (act === 'share-menu') return shareImage('menu');
  if (act === 'clear-diary') {
    state.diary = []; saveDiary(); updateDiaryBadge(); renderToday();
    return toast('🧹 Đã xoá nhật ký');
  }
});
$('#todayDialog').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeToday(); });
$('#btnSpinMulti').onclick = spinTen;
const machineEl = $('#rouletteMachine');
if (machineEl) machineEl.style.pointerEvents = 'none';
$('#btnSound').onclick = (e) => {
  state.sound = !state.sound; LS.set('mgd.sound', state.sound);
  $('#soundIcon').textContent = state.sound ? '🔊' : '🔇';
  e.currentTarget.classList.toggle('off', !state.sound);
  if (state.sound) { unlockAudio(); sfx.click(); }
};
$('#btnTheme').onclick = () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next; LS.set('mgd.theme', next);
  $('#themeIcon').textContent = next === 'light' ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = next === 'light' ? '#fdf9f5' : '#0b0812';
};
// phím tắt (desktop)
addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && typeof t.matches === 'function' && t.matches('input,textarea')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { closeModals(); closeSheet(); $('#drawerBackdrop').hidden = true; }
  if (e.key === ' ') { e.preventDefault(); spinOnce(); }
  if (e.key.toLowerCase() === 't') spinTen();
});
// KHÔNG chặn mặc định touchend nữa: trước đây chặn double-tap làm chạm nhanh bị nuốt.
// Đã có touch-action: manipulation + viewport nên không cần hacks.


/* ============================================================================
   BỐI CẢNH: THỜI TIẾT · GIỜ · GU KHẨU VỊ · NHẬT KÝ · THỰC ĐƠN HÔM NAY
   ============================================================================ */
const PRICE_MID = { 1: 25000, 2: 45000, 3: 90000, 4: 160000 };
const MEAL_ORDER = ['sang', 'trua', 'toi'];
const MENU_SLOT = { sang: 'sang', trua: 'trua', xe: 'trua', toi: 'toi', khuya: 'toi', vat: 'trua' };
const MEAL_HOUR = { sang: [5, 10], trua: [10, 14], xe: [14, 17], toi: [17, 22], khuya: [22, 24], vat: [14, 17] };
function todayKey(dt) { const d = dt || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function mealByHour(h) {
  if (h >= 5 && h < 10) return 'sang';
  if (h >= 10 && h < 14) return 'trua';
  if (h >= 14 && h < 17) return 'vat';
  if (h >= 17 && h < 22) return 'toi';
  return 'khuya';
}
const MEAL_LABEL = { sang: 'bữa sáng', trua: 'bữa trưa', vat: 'ăn vặt', toi: 'bữa tối', khuya: 'ăn khuya' };

state.wx = LS.get('mgd.wx', null);
state.ctxOn = LS.get('mgd.ctxOn', true);
state.diary = LS.get('mgd.diary', []);
state.taste = LS.get('mgd.taste', { style: {}, region: {}, spicy: {}, like: 0, skip: 0 });
state.menu = LS.get('mgd.menu', { date: todayKey(), sang: null, trua: null, toi: null });
state.mealTarget = null;

function saveTaste() { LS.set('mgd.taste', state.taste); }
function saveDiary() { LS.set('mgd.diary', state.diary.slice(-400)); }
function saveMenu() { LS.set('mgd.menu', state.menu); }
function loadWeather() {
  return getPosition().then((pos) => {
    state.pos = pos;
    return apiJSON('/api/weather?lat=' + pos.lat + '&lng=' + pos.lng, () => dirWeather(pos.lat, pos.lng));
  }).then((w) => {
    if (w && !w.error && isFinite(w.temp)) { state.wx = w; LS.set('mgd.wx', w); }
    renderCtxChip();
  }).catch(() => renderCtxChip());
}
function wxIcon(w) {
  if (!w) return '🍽️';
  if (w.storm) return '⛈️';
  if (w.rain) return '🌧️';
  if (w.snow) return '❄️';
  if (w.temp >= 32) return '🔥';
  if (w.temp <= 20) return '🧥';
  return w.isDay ? '☀️' : '🌙';
}
function ctxHint() {
  const w = state.wx, h = new Date().getHours(), meal = mealByHour(h);
  const bits = [];
  if (w) {
    bits.push(Math.round(w.temp) + '°C ' + w.desc);
    if (w.rain || w.storm) bits.push('trời mưa → ưu tiên món nước');
    else if (w.temp >= 32) bits.push('nóng → ưu tiên món mát');
    else if (w.temp <= 22) bits.push('lạnh → ưu tiên món nóng');
  }
  bits.push('đang ' + MEAL_LABEL[meal]);
  return { icon: wxIcon(w), text: bits.join(' · '), meal: meal };
}
function renderCtxChip() {
  const el = $('#ctxChip'); if (!el) return;
  const c = ctxHint();
  el.hidden = false;
  el.classList.toggle('off', !state.ctxOn);
  el.innerHTML = '<b>' + c.icon + '</b><span>' + esc(c.text) + '</span><i>' + (state.ctxOn ? 'đang ưu tiên · tắt' : 'đã tắt ưu tiên · bật') + '</i>';
}
/* trọng số thêm theo thời tiết + giờ + gu khẩu vị */
function biasOf(d) {
  if (!state.ctxOn) return 1;
  const w = state.wx, t = state.taste;
  let m = 1;
  if (w) {
    if (w.rain || w.storm) {
      if (d.style === 'nuoc' || d.style === 'lau') m *= 2.2;
      if (d.style === 'nuong') m *= .75;
    } else if (w.temp >= 32) {
      if (d.style === 'ngot' || d.style === 'uong' || d.style === 'tron' || d.style === 'cuon') m *= 1.7;
      if (d.style === 'nuong' || d.style === 'lau' || d.style === 'chien') m *= .8;
    } else if (w.temp <= 22 || w.snow) {
      if (d.style === 'lau' || d.style === 'nuoc' || d.style === 'nuong' || d.style === 'chien') m *= 1.6;
      if (d.style === 'ngot' || d.style === 'uong') m *= .7;
    }
  }
  const meal = mealByHour(new Date().getHours());
  if (d.meals && d.meals.includes(meal)) m *= 1.8;
  const like = Math.max(4, t.like || 0);
  const st = (t.style[d.style] || 0) / like, rg = (t.region[d.region] || 0) / like;
  m *= 1 + Math.max(-.35, Math.min(.6, st * .5 + rg * .25));
  if (d.spicy > 0) m *= 1 + Math.max(-.3, Math.min(.4, ((t.spicy[d.spicy] || 0) / like) * .5));
  return m;
}
function bumpTaste(d, sign) {
  if (!d) return;
  const t = state.taste;
  t.style[d.style] = Math.max(0, (t.style[d.style] || 0) + sign);
  t.region[d.region] = Math.max(0, (t.region[d.region] || 0) + sign);
  if (d.spicy > 0) t.spicy[d.spicy] = Math.max(0, (t.spicy[d.spicy] || 0) + sign);
  if (sign > 0) t.like = (t.like || 0) + 1; else t.skip = (t.skip || 0) + 1;
  saveTaste();
}
function tasteSummary() {
  const t = state.taste;
  const top = (obj, map) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
  const s = top(t.style || {}), r = top(t.region || {}), sp = top(t.spicy || {});
  const parts = [];
  if (s && s[1] > 0) parts.push('thích ' + (STYLES[s[0]] || s[0]).replace(/\s*\p{Emoji}+/u, '').toLowerCase());
  if (r && r[1] > 0) parts.push('thiên về ' + (REGIONS[r[0]] || r[0]));
  if (sp && sp[1] > 0) parts.push(sp[0] >= 2 ? 'ăn cay được' : 'cay nhẹ');
  if (!parts.length) return { text: 'Chưa đủ dữ liệu — chốt vài món để tao học gu của mày.', like: t.like || 0, skip: t.skip || 0 };
  return { text: parts.join(' · '), like: t.like || 0, skip: t.skip || 0 };
}
/* ---------- NHẬT KÝ ---------- */
function logDiary(d, meal) {
  state.diary.push({ id: d.id, ts: Date.now(), meal: meal || mealByHour(new Date().getHours()) });
  if (state.diary.length > 400) state.diary = state.diary.slice(-400);
  saveDiary();
}
function diaryDays(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.now() - i * 864e5);
    const key = todayKey(dt);
    const items = state.diary.filter(x => todayKey(new Date(x.ts)) === key).map(x => ({ ...x, d: ALL.find(y => y.id === x.id) })).filter(x => x.d);
    out.push({ key: key, label: i === 0 ? 'Hôm nay' : i === 1 ? 'Hôm qua' : new Date(dt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), items: items });
  }
  return out;
}
function menuTotals() {
  const ids = MEAL_ORDER.map(m => state.menu[m]).filter(Boolean);
  const ds = ids.map(id => ALL.find(d => d.id === id)).filter(Boolean);
  return {
    dishes: ds,
    kcal: ds.reduce((a, d) => a + (d.calories || 0), 0),
    protein: ds.reduce((a, d) => a + (d.protein || 0), 0),
    money: ds.reduce((a, d) => a + (PRICE_MID[d.price] || 40000), 0)
  };
}
function menuAdvice() {
  const t = menuTotals(), ds = t.dishes, tips = [];
  if (!ds.length) return ['Bấm "Quay cho bữa này" để app chọn món cho từng bữa.'];
  const regions = ds.map(d => d.region);
  if (new Set(regions).size < ds.length) tips.push('⚠️ Có 2 bữa cùng nền ẩm thực — đổi 1 bữa cho đỡ ngán.');
  if (!ds.some(d => d.veg === 1 || ['tron', 'cuon', 'hap'].includes(d.style))) tips.push('🥗 Chưa có món rau/gỏi — thêm một món cho đủ chất.');
  if (ds.length >= 2 && !ds.some(d => d.style === 'nuoc' || d.style === 'lau')) tips.push('💧 Toàn món khô — cân nhắc thêm món nước.');
  if (t.kcal > 2400) tips.push('🔥 Tổng ~' + t.kcal + ' kcal hơi cao cho một ngày.');
  if (t.kcal > 0 && t.kcal < 900 && ds.length >= 2) tips.push('🍚 Tổng ~' + t.kcal + ' kcal khá thấp.');
  if (t.money > 350000) tips.push('💸 Ước tính ~' + (t.money / 1000) + 'k — khá tốn, cân nhắc món nhà làm.');
  if (!tips.length) tips.push('✅ Thực đơn khá cân đối: đủ kiểu món, có rau, ngân sách ổn.');
  return tips;
}
/* ---------- PANEL HÔM NAY ---------- */
function renderToday() {
  const box = $('#todayBody'); if (!box) return;
  if (state.menu.date !== todayKey()) { state.menu = { date: todayKey(), sang: null, trua: null, toi: null }; saveMenu(); }
  const t = menuTotals();
  const slot = (m) => {
    const d = ALL.find(x => x.id === state.menu[m]);
    return '<div class="slot">' +
      '<div class="slot-h">' + MEALS[m] + '</div>' +
      (d
        ? '<div class="slot-d"><span class="slot-emoji">' + d.emoji + '</span><b>' + esc(d.name) + '</b>' +
          '<span class="slot-meta">' + (d.calories || '?') + ' kcal · ' + (d.protein || '?') + 'g đạm · ' + esc((REGIONS[d.region] || '').replace(/\s*\p{Emoji}+/u, '')) + '</span></div>' +
          '<div class="slot-act"><button class="mini" data-act="slot-spin" data-meal="' + m + '">🔄 Quay lại</button>' +
          '<button class="mini danger" data-act="slot-clear" data-meal="' + m + '">✕ Bỏ</button></div>'
        : '<button class="slot-add" data-act="slot-spin" data-meal="' + m + '">🎰 Quay cho bữa này</button>') +
      '</div>';
  };
  const days = diaryDays(7);
  const taste = tasteSummary();
  box.innerHTML =
    '<div class="today-sum">' +
      '<div><b>' + t.kcal + '</b><span>kcal</span></div>' +
      '<div><b>' + t.protein + 'g</b><span>đạm</span></div>' +
      '<div><b>' + Math.round(t.money / 1000) + 'k</b><span>tiền/ngày</span></div>' +
    '</div>' +
    '<div class="slots">' + MEAL_ORDER.map(slot).join('') + '</div>' +
    '<div class="advice">' + menuAdvice().map(x => '<div>' + x + '</div>').join('') + '</div>' +
    '<div class="sec-h">🧠 Gu của mày</div>' +
    '<div class="taste">' + esc(taste.text) + '<span class="taste-sub">Đã chốt ' + taste.like + ' món · bỏ qua ' + taste.skip + ' lần</span></div>' +
    '<div class="sec-h">📖 Nhật ký 7 ngày</div>' +
    '<div class="diary">' + days.map(day =>
        '<div class="day"><b>' + day.label + '</b>' +
        (day.items.length
          ? day.items.map(it => '<span class="diary-chip">' + it.d.emoji + ' ' + esc(it.d.name) + ' <i>' + (MEALS[it.meal] || '').replace(/\s*\p{Emoji}+/u, '') + '</i></span>').join('')
          : '<span class="diary-empty">chưa ăn gì được ghi</span>') +
        '</div>').join('') + '</div>' +
    '<div class="today-actions">' +
      '<button class="big-btn" data-act="share-menu">📤 Xuất ảnh thực đơn</button>' +
      '<button class="mini" data-act="clear-diary">🧹 Xoá nhật ký</button>' +
    '</div>';
}
function openToday() {
  renderToday();
  $('#todayBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
/* ---------- ẢNH CHIA SẺ (canvas) ---------- */
function shareCard(kind) {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1a1030'); g.addColorStop(.55, '#2a1440'); g.addColorStop(1, '#3a1018');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,190,46,.16)';
  x.beginPath(); x.arc(W / 2, 250, 300, 0, Math.PI * 2); x.fill();
  const dish = kind === 'menu' ? null : state.lastWinner;
  if (kind === 'menu') {
    const t = menuTotals();
    x.textAlign = 'center'; x.fillStyle = '#ffd479';
    x.font = '900 62px system-ui, "Noto Sans", sans-serif';
    x.fillText('THỰC ĐƠN HÔM NAY', W / 2, 130);
    x.font = '600 34px system-ui, sans-serif'; x.fillStyle = '#cbb7ff';
    x.fillText(new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }), W / 2, 190);
    let y = 300;
    MEAL_ORDER.forEach((m) => {
      const d = ALL.find(z => z.id === state.menu[m]);
      x.textAlign = 'left';
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(70, y - 62, W - 140, 150);
      x.fillStyle = '#9be7ff'; x.font = '800 30px system-ui, sans-serif';
      x.fillText((MEALS[m] || m).replace(/\s*\p{Emoji}+/u, '').toUpperCase(), 100, y - 18);
      x.fillStyle = '#fff'; x.font = '900 46px system-ui, sans-serif';
      x.fillText(d ? (d.emoji + ' ' + d.name).slice(0, 26) : '— chưa chọn —', 100, y + 40);
      if (d) { x.fillStyle = '#cbb7ff'; x.font = '600 26px system-ui, sans-serif'; x.fillText((d.calories || '?') + ' kcal · ' + (d.protein || '?') + 'g đạm · ' + (d.rating || '?') + '/10', 100, y + 78); }
      y += 200;
    });
    x.textAlign = 'center'; x.fillStyle = '#ffd479'; x.font = '800 34px system-ui, sans-serif';
    x.fillText('Tổng ~' + t.kcal + ' kcal · ' + t.protein + 'g đạm · ~' + Math.round(t.money / 1000) + 'k', W / 2, y + 40);
  } else if (dish) {
    x.textAlign = 'center'; x.fillStyle = '#ffd479'; x.font = '900 44px system-ui, sans-serif';
    x.fillText('MÓN ĐƯỢC CHỌN', W / 2, 120);
    x.font = '900 150px system-ui, sans-serif'; x.fillText(dish.emoji || '🍽️', W / 2, 330);
    x.fillStyle = '#fff'; x.font = '900 66px system-ui, sans-serif';
    x.fillText(dish.name.slice(0, 22), W / 2, 440);
    x.fillStyle = '#7cf7c8'; x.font = '900 92px system-ui, sans-serif';
    x.fillText((dish.rating || '?') + '/10', W / 2, 570);
    x.fillStyle = '#cbb7ff'; x.font = '600 32px system-ui, sans-serif';
    x.fillText((dish.descr || '').slice(0, 60), W / 2, 640);
    const facts = [['🔥 ' + (dish.calories || '?') + ' kcal', '💪 ' + (dish.protein || '?') + 'g đạm'],
      ['📍 ' + (dish.origin || (REGIONS[dish.region] || '')), '💵 ' + (dish.priceRange || '')]];
    let y = 730;
    facts.forEach(row => { row.forEach((s, i) => { x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(i ? W / 2 + 20 : 70, y - 46, W / 2 - 90, 90); x.fillStyle = '#fff'; x.font = '700 30px system-ui, sans-serif'; x.fillText(String(s).slice(0, 26), i ? W / 2 + 45 : 95, y + 10); }); y += 120; });
    if (dish.tip) { x.fillStyle = '#ffd479'; x.font = '600 28px system-ui, sans-serif'; x.fillText('💡 ' + dish.tip.slice(0, 58), W / 2, y + 30); }
  } else return null;
  x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '700 28px system-ui, sans-serif';
  x.fillText('Món Gì Đây? · 248 món Việt – Tây – Tàu', W / 2, H - 60);
  return c;
}
function shareImage(kind) {
  const c = shareCard(kind);
  if (!c) return toast('⚠️ Chưa có món để chia sẻ');
  const name = kind === 'menu' ? ('thuc-don-' + todayKey()) : ('mon-' + (state.lastWinner ? state.lastWinner.id : 'an'));
  c.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], name + '.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Món Gì Đây?', text: kind === 'menu' ? 'Thực đơn hôm nay' : ('Món: ' + state.lastWinner.name) });
        return;
      }
    } catch (e) { /* người dùng huỷ */ }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('📤 Đã lưu ảnh ' + name + '.png');
  }, 'image/png');
}
/* ---------- QUAY CHO MỘT BỮA ---------- */
function spinForMeal(meal) {
  state.mealTarget = meal;
  closeToday();
  toast('🎯 Đang quay món cho <b>' + (MEALS[meal] || meal) + '</b>');
  setTimeout(spinOnce, 120);
}
function updateDiaryBadge() {
  const b = $('#diaryBadge'); if (!b) return;
  const n = state.diary.filter(x => todayKey(new Date(x.ts)) === todayKey()).length;
  b.textContent = String(n); b.hidden = n === 0;
}
function closeToday() { const b = $('#todayBackdrop'); if (b) b.hidden = true; document.body.style.overflow = ''; }


/* ============================================================================
   LỚP API: ưu tiên /api của server LAN (có cache), nếu không có thì gọi thẳng
   các dịch vụ công khai từ trình duyệt (Photon, Open-Meteo, ipapi.co) — nhờ vậy
   bản deploy tĩnh trên Vercel vẫn chạy đủ tính năng mà không cần serverless.
   ============================================================================ */
let API_MODE = null;                       // 'server' | 'direct'
const LS_TTL = (k, ms) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && Date.now() - v.t < ms) return v.d; } catch (e) {} return null; };
const LS_PUT = (k, d) => { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} };

async function apiMode() {
  if (API_MODE) return API_MODE;
  try {
    const r = await fetch('/api/whereami', { cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.indexOf('json') >= 0) {
      const j = await r.json();
      if (isFinite(j.lat)) { API_MODE = 'server'; return API_MODE; }
    }
  } catch (e) {}
  API_MODE = 'direct';
  return API_MODE;
}
async function apiJSON(path, directFn) {
  if (await apiMode() === 'server') {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.indexOf('json') >= 0) { const j = await r.json(); if (!j.error) return j; }
    } catch (e) {}
  }
  return directFn();
}

/* ---------- gọi thẳng dịch vụ ---------- */
async function dirWhereAmI() {
  const c = LS_TTL('mgd.geo', 6 * 3600 * 1000);
  if (c) return c;
  const j = await (await fetch('https://ipapi.co/json/', { cache: 'no-store' })).json();
  if (!isFinite(j.latitude)) throw new Error('không lấy được vị trí theo IP');
  const out = { lat: j.latitude, lng: j.longitude, city: j.city, region: j.region, country: j.country_name, countryCode: j.country_code, source: 'ip' };
  LS_PUT('mgd.geo', out);
  return out;
}
async function dirReverseGeocode(lat, lng) {
  const j = await (await fetch('https://photon.komoot.io/reverse?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng), { cache: 'no-store' })).json();
  const f = (j.features || [])[0], pr = f && f.properties || {};
  return {
    lat: lat, lng: lng, city: pr.city, region: pr.state || pr.region, district: pr.district,
    country: pr.country, countryCode: pr.countrycode || pr.country_code,
    label: [pr.name, pr.street, pr.district, pr.city, pr.state, pr.country].filter(Boolean).join(', '),
    source: 'reverse'
  };
}
async function dirWeather(lat, lng) {
  const key = 'mgd.wx.' + Number(lat).toFixed(2) + ',' + Number(lng).toFixed(2);
  const c = LS_TTL(key, 15 * 60 * 1000);
  if (c) return c;
  const j = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
    '&current=temperature_2m,apparent_temperature,precipitation,weather_code,is_day,wind_speed_10m&timezone=auto')).json();
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
  LS_PUT(key, out);
  return out;
}
async function dirGeocode(q) {
  const key = 'mgd.geo.q.' + q.toLowerCase();
  const c = LS_TTL(key, 24 * 3600 * 1000);
  if (c) return c;
  const j = await (await fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=1')).json();
  const f = (j.features || [])[0];
  if (!f) throw new Error('không tìm thấy địa chỉ');
  const pr = f.properties || {}, co = (f.geometry && f.geometry.coordinates) || [];
  if (co.length < 2) throw new Error('không có toạ độ');
  const out = {
    lat: co[1], lng: co[0], city: pr.city, region: pr.state || pr.region, district: pr.district,
    country: pr.country, countryCode: pr.countrycode || pr.country_code,
    label: [pr.name, pr.street, pr.district, pr.city, pr.state, pr.country].filter(Boolean).join(', ')
  };
  LS_PUT(key, out);
  return out;
}
const FOOD_KINDS = ['restaurant', 'fast_food', 'cafe', 'food_court', 'ice_cream', 'bar', 'pub', 'bakery', 'deli', 'canteen'];
async function dirPhotonSearch(query, lat, lng, radiusM) {
  const dLat = radiusM / 111000;
  const dLng = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const bbox = (lng - dLng) + ',' + (lat - dLat) + ',' + (lng + dLng) + ',' + (lat + dLat);
  const j = await (await fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(query) +
    '&lat=' + lat + '&lon=' + lng + '&limit=20&bbox=' + bbox)).json();
  const out = [];
  for (const f of (j.features || [])) {
    const pr = f.properties || {};
    const kind = String(pr.osm_value || pr.type || '').toLowerCase();
    if (pr.osm_key !== 'amenity' || FOOD_KINDS.indexOf(kind) < 0) continue;
    const co = (f.geometry && f.geometry.coordinates) || [];
    const name = pr.name || pr.street;
    if (!name || co.length < 2) continue;
    out.push({
      name: String(name).slice(0, 90), lat: co[1], lng: co[0], type: pr.osm_value || '',
      cuisine: (pr.extra && pr.extra.cuisine) || '',
      address: [pr.housenumber, pr.street, pr.district, pr.city].filter(Boolean).join(' '),
      phone: (pr.extra && (pr.extra.phone || pr.extra['contact:phone'])) || ''
    });
  }
  return out;
}
function dirDistM(a, b, c, d) {
  const R = 6371000, t = (x) => x * Math.PI / 180;
  const dLat = t(c - a), dLon = t(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
function dirNorm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
async function dirNearby(lat, lng, radius, dish, kw, cuisine, useOverpass) {
  const words = [...new Set((dirNorm(dish) + ' ' + dirNorm(kw)).split(' ').filter((t) => t.length >= 3))];
  const queries = [...new Set([dish, (kw || '').split('|')[0], words.slice(0, 2).join(' ')].filter((q) => q && q.trim().length >= 3))].slice(0, 3);
  let matched = [], usedRadius = radius;
  for (const rad of [Math.min(radius, 15000)]) {   // đúng mức người dùng chọn, không tự nới
    const seen = new Map();
    const got = await Promise.all(queries.map((q) => dirPhotonSearch(q, lat, lng, rad).catch(() => [])));
    for (const arr of got) for (const pl of arr) {
      const k = pl.name + '@' + pl.lat.toFixed(4) + ',' + pl.lng.toFixed(4);
      if (seen.has(k)) continue;
      const n = dirNorm(pl.name), cu = dirNorm(cuisine);
      const hitName = words.filter((t) => n.includes(t));
      const hitCuisine = cu && dirNorm(pl.cuisine).includes(cu) ? [cu] : [];
      if (!hitName.length && !hitCuisine.length) continue;
      seen.set(k, Object.assign({}, pl, {
        dist: dirDistM(lat, lng, pl.lat, pl.lng), score: hitName.length * 3 + hitCuisine.length * 2,
        maps: 'https://www.google.com/maps/dir/?api=1&destination=' + pl.lat + ',' + pl.lng + '&travelmode=driving'
      }));
    }
    matched = [...seen.values()].filter((p) => p.dist <= rad).sort((a, b) => (b.score - a.score) || (a.dist - b.dist));
    usedRadius = rad;
    if (matched.length >= 3 || rad >= 15000) break;
  }
  return {
    center: { lat: lat, lng: lng }, radius: radius, usedRadius: usedRadius,
    matched: matched.slice(0, 12), nearest: [], sameCuisine: [],
    mapsUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(dish + ' gần đây') + '/@' + lat + ',' + lng + ',13z',
    mapsKeywordUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(dish) + '/@' + lat + ',' + lng + ',13z',
    osmUrl: 'https://www.openstreetmap.org/#map=14/' + lat + '/' + lng
  };
}

/* ============================ KHỞI ĐỘNG ============================ */
(async function init() {
  try {
    const res = await fetch('data/dishes.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    ALL = (await res.json()).dishes;
  } catch (err) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="toast" style="position:static;margin:12px">⚠️ Không tải được dữ liệu (' + esc(err.message) + ').<br>Chạy qua server: <b>npm start</b></div>');
    return;
  }
  const theme = LS.get('mgd.theme', 'dark');
  document.documentElement.dataset.theme = theme;
  $('#themeIcon').textContent = theme === 'light' ? '☀️' : '🌙';
  $('#soundIcon').textContent = state.sound ? '🔊' : '🔇';
  $('#btnSound').classList.toggle('off', !state.sound);

  chipRow($('#mealChips'), MEALS, state.meals);
  chipRow($('#vungChips'), VUNG_CHIPS, state.vung);
  chipRow($('#regionChips'), REGIONS, state.regions);
  chipRow($('#styleChips'), STYLES, state.styles);

  // tự chọn bữa theo giờ
  const h = new Date().getHours();
  const guess = h < 10 ? 'sang' : h < 14 ? 'trua' : h < 17 ? 'xe' : h < 21 ? 'toi' : 'khuya';
  state.meals.add(guess);
  state.mealAuto = true;                 // bữa do đồng hồ chọn -> được phép tự bỏ nếu vùng miền không có món
  applyFilterUI(); updatePity(); updateProgress(); updateFav(); renderHist(); syncPool(); idleTrack();
  updateDiaryBadge(); renderCtxChip(); loadWeather();
  if (state.autoVung && !state.vungManual) detectVungFromPosition();
  const chip = $('#mealChips .chip[data-k="' + guess + '"]'); if (chip) chip.classList.add('on');
  setTimeout(() => toast('Đang là <b>' + MEALS[guess] + '</b> — đã lọc sẵn cho bạn 👌', 2600), 600);

  // preload ảnh hàng đầu để lần quay đầu mượt
  try {
    if (typeof Image !== 'undefined') {
      const warm = [...new Set(ALL.filter(d => d.image).slice(0, 12).map(d => thumb(d.image, 480)))];
      warm.forEach(u => { const i = new Image(); i.decoding = 'async'; i.src = u; });
    }
  } catch {}
  // hook để kiểm thử tự động
  try { window.__mgd = { state: state, biasOf: biasOf, pool: pool, drawOne: drawOne, mealByHour: mealByHour, vungHit: vungHit, vungAvailable: vungAvailable, vungFromPlace: vungFromPlace, vungFromCoords: vungFromCoords, VUNG: VUNG, ALL: function () { return ALL; } }; } catch (e) {}
})();
