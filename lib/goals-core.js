// lib/goals-core.js — MỤC TIÊU CALO / NGÂN SÁCH (thuần, không DOM, không dependency)
// Dùng bởi app.js: bảng tiến độ trong panel 📅 Hôm nay + hệ số giảm trọng số trong drawOne().
// Mọi hàm ở đây KHÔNG đọc localStorage và KHÔNG vẽ HTML — chỉ tính toán để test được riêng.

export const GOAL_KCAL_MAX = 6000;          // kcal/ngày
export const GOAL_MONEY_MAX = 5000000;      // ₫/ngày
export const GOAL_WEEK_MAX = 35000000;      // ₫/tuần
export const GOAL_FACTOR = 0.4;             // món vượt phần còn lại -> ×0.4 (KHÔNG loại khỏi pool)
export const DEFAULT_GOALS = Object.freeze({ kcal: 0, money: 0, week: 0, priority: true });

const intOr0 = (v, max) => {
  const n = Math.round(Number(v));
  return isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

// Chuẩn hoá dữ liệu đọc từ mgd.goals (hỏng/thiếu/rác đều ra mục tiêu 0 = không dùng)
export function normalizeGoals(raw) {
  const o = (raw && typeof raw === 'object') ? raw : {};
  return {
    kcal: intOr0(o.kcal, GOAL_KCAL_MAX),
    money: intOr0(o.money, GOAL_MONEY_MAX),
    week: intOr0(o.week, GOAL_WEEK_MAX),
    priority: o.priority !== false           // mặc định BẬT khi có mục tiêu
  };
}

export const hasGoal = (g) => !!(g && (Number(g.kcal) > 0 || Number(g.money) > 0 || Number(g.week) > 0));

// Ngân sách tiền của một ngày: ưu tiên mức ngày; chỉ đặt tuần thì chia 7.
export function budgetOf(g, scope) {
  if (!g) return 0;
  const money = Number(g.money) > 0 ? Number(g.money) : 0;
  const week = Number(g.week) > 0 ? Number(g.week) : 0;
  if (scope === 'week') return week > 0 ? week : money * 7;
  return money > 0 ? money : (week > 0 ? Math.round(week / 7) : 0);
}

// Tổng đã dùng hôm nay. `ids` là danh sách id món đã ăn/chọn trong ngày (trùng nhau chỉ tính 1 lần).
export function usedToday(ids, byId, priceOf) {
  const seen = new Set();
  let kcal = 0, money = 0, n = 0;
  for (const raw of (Array.isArray(ids) ? ids : [])) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    const d = byId ? byId(raw) : null;
    if (!d) continue;
    kcal += Number(d.calories) || 0;
    money += priceOf ? (Number(priceOf(d)) || 0) : 0;
    n++;
  }
  return { kcal: kcal, money: money, n: n };
}

// Phần CÒN LẠI của hôm nay (không âm: đã vượt thì 0).
export function remainingOf(g, used) {
  const u = used || { kcal: 0, money: 0 };
  const moneyBudget = budgetOf(g, 'day');
  return {
    kcal: Number(g && g.kcal) > 0 ? Math.max(0, Number(g.kcal) - u.kcal) : 0,
    money: moneyBudget > 0 ? Math.max(0, moneyBudget - u.money) : 0
  };
}

/* Hệ số trọng số cho một món:
   - công tắc TẮT hoặc không đặt mục tiêu -> 1 (quay như cũ)
   - món vượt phần kcal còn lại            -> ×GOAL_FACTOR
   - món vượt phần tiền còn lại            -> ×GOAL_FACTOR
   (vượt cả hai -> ×0.16) — món KHÔNG bị loại khỏi pool. */
export function goalFactor(d, g, used, opts) {
  const o = opts || {};
  if (!o.on || !d || !hasGoal(g)) return 1;
  const rem = remainingOf(g, used);
  let m = 1;
  if (Number(g.kcal) > 0 && (Number(d.calories) || 0) > rem.kcal) m *= GOAL_FACTOR;
  if (budgetOf(g, 'day') > 0 && (o.priceOf ? (Number(o.priceOf(d)) || 0) : 0) > rem.money) m *= GOAL_FACTOR;
  return m;
}

// Dữ liệu cho thanh tiến độ "đã dùng / mục tiêu"
export function progressRows(g, used) {
  const u = used || { kcal: 0, money: 0 };
  const rows = [];
  if (Number(g && g.kcal) > 0) {
    rows.push({
      key: 'kcal', label: 'Năng lượng', unit: 'kcal',
      used: Math.round(u.kcal), target: Number(g.kcal),
      left: Math.max(0, Number(g.kcal) - Math.round(u.kcal)),
      pct: Math.max(0, Math.min(100, Math.round(u.kcal / Number(g.kcal) * 100))),
      over: u.kcal > Number(g.kcal)
    });
  }
  const moneyBudget = budgetOf(g, 'day');
  if (moneyBudget > 0) {
    rows.push({
      key: 'money', label: 'Ngân sách', unit: '₫',
      used: Math.round(u.money), target: moneyBudget,
      left: Math.max(0, moneyBudget - Math.round(u.money)),
      pct: Math.max(0, Math.min(100, Math.round(u.money / moneyBudget * 100))),
      over: u.money > moneyBudget
    });
  }
  return rows;
}

// Câu giải thích ngắn để nhét vào chip bối cảnh khi đang ưu tiên mục tiêu
export function goalHint(g, used) {
  if (!hasGoal(g)) return '';
  const rem = remainingOf(g, used);
  const bits = [];
  if (Number(g.kcal) > 0) bits.push(rem.kcal + ' kcal');
  if (budgetOf(g, 'day') > 0) bits.push(Math.round(rem.money / 1000) + 'k');
  return bits.length ? 'còn ' + bits.join(' · ') + ' hôm nay' : '';
}
