// Gán VÙNG MIỀN cho từng món — dùng cho bộ lọc "Vùng miền" trong app.js
//   vung    : vùng GỐC của món (bac/trung/nam/tay-nam-bo/tay-nguyen/vn/ngoai)
//   dacSan  : true = đặc sản địa phương (chủ yếu chỉ bán ở vùng gốc)
//             false = món phổ biến, bán được khắp nơi (phở, bánh mì, cơm tấm, chè…)
//   vungCo  : MẢNG các vùng ĐANG BÁN món đó (dùng để lọc "ở vùng này có gì")
//             - món phổ biến  -> có ở CẢ 5 vùng
//             - đặc sản       -> chỉ vùng gốc (+ Nam Bộ <-> Tây Nam Bộ vì Tây Nam Bộ nằm trong Nam Bộ)
//             - món ngoại     -> [] (không thuộc vùng nào của VN)
// Chạy: node tools/enrich-vung.mjs
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'data', 'dishes.json');
const VN_REGS = ['bac', 'trung', 'nam', 'tay-nam-bo', 'tay-nguyen'];

// ---------- vùng GỐC (đã chốt ở v21) ----------
const VUNG = {
  bac: [
    'banh-cuon-chay', 'cha-com', 'banh-chung', 'banh-gio', 'banh-troi-nuoc', 'bia-hoi',
    'bun-oc', 'cha-ca-la-vong', 'ca-phe-trung', 'banh-cuon', 'bun-rieu', 'bun-dau-mam-tom',
    'chao-long', 'cha-gio', 'nem-chua', 'banh-duc', 'banh-duc-ngot', 'xoi-xeo', 'bun-cha',
    'pho-bo', 'pho-ga', 'pho-chien-phong', 'pho-tron', 'pho-xao', 'mien-ga', 'mien-cua',
    'chao-trai', 'gio-thu', 'com-rang', 'banh-mi-chao', 'banh-mi-chao-bo', 'banh-mi-chao-pho-mai',
    'banh-mi-chao-trung', 'lau-cua', 'lau-de', 'lau-bo-nhung-dam', 'xoi-man', 'oc-nhoi'
  ],
  trung: [
    'banh-ut-tre', 'banh-beo', 'banh-bot-loc', 'banh-can-chay', 'banh-hoi', 'banh-canh', 'banh-canh-tom',
    'banh-xeo', 'banh-xeo-nhat', 'cao-lau', 'mi-quang', 'nem-nuong', 'lau-ga-la-e', 'bun-bo-hue',
    'com-ga', 'bun-cha-ca', 'banh-mi-heo-quay', 'banh-uot'
  ],
  nam: [
    'banh-bia', 'banh-canh-ghe', 'banh-mi-xui', 'com-nieu', 'banh-cam', 'banh-mi-bo', 'banh-mi-kep-kem',
    'banh-mi-ngot', 'banh-mi-nuong', 'banh-mi-op-la-2', 'banh-trang-sua', 'banh-khot', 'bo-ne',
    'bo-luc-lac', 'bo-nuong-la-lot', 'bot-chieu', 'bun-thit-nuong', 'canh-kho-qua', 'che-ba-mau',
    'cha-lua', 'com-ga-xoi-mo', 'com-heo-quay', 'com-tam-suon', 'ca-kho-to', 'canh-chua',
    'thit-kho-trung', 'goi-cuon', 'hu-tieu-nam-vang', 'hu-tieu-kho', 'tau-hu-ngot', 'banh-trang-tron',
    'banh-mi-thit', 'banh-mi-ga-nuong', 'banh-mi-pate', 'banh-mi-thit-nuong', 'banh-mi-trung',
    'bac-xiu', 'ca-phe-sua-da'
  ],
  'tay-nam-bo': ['bun-mam', 'banh-canh-cua', 'lau-ca-keo', 'banh-tet'],
  'tay-nguyen': ['banh-trang-nuong']
};

// ---------- ĐẶC SẢN ĐỊA PHƯƠNG (không bán phổ biến toàn quốc) ----------
// Mọi món Việt KHÔNG có trong danh sách này được coi là món phổ biến -> bán ở cả 5 vùng.
const DAC_SAN = [
  // miền Bắc
  'cha-com', 'bun-oc', 'cha-ca-la-vong', 'ca-phe-trung', 'banh-duc', 'xoi-xeo',
  'pho-chien-phong', 'chao-trai', 'mien-cua', 'oc-nhoi',
  // miền Trung
  'banh-ut-tre', 'banh-beo', 'banh-bot-loc', 'banh-can-chay', 'banh-hoi', 'cao-lau',
  'mi-quang', 'banh-mi-heo-quay',
  // miền Nam
  'banh-bia', 'banh-canh-ghe', 'banh-mi-xui', 'banh-mi-kep-kem', 'banh-trang-sua', 'banh-khot',
  // Tây Nam Bộ
  'bun-mam', 'banh-canh-cua', 'lau-ca-keo',
  // Tây Nguyên
  'banh-trang-nuong'
];

const byId = new Map();
for (const [vung, ids] of Object.entries(VUNG)) {
  for (const id of ids) {
    if (byId.has(id)) throw new Error('id bị gán 2 lần: ' + id);
    byId.set(id, vung);
  }
}
const dacSanSet = new Set(DAC_SAN);
for (const id of DAC_SAN) if (!byId.has(id)) throw new Error('đặc sản không có vùng gốc: ' + id);

const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const dishIds = new Set(raw.dishes.map(d => d.id));
for (const [vung, ids] of Object.entries(VUNG)) {
  for (const id of ids) if (!dishIds.has(id)) throw new Error('món không tồn tại trong dishes.json: ' + id + ' (vùng ' + vung + ')');
}
const stats = {};
let nDacSan = 0;

const out = raw.dishes.map((d) => {
  const vung = d.region !== 'vn' ? 'ngoai' : (byId.get(d.id) || 'vn');
  const dacSan = d.region === 'vn' && dacSanSet.has(d.id);
  let vungCo;
  if (d.region !== 'vn') vungCo = [];
  else if (!dacSan) vungCo = [...VN_REGS];
  else {
    vungCo = [vung];
    if (vung === 'nam') vungCo.push('tay-nam-bo');
    if (vung === 'tay-nam-bo') vungCo.push('nam');
  }
  if (dacSan) nDacSan++;
  stats[vung] = (stats[vung] || 0) + 1;

  const { id, name, emoji, region, vungCo: _old, dacSan: _old2, ...rest } = d;
  return { id, name, emoji, region, vung, dacSan, vungCo, ...rest };
});

raw.dishes = out;
raw.count = out.length;
raw.vungGeneratedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(raw, null, 1) + '\n');

const avail = {};
for (const k of VN_REGS) avail[k] = out.filter(d => d.region === 'vn' && d.vungCo.includes(k)).length;
console.log('đã ghi', out.length, 'món →', FILE);
console.log('vùng gốc:', JSON.stringify(stats), '| đặc sản địa phương:', nDacSan);
console.log('số món LỌC ĐƯỢC theo từng vùng (món có bán ở vùng đó):', JSON.stringify(avail));
