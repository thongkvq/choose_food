// tools/enrich-dishes.mjs — thêm điểm đánh giá, nhận xét, dinh dưỡng (ước tính), giá, thời điểm, mẹo cho từng món.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(await readFile(ROOT + 'data/dishes.json', 'utf8'));

function hash(id) { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
const pick = (arr, id, salt = 0) => arr[(hash(id) + salt * 7919) % arr.length];
const has = (s, ...ks) => ks.some(k => s.includes(k));

// ---------- 1) nhận xét riêng cho món tiêu biểu ----------
const REVIEW = {
  'pho-bo': 'Nước dùng ninh xương 8–12 tiếng, quế hồi thơm nhẹ, bánh phở mềm mà không bở. Bò tái chín tới đâu thơm tới đó — ăn kèm giá, húng quế, chanh và chút tương ớt.',
  'pho-ga': 'Vị thanh, ít dầu mỡ hơn phở bò nên dễ ăn cả khi mệt. Gà ta xé sợi ngọt thịt, nước dùng trong — hợp bữa sáng hay khi cần món nhẹ bụng.',
  'bun-bo-hue': 'Đậm, cay, thơm sả và mắm ruốc — món "gây nghiện" của miền Trung. Ai không quen mắm ruốc nên dặn bớt, còn dân ăn cay thì đây là đỉnh.',
  'bun-cha': 'Chả viên nướng than thơm khói, chan nước mắm chua ngọt vừa phải. Ăn kèm bún rối và rau sống, đây là bữa trưa rất cân bằng.',
  'banh-mi-thit': 'Vỏ giòn rụm, trong mềm, pate béo quyện đồ chua và ngò. Rẻ, nhanh, no — món ăn sáng quốc dân khó chê.',
  'com-tam-suon': 'Sườn nướng mật ong cháy cạnh thơm, ăn cùng bì, chả, trứng và mỡ hành. Bữa sáng "chắc bụng" nhất của Sài Gòn.',
  'goi-cuon': 'Tươi mát, ít calo, ăn là thấy nhẹ người. Nước chấm tương đậu phộng là linh hồn — thiếu nó là mất một nửa vị ngon.',
  'cha-gio': 'Vỏ giòn tan, nhân thịt mộc nhĩ đậm đà. Cuốn cùng xà lách và rau thơm để đỡ ngấy.',
  'banh-xeo': 'Rìa giòn, nhân tôm thịt giá ngọt, mùi nghệ đặc trưng. Cuốn cải xanh chấm mắm ngọt là chuẩn vị miền Nam.',
  'sushi': 'Cơm giấm vừa độ, cá tươi ngọt, wasabi the nhẹ. Ăn bằng tay, chấm ít nước tương để không phá vị cá.',
  'ramen': 'Nước dùng xương ninh đậm, sợi mì dai, trứng lòng đào béo. Nóng, nhiều vị, ăn xong là ấm cả người.',
  'pad-thai': 'Chua từ me, ngọt từ đường thốt nốt, bùi từ đậu phộng — ba vị cân rất khéo. Vắt thêm chanh cho thơm.',
  'tom-yum': 'Chua cay nồng mùi sả lá chanh, đánh thức cả vị giác. Ai yếu bụng nên gọi mức cay thấp.',
  'burger': 'Bò nướng mọng nước, phô mai chảy quyện sốt đặc trưng. Nhiều năng lượng — ăn xong no tới chiều.',
  'pizza': 'Đế mỏng giòn, mozzarella kéo sợi, sốt cà chua chua dịu. Món chia sẻ dễ được lòng cả bàn.',
  'steak': 'Vỏ ngoài cháy xém thơm bơ, trong hồng mềm ngọt thịt. Nghỉ thịt vài phút trước khi cắt là điểm quyết định độ ngon.',
  'mi-quang': 'Sợi mì vàng nghệ, ít nước nhưng đậm, có bánh tráng nướng giòn rắc lên. Vị miền Trung rõ rệt.',
  'cao-lau': 'Sợi mì tro dai đặc trưng chỉ Hội An mới có, thịt xá xíu và da heo giòn. Đậm và hơi khô — nhớ chan thêm nước.',
  'bun-dau-mam-tom': 'Mắm tôm đánh bọt thơm nồng, đậu hũ vàng giòn, chả cốm dai. Món "gây tranh cãi" nhưng dân ghiền thì mê.',
  'xoi-xeo': 'Nếp dẻo, đậu xanh bùi, hành phi thơm, mỡ nước bóng nhẹ. Sáng ăn một gói là no tới trưa.',
  'chao-long': 'Cháo trắng nóng, lòng non béo, huyết mềm, thêm hẹ và tiêu. Món khuya kinh điển của dân nhậu.',
  'banh-cuon': 'Bánh tráng mỏng tang, nhân thịt mộc nhĩ đậm, rắc hành phi. Phải ăn nóng mới cảm được độ mềm.',
  'bot-chieu': 'Ngoài giòn trong bùi, đập trứng lên là dậy mùi. Ăn kèm đu đủ chua để đỡ ngấy.',
  'banh-trang-nuong': 'Giòn rụm, béo từ trứng và phô mai, thơm mùi nướng than. Món ăn vặt "gây nghiện" của Đà Lạt.',
  'com-ga': 'Cơm nghệ vàng ươm, gà xé trộn rau răm thơm, hành tăm phi vàng. Vị Hội An thanh mà đậm.',
  'bo-luc-lac': 'Bò mềm ngọt, áp chảo nhanh nên giữ nước thịt. Chấm muối tiêu chanh là ngon nhất.',
  'ga-ran': 'Vỏ giòn xù, thịt mọng, ăn nóng mới đã. Nhiều dầu mỡ nên ăn kèm củ cải muối cho đỡ ngấy.',
  'bibimbap': 'Trộn đều tay là điều kiện bắt buộc: cơm, rau, trứng, sốt gochujang quyện thành một vị hài hoà.',
  'tokbokki': 'Bánh gạo dai, sốt ớt ngọt cay sánh. Cay khá nên đi kèm nước hoặc cơm nắm.',
  'dimsum': 'Nhiều món nhỏ, ăn nhẩn nha cùng trà nóng. Há cảo tôm là món nên gọi đầu tiên.',
  'tiramisu': 'Mascarpone béo mịn, vị cà phê đắng nhẹ, phủ cacao. Ăn lạnh và để ráo vài phút là ngon nhất.',
  'che-ba-mau': 'Ba tầng đậu, thạch và nước cốt dừa, đá mát. Tráng miệng rẻ mà dễ chịu.',
  'ca-phe-sua-da': 'Đậm, đắng, ngọt hậu — năng lượng thật sự cho buổi sáng. Nhớ khuấy đều trước khi uống.',
  'tra-sua': 'Béo vừa, trân châu dai, chọn 50% đường là cân bằng nhất. Uống ngay khi đá còn tan chậm.',
  'bia-hoi': 'Mát, nhẹ, uống nhanh say — món "xã giao" của vỉa hè. Lạc rang muối là bạn đồng hành chuẩn.',
  'vit-quay': 'Da giòn bóng, thịt mềm thơm, cuốn bánh tráng chấm sốt. Món tiệc đáng tiền.',
  'heo-quay': 'Da rụm giòn, mỡ mỏng, thịt đậm. Cắt lát mỏng chấm tương ngọt là hết nồi cơm.',
  'banh-khot': 'Vỏ ngoài giòn, trong mềm, tôm ngọt. Cuốn rau chấm mắm ngọt là công thức không thể sai.',
  'nem-nuong': 'Thơm sả, dai mềm, cuốn bánh tráng với rau rừng. Mắm nêm là phần quyết định.',
  'lau-thai': 'Chua cay dễ ăn cho cả nhóm, nhúng gì cũng hợp. Càng đông càng vui — món của tụ tập.',
  'banh-mi-chao': 'Chảo gang nóng bốc khói, pate trứng xíu mại quyện vào nhau. Xúc bánh mì nóng là chuẩn bài.',
  'pho-tron': 'Khô, đậm, trộn tương và đậu phộng — lạ miệng so với phở nước. Hợp người không thích ăn nước.',
  'mi-cay': 'Thử thách thật sự: 7 cấp độ, cấp 3 trở lên là toát mồ hôi. Gọi thêm phô mai để dịu cay.',
  'banh-trang-tron': 'Chua, cay, mặn, ngọt đủ cả, giòn sần sật. Món tuổi thơ chỉ mất vài phút là xong.',
  'khoai-tay-chien': 'Ngoài giòn trong bùi, rắc chút muối là đủ. Ăn nóng ngon hơn hẳn — nguội là mất giòn.',
  'banh-flan': 'Mềm mịn, caramel đắng nhẹ cân với vị ngọt. Ăn lạnh và để trong tủ 1–2 tiếng là ngon nhất.',
  'che-khuc-bach': 'Khúc bạch mát lạnh, mềm như thạch sữa, nhãn ngọt thanh. Món tráng miệng rất "dễ chịu".',
  'dimsum-tong-hop': 'Điểm tâm kiểu Hong Kong: nhiều món nhỏ, vị thanh, ăn cùng trà nóng. Thích hợp lai rai buổi sáng.'
};

// ---------- 2) nguồn gốc ----------
const ORIGIN = {
  'pho-bo': 'Nam Định / Hà Nội', 'pho-ga': 'Hà Nội', 'bun-bo-hue': 'Huế', 'bun-cha': 'Hà Nội',
  'com-tam-suon': 'Sài Gòn', 'banh-mi-thit': 'Sài Gòn', 'mi-quang': 'Quảng Nam', 'cao-lau': 'Hội An',
  'banh-xeo': 'Miền Trung / Nam Bộ', 'banh-khot': 'Vũng Tàu', 'banh-can-chay': 'Phan Rang', 'banh-cong': 'Huế',
  'banh-beo': 'Huế', 'bun-rieu': 'Miền Bắc', 'bun-mam': 'Miền Tây', 'banh-canh': 'Miền Trung / Nam',
  'hu-tieu-nam-vang': 'Nam Vang (Campuchia) → Sài Gòn', 'xoi-xeo': 'Hà Nội', 'chao-long': 'Miền Bắc',
  'bot-chieu': 'Sài Gòn', 'banh-trang-nuong': 'Đà Lạt', 'nem-nuong': 'Ninh Hoà (Khánh Hoà)',
  'bo-luc-lac': 'Sài Gòn', 'thit-kho-trung': 'Miền Nam', 'ca-kho-to': 'Miền Nam', 'goi-cuon': 'Miền Nam',
  'banh-cuon': 'Miền Bắc', 'banh-bot-loc': 'Huế', 'banh-gio': 'Miền Bắc', 'banh-chung': 'Miền Bắc',
  'banh-tet': 'Miền Nam', 'banh-trung-thu': 'Trung Hoa', 'sushi': 'Nhật Bản', 'mi-ramen': 'Nhật Bản',
  'udon': 'Nhật Bản', 'okonomiyaki': 'Osaka (Nhật)', 'takoyaki': 'Osaka (Nhật)', 'gyudon': 'Nhật Bản',
  'pad-thai': 'Thái Lan', 'tom-yum': 'Thái Lan', 'som-tam': 'Thái Lan (Isan)', 'kimbap': 'Hàn Quốc',
  'bibimbap': 'Hàn Quốc', 'tokbokki': 'Hàn Quốc', 'ga-ran': 'Hàn Quốc (biến tấu)', 'burger': 'Mỹ',
  'pizza': 'Ý', 'spaghetti': 'Ý', 'carbonara': 'Ý (Roma)', 'steak': 'Pháp / Âu', 'fish-chips': 'Anh',
  'taco': 'Mexico', 'burrito': 'Mexico', 'nachos': 'Mexico', 'quesadilla': 'Mexico', 'churros': 'Tây Ban Nha',
  'ca-ri-ga': 'Ấn Độ', 'butter-chicken': 'Ấn Độ (Delhi)', 'biryani': 'Ấn Độ', 'samosa': 'Ấn Độ',
  'kebab': 'Thổ Nhĩ Kỳ', 'shawarma': 'Trung Đông', 'hummus': 'Trung Đông', 'falafel': 'Trung Đông',
  'baklava': 'Thổ Nhĩ Kỳ', 'shakshuka': 'Bắc Phi / Trung Đông', 'tiramisu': 'Ý (Veneto)',
  'cheesecake': 'Hy Lạp / Mỹ', 'croissant': 'Pháp', 'macaron': 'Pháp', 'donut': 'Mỹ', 'waffle': 'Bỉ',
  'pancake': 'Mỹ', 'banh-mi-xui': 'Sài Gòn', 'banh-mi-op-la-2': 'Sài Gòn'
};

// ---------- 3) ước tính dinh dưỡng / giá ----------
const STYLE_CAL = { nuoc: 450, kho: 620, chien: 640, nuong: 600, hap: 380, tron: 300, cuon: 280, lau: 720, ngot: 340, uong: 180 };
const STYLE_PROTEIN = { nuoc: 24, kho: 28, chien: 25, nuong: 32, hap: 22, tron: 15, cuon: 14, lau: 35, ngot: 6, uong: 3 };
const PRICE_BY_LEVEL = { 1: [12000, 30000], 2: [25000, 55000], 3: [45000, 95000], 4: [90000, 220000] };

function estimate(d) {
  let cal = STYLE_CAL[d.style] || 450, pro = STYLE_PROTEIN[d.style] || 20;
  const n = d.name.toLowerCase();
  if (has(n, 'chay', 'đậu hũ', 'rau', 'salad', 'gỏi', 'bông cải', 'gạo lứt')) { cal -= 140; pro -= 6; }
  if (has(n, 'ức gà', 'cá hồi', 'poke')) { cal -= 60; pro += 14; }
  if (has(n, 'phô mai', 'bơ', 'kem', 'socola', 'mật ong')) cal += 110;
  if (has(n, 'chiên', 'rán', 'xào', 'xối mỡ', 'giòn')) cal += 90;
  if (has(n, 'lẩu', 'nướng', 'hải sản', 'bò', 'dê', 'heo quay', 'vịt')) pro += 6;
  if (has(n, 'chè', 'trà sữa', 'sinh tố', 'nước', 'cà phê', 'bia', 'vang')) { cal = Math.round(cal * .6); pro = Math.max(2, pro - 8); }
  cal = Math.max(90, Math.round(cal / 10) * 10); pro = Math.max(2, Math.round(pro));
  const [pmin, pmax] = PRICE_BY_LEVEL[d.price] || [25000, 55000];
  let lo = pmin, hi = pmax;
  // chia nhóm theo thứ tự ưu tiên để không nhận nhầm (vd "phở bò" không phải món tiệc)
  const STREET = ['bánh mì', 'xôi', 'quẩy', 'bánh tiêu', 'bánh cam', 'bánh tráng', 'khoai', 'cá viên', 'xiên', 'bắp'];
  const NOODLE = ['phở', 'bún', 'mì', 'miến', 'hủ tiếu', 'cháo', 'bánh canh', 'bánh cuốn', 'bánh ướt', 'bánh xèo', 'bánh khọt', 'bánh căn', 'bánh bèo', 'bánh bột lọc', 'gỏi cuốn', 'bánh đúc', 'bánh giò', 'bánh bao', 'há cảo', 'dimsum'];
  const RICE = ['cơm', 'xôi mặn'];
  const PARTY = ['lẩu', 'nướng', 'hải sản', 'vịt quay', 'heo quay', 'steak', 'bít tết', 'bò lúc lắc', 'gà nướng', 'dê', 'tiệc', 'nguyên con'];
  // STREET kiểm trước vì "bánh mì" chứa "mì"
  if (has(n, ...PARTY)) { lo = Math.max(lo, 90000); hi = Math.max(hi, 350000); }
  else if (has(n, ...STREET)) { lo = Math.min(lo, 15000); hi = Math.min(hi, 35000); }
  else if (has(n, ...RICE)) { lo = Math.max(lo, 30000); hi = Math.max(hi, 95000); }
  else if (has(n, ...NOODLE)) { lo = Math.max(lo, 22000); hi = Math.max(hi, 70000); }
  const fmt = (v) => v >= 1000 ? Math.round(v / 1000) + 'k' : v + 'đ';
  const fullness = cal >= 650 ? 5 : cal >= 500 ? 4 : cal >= 350 ? 3 : cal >= 200 ? 2 : 1;
  const proteinLabel = pro >= 30 ? 'Rất cao' : pro >= 22 ? 'Cao' : pro >= 14 ? 'Vừa' : 'Thấp';
  return { calories: cal, protein: pro, proteinLabel, priceRange: fmt(lo) + ' – ' + fmt(hi), fullness };
}

const MEAL_LABEL = { sang: 'Buổi sáng', trua: 'Buổi trưa', xe: 'Xế chiều', toi: 'Buổi tối', khuya: 'Đêm khuya', vat: 'Ăn vặt' };
function bestFor(d, est) {
  const out = [];
  const n = d.name.toLowerCase();
  if (d.veg === 1) out.push('Người ăn chay');
  if (est.protein >= 28 && (['nuong', 'hap', 'kho', 'tron'].includes(d.style) || has(n, 'ức gà', 'cá hồi', 'bò', 'tôm', 'hải sản'))) out.push('Tập gym / cần đạm');
  if (est.calories <= 350) out.push('Ăn nhẹ, giảm cân');
  if (d.spicy === 0) out.push('Trẻ em, người không ăn cay');
  if (d.spicy >= 2) out.push('Dân ăn cay');
  if (d.style === 'lau' || d.style === 'nuong' || has(n, 'bia', 'nhậu')) out.push('Tụ tập, nhậu');
  if (d.minutes <= 15) out.push('Bữa gấp, ít thời gian');
  if (d.price === 1) out.push('Sinh viên, tiết kiệm');
  if (d.price >= 3 && (d.style === 'nuong' || d.style === 'lau' || has(n, 'steak', 'vịt', 'heo quay'))) out.push('Đãi khách, hẹn hò');
  if (d.style === 'ngot' || d.style === 'uong') out.push('Tráng miệng, giải khát');
  if (d.style === 'nuoc' && d.spicy <= 1) out.push('Người đang mệt, cần dễ tiêu');
  if (!out.length) out.push('Bữa hằng ngày');
  return out.slice(0, 3);
}

const TIPS = [
  'Ăn ngay khi còn nóng để giữ trọn mùi thơm.',
  'Thêm rau sống hoặc dưa chua để bữa ăn cân bằng hơn.',
  'Vắt thêm chanh/ớt tươi sẽ dậy mùi rõ rệt.',
  'Không nên để nguội lâu — món sẽ mất độ giòn/độ ngọt.',
  'Ăn kèm trà nóng hoặc nước lọc sẽ dễ chịu hơn đồ ngọt có gas.',
  'Nêm nếm lại trước khi ăn vì món này khá nhạy với độ mặn.',
  'Nếu ăn cùng nhóm, nên gọi thêm một món rau để đỡ ngấy.',
  'Chọn phần ít dầu mỡ hơn nếu bạn đang ăn kiêng.'
];

const MOOD = {
  vn: ['Đậm đà kiểu Việt, cân bằng giữa ngọt – mặn – chua.', 'Vị Việt quen thuộc, ăn hoài không chán.', 'Hương vị truyền thống, dễ ăn với hầu hết mọi người.'],
  cn: ['Vị đậm, nhiều dầu hào và tỏi, ăn kèm cơm là chuẩn.', 'Hương vị Trung Hoa rõ nét, hơi ngọt hậu.'],
  jp: ['Thanh vị, tôn trọng độ tươi của nguyên liệu.', 'Ít gia vị mạnh, để vị gốc lên tiếng.'],
  kr: ['Đậm, cay và ngọt hậu kiểu Hàn.', 'Nhiều sốt, ăn cùng cơm hoặc rượu soju rất hợp.'],
  th: ['Chua – cay – ngọt hài hoà, thơm sả và lá chanh.', 'Mùi thơm nồng, đánh thức vị giác ngay miếng đầu.'],
  it: ['Béo từ phô mai, thơm thảo mộc, ăn nóng là nhất.', 'Vị Ý cổ điển, đơn giản mà tinh tế.'],
  fr: ['Vị Âu thanh lịch, chú trọng sốt và độ mềm.', 'Bơ và kem tạo độ béo mượt dễ chịu.'],
  us: ['Khẩu phần lớn, nhiều năng lượng, đậm vị.', 'Cảm giác thoả mãn nhanh nhưng khá ngấy nếu ăn nhiều.'],
  mx: ['Cay nồng, thơm bánh ngô và chanh xanh.', 'Đậm đà, ăn cùng salsa sẽ cân vị hơn.'],
  in: ['Nhiều gia vị rang, thơm nghệ và cà ri.', 'Vị Ấn đậm, hơi cay, ăn cùng cơm hoặc bánh naan.'],
  tr: ['Thơm gia vị Trung Đông, béo từ sốt tahini.', 'Vị lạ miệng, dễ ăn với bánh pita nóng.']
};
const RISK = {
  chien: 'Hơi nhiều dầu mỡ, không nên ăn quá thường xuyên.',
  nuong: 'Món nướng nên ăn kèm rau để cân bằng.',
  lau: 'Nước lẩu thường mặn, nên nêm lại trước khi nhúng rau.',
  ngot: 'Khá ngọt, người hạn chế đường nên ăn ít.',
  uong: 'Dễ nạp đường nếu gọi nhiều đá ngọt.',
  kho: 'Đậm mặn, ăn cùng dưa chua hoặc canh sẽ dễ chịu hơn.'
};

// Điểm đánh giá = nền 7.2 + thưởng cho món biểu tượng + công phu + độ hiếm, cộng dao động nhỏ theo id
const ICONIC = new Set(['pho-bo','pho-ga','bun-bo-hue','bun-cha','banh-mi-thit','com-tam-suon','banh-xeo','goi-cuon','cha-gio','cao-lau','mi-quang','bun-dau-mam-tom','banh-cuon','xoi-xeo','chao-long','nem-nuong','banh-khot','banh-cong','bot-chieu','banh-trang-nuong','com-ga','bo-luc-lac','bun-rieu','hu-tieu-nam-vang','banh-canh','thit-kho-trung','sushi','mi-ramen','pad-thai','tom-yum','burger','pizza','steak','kimbap','bibimbap','dimsum-tong-hop','ha-cao','banh-chung','banh-trang-tron','che-ba-mau','ca-phe-sua-da','tra-sua','vit-quay','heo-quay','lau-thai','ga-ran','banh-mi-chao','banh-flan']);
const ICONIC_TAGS = ['quốc hồn','quốc dân','đặc sản','Tết','Hội An','Obama','cố đô','huyền thoại','tuổi thơ','đường phố','nhậu'];
let count = 0;
for (const d of data.dishes) {
  const est = estimate(d);
  let score = 7.2;
  if (ICONIC.has(d.id)) score += 1.3;
  if (d.tags.some(t => ICONIC_TAGS.includes(t))) score += 0.5;
  if (d.tier === 3) score += 0.25; else if (d.tier === 4) score += 0.45;
  if (d.minutes >= 45) score += 0.25;                 // món cầu kỳ, ninh/hầm lâu
  if (d.spicy >= 3) score -= 0.3;                     // cay gắt không hợp số đông
  const jitter = (hash(d.id) % 70) / 100;
  const rating = +Math.min(9.8, score + jitter).toFixed(1);
  const baseMood = pick(MOOD[d.region] || MOOD.vn, d.id);
  const review = REVIEW[d.id] || (baseMood + ' ' + (RISK[d.style] ? RISK[d.style] : 'Dễ ăn, hợp cả bữa chính lẫn ăn vặt.'));
  d.rating = rating;
  d.stars = Math.round(rating / 2 * 2) / 2;             // 0–5 sao, bước 0.5
  d.review = review;
  d.calories = est.calories;
  d.protein = est.protein;
  d.proteinLabel = est.proteinLabel;
  d.priceRange = est.priceRange;
  d.fullness = est.fullness;
  d.bestFor = bestFor(d, est);
  d.bestTime = d.meals.map(m => MEAL_LABEL[m] || m).join(' · ');
  d.origin = ORIGIN[d.id] || ({ vn: 'Việt Nam', cn: 'Trung Hoa', jp: 'Nhật Bản', kr: 'Hàn Quốc', th: 'Thái Lan', it: 'Ý', fr: 'Pháp / châu Âu', us: 'Mỹ', mx: 'Mexico', in: 'Ấn Độ', tr: 'Trung Đông' }[d.region] || 'Quốc tế');
  d.tip = REVIEW[d.id] ? (TIPS[hash(d.id) % TIPS.length]) : pick(TIPS, d.id, 3);
  count++;
}
await writeFile(ROOT + 'data/dishes.json', JSON.stringify(data, null, 1));
console.log('đã làm giàu', count, 'món');
const sample = ['pho-bo', 'banh-mi-thit', 'sushi', 'lau-thai', 'che-ba-mau', 'mi-cay'];
for (const id of sample) {
  const d = data.dishes.find(x => x.id === id);
  console.log('\n★ ' + d.name + ' — ' + d.rating + '/10 (' + d.stars + ' sao) | ' + d.calories + ' kcal | đạm ' + d.protein + 'g (' + d.proteinLabel + ') | ' + d.priceRange + ' | xuất xứ: ' + d.origin);
  console.log('   nhận xét: ' + d.review);
  console.log('   hợp với: ' + d.bestFor.join(', ') + ' | no mức ' + d.fullness + '/5 | ' + d.bestTime);
  console.log('   mẹo: ' + d.tip);
}
