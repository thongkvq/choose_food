// lib/group-core.js — QUAY CHO NHÓM, chuyền tay một máy (thuần, không DOM, không dependency)
// Vòng chơi: nhập 2–8 tên -> lần lượt từng người gạch tối đa N món (0–5) -> quay trên pool đã trừ món bị gạch.
// app.js giữ UI; module này giữ chuẩn hoá tên, danh sách gợi ý và phép trừ pool để test được riêng.

export const GROUP_MIN = 2;
export const GROUP_MAX = 8;
export const VETO_MAX = 5;
export const VETO_DEFAULT = 2;
export const SUGGEST_N = 12;

// "An, Bình; Chi\nDũng" -> ['An','Bình','Chi','Dũng'] — cắt khoảng trắng, bỏ tên rỗng,
// bỏ tên trùng (không phân biệt hoa thường), cắt còn tối đa 8 người.
export function parseNames(text) {
  const raw = Array.isArray(text) ? text.join(',') : String(text == null ? '' : text);
  const out = [], seen = new Set();
  for (const part of raw.split(/[,;\n\r\t+]+/)) {
    const name = part.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= GROUP_MAX) break;
  }
  return out;
}

export const clampVetoMax = (n) => {
  const v = Math.round(Number(n));
  return isFinite(v) ? Math.max(0, Math.min(VETO_MAX, v)) : VETO_DEFAULT;
};

// Dữ liệu nhớ lại giữa các lần (mgd.group): danh sách tên gần nhất + số món được gạch
export function normalizeGroup(raw) {
  const o = (raw && typeof raw === 'object') ? raw : {};
  const names = parseNames(o.names);
  return {
    names: names.length >= GROUP_MIN ? names : [],
    vetoMax: o.vetoMax === undefined ? VETO_DEFAULT : clampVetoMax(o.vetoMax)
  };
}

// Gợi ý món cho một lượt: pool hiện tại (đã theo bộ lọc + bữa), điểm cao trước, cùng điểm thì
// ưu tiên bậc cao hơn rồi tới tên — cắt SUGGEST_N món. Không đổi pool gốc.
export function suggestDishes(list, n) {
  const want = Math.max(1, Math.round(n || SUGGEST_N));
  const score = (d) => (Number(d && d.rating) || 0) * 10 + (Number(d && d.tier) || 0);
  return (Array.isArray(list) ? list.slice() : [])
    .sort((a, b) => score(b) - score(a) || String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, want);
}

// Tập id bị gạch của CẢ nhóm (hợp các lượt). turns: [{name, veto:[id]}]
export function vetoedIds(turns) {
  const out = new Set();
  for (const t of (Array.isArray(turns) ? turns : [])) {
    for (const id of (t && Array.isArray(t.veto) ? t.veto : [])) if (id) out.add(id);
  }
  return out;
}

// Pool sau khi trừ món bị gạch. KHÔNG tự nới: rỗng thì trả [] để app báo rõ.
export function poolWithoutVeto(list, veto) {
  const drop = veto instanceof Set ? veto : new Set(Array.isArray(veto) ? veto : []);
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((d) => d && !drop.has(d.id));
}

// Tổng kết để in ở popup kết quả
export function groupSummary(names) {
  const arr = (Array.isArray(names) ? names : []).filter(Boolean);
  return arr.length ? arr.join(', ') : '';
}
