// tools/data/data-patch-aliases.mjs — bổ sung tên tra cứu (aliases) cho món mới + món thiếu ảnh.
// Hợp nhất (union) vào tools/data/aliases.json, không xoá alias cũ. Chạy lại được nhiều lần.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FILE = ROOT + 'tools/data/aliases.json';

const PATCH = {
  // ---- 12 món đang thiếu ảnh (tên tra cứu sát nghĩa, không dùng tên chung chung) ----
  'banh-bia': ['Bánh bía', 'Bánh pía', 'Bánh pía Sóc Trăng'],
  // banh-plan (Bánh plan) đã gộp vào banh-flan — KHÔNG tạo lại khoá banh-plan
  'banh-flan': ['Bánh flan', 'Bánh plan'],
  'cha-com': ['Chả cốm', 'Chả cốm Hà Nội'],
  'nuoc-dau': ['Nước đậu đỏ', 'Chè đậu đỏ'],
  'chao-dau-xanh': ['Cháo đậu xanh', 'Cháo đỗ xanh'],
  'com-chay': ['Cơm chay', 'Cơm chay thập cẩm'],
  'com-heo-quay': ['Cơm heo quay', 'Cơm thịt heo quay'],
  'kem-bo': ['Kem bơ', 'Kem bơ dừa'],
  'mien-tron': ['Miến trộn', 'Miến trộn chua ngọt'],
  'pho-chien-phong': ['Phở chiên phồng', 'Phở chiên giòn'],
  'che-thai': ['Chè Thái', 'Chè Thái Lan'],
  'che-ba-mau': ['Chè ba màu', 'Chè thập cẩm'],
  'mi-ga': ['Mì gà', 'Mì gà trứng', 'Mì trứng'],

  // ---- 40 món mới ----
  'pho-kho-gia-lai': ['Phở khô', 'Phở khô Gia Lai', 'Phở hai tô', 'Phở khô Pleiku'],
  'bun-do-da-lat': ['Bún đỏ', 'Bún đỏ Đà Lạt'],
  'ga-nuong-ban-don': ['Gà nướng Bản Đôn', 'Gà nướng Tây Nguyên', 'Gà nướng than'],
  'ruou-can': ['Rượu cần', 'Rượu ché'],
  'ca-suoi-nuong': ['Cá suối nướng', 'Cá nướng lá chuối'],
  'tra-atiso-da-lat': ['Trà atisô', 'Atisô Đà Lạt', 'Atisô'],
  'ca-phe-buon-ma-thuot': ['Cà phê Buôn Ma Thuột', 'Cà phê phin', 'Cà phê đen'],
  'lau-mam': ['Lẩu mắm', 'Lẩu mắm miền Tây'],
  'bun-ken': ['Bún kèn', 'Bún kèn Rạch Giá'],
  'bun-quay': ['Bún quậy', 'Bún quậy Phú Quốc'],
  'hu-tieu-my-tho': ['Hủ tiếu Mỹ Tho', 'Hủ tiếu'],
  'banh-tam-bi': ['Bánh tằm bì', 'Bánh tằm'],
  'nem-lai-vung': ['Nem Lai Vung', 'Nem chua'],
  'banh-bo-thot-not': ['Bánh bò thốt nốt', 'Bánh bò'],
  'bong-dien-dien-xao-tep': ['Bông điên điển', 'Bông điên điển xào tép'],
  'ca-linh-chien-gion': ['Cá linh', 'Cá linh chiên giòn', 'Cá linh chiên'],
  'goi-ca-trich': ['Gỏi cá trích', 'Gỏi cá trích Phú Quốc', 'Cá trích'],
  'luon-um-la-nhau': ['Lươn um', 'Lươn um lá nhàu', 'Lươn'],
  'banh-trang-cuon-thit-heo': ['Bánh tráng cuốn thịt heo', 'Bánh tráng thịt heo', 'Bánh tráng'],
  'goi-ca-nam-o': ['Gỏi cá Nam Ô', 'Gỏi cá'],
  'tre-binh-dinh': ['Tré', 'Tré Bình Định'],
  'banh-ram-it': ['Bánh ram ít', 'Bánh ram', 'Bánh ít'],
  'banh-dap': ['Bánh đập', 'Bánh tráng đập'],
  'banh-mi-cha-ca': ['Bánh mì chả cá', 'Bánh mì chả cá Nha Trang'],
  'banh-phu-the': ['Bánh phu thê', 'Bánh xu xê'],
  'banh-cay': ['Bánh cay'],
  'banh-xeo-tom-nhay': ['Bánh xèo tôm nhảy', 'Bánh xèo'],
  'bun-sua-nha-trang': ['Bún sứa', 'Bún sứa Nha Trang'],
  'rau-muong-xao-toi': ['Rau muống xào tỏi', 'Rau muống', 'Ipomoea aquatica', 'Water spinach'],
  'ga-chien-nuoc-mam': ['Gà chiên nước mắm', 'Gà chiên'],
  'suon-nuong-than': ['Sườn nướng', 'Sườn nướng than', 'Sườn heo nướng'],
  'tom-rang-me': ['Tôm rang me', 'Tôm rang'],
  'banh-bo': ['Bánh bò'],
  'banh-tom': ['Bánh tôm', 'Bánh tôm Hồ Tây'],
  'canh-cua-rau-day': ['Canh cua', 'Canh cua rau đay'],
  'chao-ca-loc': ['Cháo cá lóc', 'Cháo cá'],
  'che-buoi': ['Chè bưởi'],
  'banh-lot-nuoc-cot-dua': ['Bánh lọt', 'Bánh lọt nước cốt dừa'],
  'mam-chung-thit': ['Mắm chưng', 'Mắm chưng thịt'],
  'trung-vit-lon': ['Trứng vịt lộn', 'Hột vịt lộn', 'Balut'],

  // ---- v25: alias để TÊN ẢNH NGUỒN khớp tên món (biến thể tiếng Anh / tên gọi khác) ----
  // Không phải ảnh sai: chỉ là tiêu đề file Commons dùng tên tiếng Anh nên điểm khớp tên thấp.
  'com-trang-trung': ['Cơm trứng chiên', 'Cơm chiên trứng'],  'bulgogi': ['Bulgogi', 'Bò nướng Bulgogi'],
  'canh-kim-chi': ['Kimchi jjigae', 'Canh kim chi'],
  'sashimi': ['Sashimi'],
  'lau-tu-xuyen': ['Lẩu Tứ Xuyên', 'Lẩu cay Tứ Xuyên', 'Chongqing hotpot', 'Mala hot pot']
};

const aliases = JSON.parse(await readFile(FILE, 'utf8'));
let added = 0, keysNew = 0;
for (const [id, list] of Object.entries(PATCH)) {
  const cur = aliases[id];
  if (!cur) { aliases[id] = [...list]; keysNew++; added += list.length; continue; }
  for (const t of list) if (!cur.includes(t)) { cur.push(t); added++; }
}
await writeFile(FILE, JSON.stringify(aliases, null, 1) + '\n');
console.log('alias thêm:', added, '| key mới:', keysNew, '| tổng key:', Object.keys(aliases).length);
