// lib/search-core.js — TÌM KIẾM MÓN (thuần, không I/O, không dependency)
// Dùng bởi app.js cho lớp tìm kiếm toàn màn hình và ô tìm trong sheet Lọc.
//
//   fold(s)                     -> chữ thường, bỏ dấu tiếng Việt (đ→d), gộp khoảng trắng
//   buildIndex(dishes)          -> chỉ mục nhẹ (name/kw/tags/descr/origin/nhãn vùng-ẩm thực-cách làm)
//   searchDishes(index, q, o)   -> [{dish, score, why}] đã xếp hạng, khớp ĐỦ mọi từ của query
//   suggestDishes(index, q, n)  -> gợi ý "Có phải: …" theo khoảng cách sửa chữ (Levenshtein ≤1/≤2)
//   searchWithSuggest(...)      -> { results, suggestions }
//
// Phần NẶNG (facts.ingredients, detail) chỉ được đọc nếu món đã tải mảnh chi tiết — index
// KHÔNG chụp lại các trường đó, nên tải xong mảnh là tìm được ngay mà không phải dựng lại index.

/* ------------------------------- chuẩn hoá ------------------------------- */
export function fold(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

const hasMark = (s) => fold(s) !== String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

/* --------------------------- nhãn để tìm kiếm --------------------------- */
// Giữ ở đây (không import app.js) để module thuần, test được bằng Node.
export const REGION_LABEL = {
  vn: 'Việt Nam', cn: 'Trung Hoa', jp: 'Nhật Bản', kr: 'Hàn Quốc', th: 'Thái Lan',
  it: 'Ý', fr: 'Pháp', us: 'Mỹ', mx: 'Mexico', in: 'Ấn Độ', tr: 'Trung Đông'
};
const REGION_EXTRA = {
  vn: ['việt', 'viet nam'], cn: ['trung quốc', 'tàu'], jp: ['nhật'], kr: ['hàn'],
  th: ['thái'], it: ['italy', 'ý'], fr: ['âu', 'pháp'], us: ['âu mỹ', 'mỹ'], mx: ['mễ'],
  in: ['ấn'], tr: ['thổ nhĩ kỳ', 'thổ']
};
export const STYLE_LABEL = {
  nuoc: 'Món nước', kho: 'Món khô', chien: 'Chiên', nuong: 'Nướng', hap: 'Hấp',
  tron: 'Trộn', cuon: 'Cuộn', lau: 'Lẩu', ngot: 'Ngọt', uong: 'Đồ uống', song: 'Sống'
};
export const VUNG_LABEL = {
  bac: 'Miền Bắc', trung: 'Miền Trung', nam: 'Miền Nam',
  'tay-nam-bo': 'Miền Tây Nam Bộ', 'tay-nguyen': 'Tây Nguyên',
  vn: 'Cả nước', ngoai: 'Ngoài Việt Nam'
};
const VUNG_EXTRA = {
  bac: ['bắc', 'hà nội'], trung: ['trung', 'huế'], nam: ['nam', 'sài gòn'],
  'tay-nam-bo': ['miền tây', 'tây nam bộ'], 'tay-nguyen': ['tây nguyên', 'đà lạt'],
  vn: ['toàn quốc'], ngoai: ['nước ngoài', 'quốc tế']
};

const TIER_OF = { 1: 'Phổ Thông', 2: 'Ngon', 3: 'Đặc Sắc', 4: 'Huyền Thoại' };

/* ------------------------------- chỉ mục ------------------------------- */
const normWords = (s) => fold(s).split(' ').filter(Boolean);

function aliasList(raw, extra) {
  const out = [];
  if (raw) out.push(raw);
  for (const x of extra || []) out.push(x);
  return out.map((v) => ({ raw: v, f: fold(v), words: normWords(v) })).filter((x) => x.f);
}

function buildEntry(d) {
  const name = String(d.name || '');
  const nameF = fold(name);
  const kws = (Array.isArray(d.kw) ? d.kw : []).map((k) => String(k || '')).filter(Boolean)
    .map((raw) => ({ raw, f: fold(raw), words: normWords(raw) })).filter((x) => x.f);
  const tags = (Array.isArray(d.tags) ? d.tags : []).map((t) => String(t || '')).filter(Boolean)
    .map((raw) => ({ raw, f: fold(raw), words: normWords(raw) })).filter((x) => x.f);
  return {
    dish: d,
    id: d.id,
    name, nameF, nameWords: normWords(name),
    kws, tags,
    descr: String(d.descr || ''), descrF: fold(d.descr),
    origin: String(d.origin || ''), originF: fold(d.origin),
    vungList: aliasList(VUNG_LABEL[d.vung], VUNG_EXTRA[d.vung]),
    regionList: aliasList(REGION_LABEL[d.region], REGION_EXTRA[d.region]),
    styleList: aliasList(STYLE_LABEL[d.style], []),
    suggWords: [...new Set([].concat(normWords(name),
      kws.flatMap((k) => k.words), tags.flatMap((t) => t.words),
      normWords(REGION_LABEL[d.region] || ''), normWords(VUNG_LABEL[d.vung] || ''),
      normWords(STYLE_LABEL[d.style] || ''), normWords(d.origin || '')))].filter(Boolean)
  };
}

export function buildIndex(dishes) {
  const list = (Array.isArray(dishes) ? dishes : []).filter((d) => d && typeof d === 'object');
  return { entries: list.map(buildEntry), byId: new Map(list.map((d) => [d.id, d])) };
}

/* ------------------------- phần nặng (đọc lúc tìm) ------------------------- */
const heavyCache = new WeakMap();
function heavyTexts(d) {
  if (!d || (!d.facts && !d.detail)) return [];
  const hit = heavyCache.get(d);
  if (hit) return hit;
  const out = [];
  if (d.facts && Array.isArray(d.facts.ingredients)) {
    for (const ing of d.facts.ingredients) {
      if (ing) out.push({ kind: 'ingredient', raw: String(ing), f: fold(ing) });
    }
  }
  if (Array.isArray(d.detail)) {
    for (const sec of d.detail) {
      if (!sec) continue;
      const raw = String(sec.t || '') + ' ' + String(sec.body || '');
      out.push({ kind: 'detail', raw: raw.replace(/\s+/g, ' ').trim(), f: fold(raw) });
    }
  }
  heavyCache.set(d, out);
  return out;
}

/* ------------------------------ xếp hạng ------------------------------ */
const PTS = {
  NAME_WORD: 600, NAME_PART: 430,
  KW_WORD: 520, KW_PART: 400,
  TAG: 430,
  META: 400,
  BODY: 300,
  HEAVY: 260
};
const TIERS = { name: 1, kw: 2, tag: 3, meta: 4, body: 5, heavy: 6 };

const wordPrefix = (words, tok) => words.some((w) => w.startsWith(tok));
const wordExact = (words, tok) => words.some((w) => w === tok);

function matchToken(entry, tok) {
  let best = null;
  const take = (score, kind, raw, label) => {
    if (score > (best ? best.score : 0)) best = { score, kind, raw, label };
  };
  // tên món
  if (wordExact(entry.nameWords, tok)) take(PTS.NAME_WORD, 'name', entry.name, 'tên món');
  else if (wordPrefix(entry.nameWords, tok)) take(PTS.NAME_WORD - 20, 'name', entry.name, 'tên món');
  else if (entry.nameF.includes(tok)) take(PTS.NAME_PART, 'name', entry.name, 'tên món');
  // tên khác / tên quán (kw)
  for (const k of entry.kws) {
    if (wordExact(k.words, tok)) take(PTS.KW_WORD, 'kw', k.raw, 'tên khác');
    else if (wordPrefix(k.words, tok)) take(PTS.KW_WORD - 40, 'kw', k.raw, 'tên khác');
    else if (k.f.includes(tok)) take(PTS.KW_PART, 'kw', k.raw, 'tên khác');
  }
  // tags
  for (const t of entry.tags) {
    if (wordExact(t.words, tok)) take(PTS.TAG, 'tag', t.raw, 'từ khoá');
    else if (wordPrefix(t.words, tok)) take(PTS.TAG - 30, 'tag', t.raw, 'từ khoá');
    else if (t.f.includes(tok)) take(PTS.TAG - 80, 'tag', t.raw, 'từ khoá');
  }
  // vùng / ẩm thực / cách chế biến
  for (const a of entry.vungList) {
    if (wordExact(a.words, tok) || a.f === tok) take(PTS.META, 'vung', a.raw, 'vùng');
    else if (wordPrefix(a.words, tok)) take(PTS.META - 20, 'vung', a.raw, 'vùng');
  }
  for (const a of entry.regionList) {
    if (wordExact(a.words, tok) || a.f === tok) take(PTS.META, 'region', a.raw, 'ẩm thực');
    else if (wordPrefix(a.words, tok)) take(PTS.META - 20, 'region', a.raw, 'ẩm thực');
  }
  for (const a of entry.styleList) {
    if (wordExact(a.words, tok) || a.f === tok) take(PTS.META, 'style', a.raw, 'cách chế biến');
    else if (wordPrefix(a.words, tok)) take(PTS.META - 20, 'style', a.raw, 'cách chế biến');
  }
  // mô tả / xuất xứ
  if (wordPrefix(normWords(entry.descr), tok)) take(PTS.BODY, 'descr', entry.descr, 'mô tả');
  else if (entry.descrF.includes(tok)) take(PTS.BODY - 40, 'descr', entry.descr, 'mô tả');
  if (wordPrefix(normWords(entry.origin), tok)) take(PTS.BODY - 10, 'origin', entry.origin, 'xuất xứ');
  else if (entry.originF.includes(tok)) take(PTS.BODY - 50, 'origin', entry.origin, 'xuất xứ');
  // phần nặng (chỉ khi mảnh chi tiết đã tải)
  for (const h of heavyTexts(entry.dish)) {
    if (wordPrefix(normWords(h.raw), tok)) take(PTS.HEAVY, h.kind, h.raw, h.kind === 'ingredient' ? 'nguyên liệu' : 'chi tiết');
    else if (h.f.includes(tok)) take(PTS.HEAVY - 40, h.kind, h.raw, h.kind === 'ingredient' ? 'nguyên liệu' : 'chi tiết');
  }
  return best;
}

function snippet(raw, tok, max) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  const lim = max || 54;
  if (s.length <= lim) return s;
  const f = fold(s);
  const i = f.indexOf(tok);
  if (i < 0) return s.slice(0, lim) + '…';
  const start = Math.max(0, i - 18);
  return (start > 0 ? '…' : '') + s.slice(start, start + lim) + (start + lim < s.length ? '…' : '');
}

function whyOf(hit, tok) {
  if (!hit) return '';
  if (hit.kind === 'name') return '';
  if (hit.kind === 'kw') return 'tên khác: ' + hit.raw;
  if (hit.kind === 'tag') return 'từ khoá: ' + hit.raw;
  if (hit.kind === 'vung') return 'vùng: ' + hit.raw;
  if (hit.kind === 'region') return 'ẩm thực: ' + hit.raw;
  if (hit.kind === 'style') return 'cách chế biến: ' + hit.raw;
  if (hit.kind === 'origin') return 'xuất xứ: ' + hit.raw;
  if (hit.kind === 'descr') return 'mô tả: ' + snippet(hit.raw, tok);
  if (hit.kind === 'detail') return 'chi tiết: ' + snippet(hit.raw, tok);
  if (hit.kind === 'ingredient') return 'nguyên liệu: ' + hit.raw;
  return '';
}

/* Món khớp đủ mọi từ của query; mỗi từ lấy trường khớp mạnh nhất. */
function scoreEntry(entry, q, qTokens, rawTokens, rawQ) {
  const per = [];
  for (const tok of qTokens) {
    const hit = matchToken(entry, tok);
    if (!hit) return null;
    per.push({ tok, hit });
  }
  let score = Math.min(...per.map((p) => p.hit.score));
  const nameF = entry.nameF;
  const allNamePrefix = qTokens.every((tok) => wordPrefix(entry.nameWords, tok));
  if (nameF === q) score = Math.max(score, 1000);
  else if (nameF.startsWith(q)) score = Math.max(score, 800);
  else if (allNamePrefix) score = Math.max(score, 700);
  else if (nameF.includes(q)) score = Math.max(score, 520);
  // tên khác trùng hẳn query: "banh plan" -> kw "Bánh plan" của Bánh flan
  const kwExact = entry.kws.some((k) => k.f === q);
  if (kwExact) score += 90;
  // query CÓ DẤU: món khớp đúng dấu được cộng điểm (gõ "phở" thì Phở > "Phô mai…")
  const marked = hasMark(q);
  let bonus = 0;
  if (marked) {
    for (let i = 0; i < per.length; i++) {
      const raw = String(per[i].hit.raw || '').toLowerCase();
      const tokRaw = rawTokens[i] || '';
      if (tokRaw && raw.includes(tokRaw)) { bonus += 30; per[i].marked = true; }
    }
  }
  score += Math.min(90, bonus);
  // tie-break theo điểm đánh giá (chênh lệch nhỏ, không đổi thứ hạng nhóm)
  score += (Number(entry.dish.rating) || 0) * 0.4;

  // "why": ưu tiên trường giải thích mạnh nhất (bỏ qua tên món — tên đã hiện ở trên)
  let why = '';
  const explain = per.filter((p) => p.hit.kind !== 'name')
    .sort((a, b) => (TIERS[a.hit.kind] || 9) - (TIERS[b.hit.kind] || 9) || b.hit.score - a.hit.score)[0];
  if (explain) why = whyOf(explain.hit, explain.tok);
  else if (marked && per.some((p) => p.marked)) why = 'khớp đúng dấu: ' + String(per[0].hit.raw || '');
  if (!why && kwExact) why = 'tên khác: ' + entry.kws.find((k) => k.f === q).raw;
  if (!why && nameF.startsWith(q)) why = 'tên bắt đầu bằng “' + rawQ + '”';
  return { dish: entry.dish, score: Math.round(score * 100) / 100, why };
}

export function searchDishes(index, query, opts) {
  const o = opts || {};
  const q = fold(query);
  if (!index || !Array.isArray(index.entries) || !q) return [];
  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const rawQ = String(query == null ? '' : query).replace(/\s+/g, ' ').trim();
  const rawTokens = rawQ.toLowerCase().split(' ').filter(Boolean);
  const out = [];
  for (const entry of index.entries) {
    const r = scoreEntry(entry, q, tokens, rawTokens, rawQ);
    if (r) out.push(r);
  }
  out.sort((a, b) => b.score - a.score
    || (Number(b.dish.rating) || 0) - (Number(a.dish.rating) || 0)
    || String(a.dish.name).localeCompare(String(b.dish.name), 'vi'));
  const limit = Math.max(1, Math.min(200, o.limit || 30));
  return out.slice(0, limit);
}

/* --------------------------- gợi ý khi gõ sai --------------------------- */
function lev(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;      // cắt sớm: không thể quay lại ≤ max
    prev = cur;
  }
  return prev[b.length];
}

export function suggestDishes(index, query, opts) {
  const o = opts || {};
  const q = fold(query);
  if (!index || !Array.isArray(index.entries) || !q) return [];
  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const n = Math.max(1, Math.min(10, o.limit || 3));
  const scored = [];
  for (const entry of index.entries) {
    let dist = 0, ok = true;
    for (const tok of tokens) {
      const max = tok.length <= 4 ? 1 : 2;
      let best = max + 1;
      for (const w of entry.suggWords) {
        const d = lev(tok, w, max);
        if (d < best) best = d;
        if (best === 0) break;
      }
      if (best > max) { ok = false; break; }
      dist += best;
    }
    if (ok) scored.push({ dish: entry.dish, dist, rating: Number(entry.dish.rating) || 0 });
  }
  scored.sort((a, b) => a.dist - b.dist || b.rating - a.rating);
  const seen = new Set();
  return scored.filter((x) => {
    if (seen.has(x.dish.id)) return false;
    seen.add(x.dish.id); return true;
  }).slice(0, n).map((x) => x.dish);
}

export function searchWithSuggest(index, query, opts) {
  const o = opts || {};
  const results = searchDishes(index, query, o);
  const suggestions = results.length ? [] : suggestDishes(index, query, { limit: o.suggestLimit || 3 });
  return { query: String(query == null ? '' : query), results, suggestions };
}

export { TIER_OF };
