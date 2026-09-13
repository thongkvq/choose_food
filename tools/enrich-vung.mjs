// Gán VÙNG MIỀN (vung) cho từng món — dùng cho bộ lọc "Vùng miền" trong app.js
//   bac         Miền Bắc
//   trung       Miền Trung
//   nam         Miền Nam (Đông Nam Bộ / Sài Gòn)
//   tay-nam-bo  Miền Tây Nam Bộ (ĐBSCL)  — nằm trong Miền Nam về mặt địa lý
//   tay-nguyen  Tây Nguyên
//   vn          Món phổ biến cả nước, không gắn riêng vùng nào
//   ngoai       Món nước ngoài
// Chạy: node tools/enrich-vung.mjs
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'data', 'dishes.json');

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
    'banh-ut-tre', 'banh-beo', 'banh-bot-loc', 'banh-can', 'banh-hoi', 'banh-canh', 'banh-canh-tom',
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

const byId = new Map();
for (const [vung, ids] of Object.entries(VUNG)) {
  for (const id of ids) {
    if (byId.has(id)) throw new Error('id bị gán 2 lần: ' + id);
    byId.set(id, vung);
  }
}

const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const dishes = raw.dishes;
const missing = [];
const stats = {};

const out = dishes.map((d) => {
  let vung = d.region !== 'vn' ? 'ngoai' : (byId.get(d.id) || 'vn');
  if (d.region === 'vn' && !byId.has(d.id)) missing.push(d.id);
  stats[vung] = (stats[vung] || 0) + 1;
  const { id, name, emoji, region, ...rest } = d;
  return { id, name, emoji, region, vung, ...rest };
});

raw.dishes = out;
raw.count = out.length;
raw.vungGeneratedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(raw, null, 1) + '\n');

console.log('đã ghi', out.length, 'món →', FILE);
console.log('phân bố:', JSON.stringify(stats));
console.log('món Việt không gán vùng riêng (để "cả nước"):', missing.length);
console.log(missing.join(', '));
