// ==========================================================================
// lib/opening-hours.js — đọc & tính trạng thái "giờ mở cửa" (OSM opening_hours).
// Thuần JS, KHÔNG dependency, KHÔNG DOM/Node API: app.js (trình duyệt) và test
// (Node) dùng đúng một bản. Mọi phép tính theo giờ của thiết bị (Date local).
//
// Các dạng HỖ TRỢ (đã có test):
//   24/7
//   Mo-Fr 08:00-22:00; Sa,Su 07:00-23:00
//   06:00-10:00,16:00-21:00            (nhiều khoảng trong ngày)
//   18:00-02:00                        (khoảng qua nửa đêm)
//   Mo-Su 00:00-24:00                  (kín ngày)
//   Mo off / Su closed                 (ngày nghỉ)
//   Fr-Mo 09:00-17:00                  (dải ngày vòng qua Chủ nhật)
//   Mo[1] 09:00-12:00                  -> KHÔNG hiểu (trả "chưa rõ")
//   PH off / sunrise-sunset / SH / Jan Mo  -> KHÔNG hiểu (trả "chưa rõ")
// Không hiểu = known:false; KHÔNG đoán bừa (thà "Chưa rõ giờ" còn hơn báo sai).
// ==========================================================================

export const DAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];   // Mon=0 … Sun=6
export const DAY_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const DAY_WORDS = {
  mo: 0, mon: 0, monday: 0,
  tu: 1, tue: 1, tues: 1, tuesday: 1,
  we: 2, wed: 2, weds: 2, wednesday: 2,
  th: 3, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fr: 4, fri: 4, friday: 4,
  sa: 5, sat: 5, saturday: 5,
  su: 6, sun: 6, sunday: 6
};
// từ khoá/ngày đặc biệt mà ta KHÔNG hiểu -> "chưa rõ" thay vì đoán
const UNKNOWN_WORDS = /^(ph|sh|easter|week|month|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|sunrise|sunset|dawn|dusk|unknown|open|comment)$/i;

export function fmtMin(m) {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
function dayWord(w) {
  const k = String(w || '').toLowerCase().replace(/[^a-z]/g, '');
  return Object.prototype.hasOwnProperty.call(DAY_WORDS, k) ? DAY_WORDS[k] : -1;
}
// "Mo-Fr,Sa" -> [0,1,2,3,4,5]; "Fr-Mo" -> [4,5,6,0,1]; không hiểu -> null
export function parseDaySelector(tok) {
  const out = [];
  for (const piece of String(tok == null ? '' : tok).split(',')) {
    if (!piece) return null;
    const m = /^([A-Za-z]+)(?:-([A-Za-z]+))?$/.exec(piece.trim());
    if (!m) return null;
    const a = dayWord(m[1]);
    if (a < 0) return null;
    if (m[2] == null) { out.push(a); continue; }
    const b = dayWord(m[2]);
    if (b < 0) return null;
    if (a <= b) { for (let d = a; d <= b; d++) out.push(d); }
    else { for (let d = a; d <= 6; d++) out.push(d); for (let d = 0; d <= b; d++) out.push(d); }
  }
  return out.length ? [...new Set(out)] : null;
}
const isDayTok = (t) => parseDaySelector(t) !== null;

// "06:00-10:00,16:00-21:00" -> [[360,600],[960,1260]]; "off" -> []; không hiểu -> null
function parseTimes(rest) {
  const s = String(rest || '').replace(/\s+/g, '');
  if (!s) return null;
  if (UNKNOWN_WORDS.test(s)) return null;
  if (/^24\/7$/.test(s)) return [[0, 1440]];
  if (/^(off|closed)$/i.test(s)) return [];
  if (/[+|=]/.test(s) || /\[|\]/.test(s)) return null;    // "+", "||", "Mo[1]"…: ngoài phạm vi
  const out = [];
  for (const piece of s.split(',')) {
    if (UNKNOWN_WORDS.test(piece)) return null;
    const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(piece);
    if (!m) return null;
    const h1 = +m[1], mi1 = +m[2], h2 = +m[3], mi2 = +m[4];
    if (h1 > 24 || h2 > 24 || mi1 > 59 || mi2 > 59) return null;
    const a = h1 * 60 + mi1, b = h2 * 60 + mi2;
    if (a > 1440 || b > 1440) return null;
    // qua nửa đêm (18:00-02:00) hoặc "00:00-00:00" (OSM dùng cho kín ngày)
    out.push([a, b < a ? b + 1440 : (b === a ? a + 1440 : b)]);
  }
  return out;
}

/* ---------- phân tích ---------- */
// trả { ok:true, rules:[{days:[0..6], iv:[[start,end]]}], byDay:[[[s,e]…]×7] } | { ok:false, reason }
export function parseOpeningHours(spec) {
  const raw = String(spec == null ? '' : spec).trim();
  if (!raw) return { ok: false, reason: 'rỗng' };
  if (/^24\s*\/\s*7$/i.test(raw)) {
    return finish([{ days: ALL_DAYS.slice(), iv: [[0, 1440]] }], raw);
  }
  if (UNKNOWN_WORDS.test(raw)) return { ok: false, reason: 'từ khoá không hỗ trợ: ' + raw };
  const rules = [];
  for (const part of raw.split(';')) {
    const seg = part.trim();
    if (!seg) continue;
    const toks = seg.split(/\s+/);
    // 1) phần chọn ngày ở đầu (có thể nhiều token: "Mo-Fr Sa,Su 08:00-…")
    let i = 0;
    let days = null;
    while (i < toks.length && isDayTok(toks[i])) {
      const got = parseDaySelector(toks[i]);
      days = [...new Set((days || []).concat(got))];
      i++;
    }
    const rest = toks.slice(i).join('');
    const iv = parseTimes(rest);
    if (iv === null) return { ok: false, reason: 'không hiểu phần giờ: ' + seg };
    rules.push({ days: days || ALL_DAYS.slice(), iv: iv });
  }
  if (!rules.length) return { ok: false, reason: 'không có quy tắc' };
  return finish(rules, raw);
}
function finish(rules, raw) {
  const byDay = ALL_DAYS.map(() => []);
  const covered = [];
  for (const r of rules) for (const d of r.days) {
    // ngày có quy tắc = BIẾT giờ; ngày không nhắc tới (vd chỉ ghi "Mo off") là CHƯA RÕ, không đoán
    if (!covered.includes(d)) covered.push(d);
    for (const iv of r.iv) byDay[d].push(iv.slice());
  }
  for (const a of byDay) a.sort((x, y) => x[0] - y[0]);
  return { ok: true, raw: raw, rules: rules, byDay: byDay, covered: covered };
}

/* ---------- trạng thái hiện tại ---------- */
function openResult(start, end, nowAbs) {
  const remain = end - nowAbs;
  const allDay = (end - start) >= 1440;
  const closeTxt = fmtMin(end) === '00:00' && end >= 1440 ? '00:00' : fmtMin(end);
  if (allDay) return { known: true, state: 'open', open: true, closesAt: '', opensAt: '', label: '🟢 Đang mở · 24/7' };
  if (remain <= 30) return { known: true, state: 'soon', open: true, closesAt: closeTxt, opensAt: '', label: '🟠 Sắp đóng (≤30 phút) · đóng lúc ' + closeTxt };
  return { known: true, state: 'open', open: true, closesAt: closeTxt, opensAt: '', label: '🟢 Đang mở · đóng lúc ' + closeTxt };
}
// date: Date theo giờ thiết bị (mặc định là bây giờ)
export function openStatus(spec, date) {
  const d = (date instanceof Date) ? date : new Date(date == null ? Date.now() : date);
  const p = parseOpeningHours(spec);
  if (!p.ok) return { known: false, state: 'unknown', open: false, closesAt: '', opensAt: '', label: '⚪ Chưa rõ giờ', reason: p.reason };
  const day = (d.getDay() + 6) % 7;                    // Mon=0 … Sun=6
  const mins = d.getHours() * 60 + d.getMinutes();
  for (const [s, e] of p.byDay[day]) if (mins >= s && mins < e) return openResult(s, e, mins);
  const y = (day + 6) % 7;                             // khoảng qua nửa đêm của HÔM QUA còn hiệu lực
  for (const [s, e] of p.byDay[y]) if (e > 1440 && mins + 1440 >= s && mins + 1440 < e) return openResult(s, e, mins + 1440);
  // hôm nay không có quy tắc nào (vd chỉ ghi "Mo off") -> KHÔNG đoán là đóng
  if (!p.covered.includes(day)) return { known: false, state: 'unknown', open: false, closesAt: '', opensAt: '', label: '⚪ Chưa rõ giờ', reason: 'không có quy tắc cho hôm nay' };
  // đã đóng: tìm lần mở kế tiếp trong 8 ngày (chỉ xét ngày có quy tắc)
  let best = null;
  for (let off = 0; off <= 7 && !best; off++) {
    const dd = (day + off) % 7;
    for (const [s] of p.byDay[dd]) {
      if (off === 0 && s <= mins) continue;
      if (!best || off * 1440 + s < best.abs) best = { abs: off * 1440 + s, off: off, s: s, dd: dd };
    }
    if (best && best.off === off) break;
  }
  if (!best) return { known: true, state: 'closed', open: false, closesAt: '', opensAt: '', label: '🔴 Đã đóng · không rõ giờ mở lại' };
  const when = best.off === 0 ? '' : best.off === 1 ? ' (mai)' : ' (' + DAY_VI[best.dd] + ')';
  return {
    known: true, state: 'closed', open: false, closesAt: '',
    opensAt: fmtMin(best.s), label: '🔴 Đã đóng · mở lại ' + fmtMin(best.s) + when
  };
}
// tiện cho chỗ chỉ cần "quán này đang đóng hay không" (chưa rõ giờ KHÔNG bị coi là đóng)
export const isClosedNow = (spec, date) => openStatus(spec, date).state === 'closed';
