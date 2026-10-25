// tools/test/test-nearby-core.mjs — unit test cho lib/nearby-core.js (logic dùng chung app.js + server.js)
// Không cần mạng, không cần server. Dùng: node tools/test/test-nearby-core.mjs
import {
  R_TIERS, MAX_RADIUS, DEFAULT_RADIUS, clampRadius, snapTier, norm, distM, dishWords, dishQueries,
  matchPlace, photonBox, overpassBox, overpassQuery, overpassLimit, placesFromPhoton, poisFromOverpass,
  fameScore, branchCounts, dedupByName, fameLists, nearbyUrls, packPoi
} from '../../lib/nearby-core.js';

let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };

// 1) chuẩn hoá tên: bỏ dấu, 'đ' -> 'd' (kể cả Đ in hoa)
check('norm bỏ dấu + đ/Đ -> d', norm('Đà Nẵng - Hải Châu') === 'da nang hai chau', norm('Đà Nẵng - Hải Châu'));
check('norm giữ khoảng trắng đơn + bỏ ký tự lạ', norm('  Phở  Bò!!  ') === 'pho bo', norm('  Phở  Bò!!  '));

// 2) bán kính: làm tròn LÊN đúng 1 trong 4 mức, chặn trần 15km
check('4 mức bán kính', JSON.stringify(R_TIERS) === '[2500,5000,10000,15000]', JSON.stringify(R_TIERS));
const cases = [[1000, 2500], [2500, 2500], [3000, 5000], [5000, 5000], [7000, 10000], [10000, 10000], [12000, 15000], [15000, 15000], [20000, 15000], [0, 5000], ['', 5000], [undefined, 5000], ['abc', 5000]];
for (const [ask, want] of cases) check('clampRadius(' + JSON.stringify(ask) + ') = ' + want, clampRadius(ask) === want, 'nhận ' + clampRadius(ask));
check('snapTier không vượt trần', snapTier(999999) === MAX_RADIUS && DEFAULT_RADIUS === 5000);

// 3) khoảng cách: Bến Thành -> Chợ Lớn ~5.2km
const d = distM(10.7725, 106.698, 10.7555, 106.6627);
check('distM Bến Thành -> Chợ Lớn trong khoảng 3.5-4.5km', d > 3500 && d < 4500, d + 'm');
check('distM cùng điểm = 0', distM(10.77, 106.69, 10.77, 106.69) === 0);

// 4) khớp tên món
check('dishWords lọc từ <3 ký tự + gộp trùng', JSON.stringify(dishWords('Phở bò', 'pho|bun')) === '["pho","bun"]', JSON.stringify(dishWords('Phở bò', 'pho|bun')));
check('dishQueries gộp trùng + lấy 2 từ đầu', JSON.stringify(dishQueries('Bánh canh cua', 'Bánh canh cua|bánh canh')) === '["Bánh canh cua","banh canh"]', JSON.stringify(dishQueries('Bánh canh cua', 'Bánh canh cua|bánh canh')));
const q = dishQueries('Bánh canh cua', 'Bánh canh cua|bánh canh');
check('dishQueries ≤3 và không rỗng', q.length <= 3 && q.every((x) => x.trim().length >= 3), JSON.stringify(q));
const words = dishWords('Bánh canh cua', '');
check('matchPlace khớp theo tên', matchPlace({ name: 'Quán Bánh Canh Cua 21', cuisine: '' }, words, '').ok === true);
check('matchPlace khớp theo ẩm thực', matchPlace({ name: 'Nhà hàng Hoa', cuisine: 'vietnamese' }, ['zzz'], 'vietnamese').ok === true);
check('matchPlace loại quán không liên quan', matchPlace({ name: 'Tiệm vàng Kim Long', cuisine: '' }, words, '').ok === false);

// 5) bbox: Photon (tây,nam,đông,bắc) và Overpass (nam,tây,bắc,đông)
const pb = photonBox(10.7725, 106.698, 2500).split(',').map(Number);
check('photonBox: tây<đông, nam<bắc', pb[0] < pb[2] && pb[1] < pb[3], JSON.stringify(pb));
const ob = overpassBox(10.7725, 106.698, 2500).split(',').map(Number);
check('overpassBox: nam<tây<bắc<đông (đúng thứ tự Overpass)', ob[0] < ob[2] && ob[1] < ob[3], JSON.stringify(ob));
check('overpassQuery có bbox + giới hạn out', overpassQuery(10.7725, 106.698, 2500).includes(overpassBox(10.7725, 106.698, 2500)) && overpassQuery(10.7725, 106.698, 2500).includes('out center tags ' + overpassLimit(2500)));
check('overpassLimit tăng theo bán kính', overpassLimit(2500) < overpassLimit(5000) && overpassLimit(5000) < overpassLimit(10000) && overpassLimit(10000) < overpassLimit(15000), [overpassLimit(2500), overpassLimit(15000)].join(' -> '));

// 6) Photon features -> quán (chỉ giữ quán ăn)
const feats = [
  { properties: { osm_key: 'amenity', osm_value: 'restaurant', name: 'Quán Phở', extra: { phone: '0900', opening_hours: '08:00-22:00' } }, geometry: { coordinates: [106.7, 10.77] } },
  { properties: { osm_key: 'place', osm_value: 'suburb', name: 'Bến Thành' }, geometry: { coordinates: [106.69, 10.77] } },
  { properties: { osm_key: 'shop', osm_value: 'bakery', name: 'Tiệm bánh' }, geometry: { coordinates: [106.69, 10.771] } },
  { properties: { osm_key: 'amenity', osm_value: 'restaurant' }, geometry: { coordinates: [106.69, 10.772] } }
];
const pl = placesFromPhoton(feats);
check('placesFromPhoton bỏ khu phố + chỗ không tên, giữ quán/bakery', pl.length === 2 && pl[0].name === 'Quán Phở' && pl[1].name === 'Tiệm bánh', JSON.stringify(pl.map((p) => p.name)));

// 7) Overpass elements -> quán + chấm điểm "có tiếng"
const els = [
  { lat: 10.77, lon: 106.70, tags: { name: 'Phở Thìn', amenity: 'restaurant', cuisine: 'vietnamese', brand: 'Phở Thìn', website: 'https://a.vn', opening_hours: '6-22', phone: '09', 'addr:street': 'Lê Lợi', wikidata: 'Q1' } },
  { center: { lat: 10.771, lon: 106.701 }, tags: { name: 'Phở Thìn', amenity: 'restaurant' } },
  { center: { lat: 10.772, lon: 106.702 }, tags: { name: 'Phở Thìn', amenity: 'restaurant' } },
  { lat: 10.773, lon: 106.703, tags: { amenity: 'cafe' } }
];
const pois = poisFromOverpass(els);
check('poisFromOverpass giữ node+way, bỏ chỗ không tên', pois.length === 3, JSON.stringify(pois.map((p) => p.name)));
const counts = branchCounts(pois);
check('branchCounts đếm 3 chi nhánh', counts.get(norm('Phở Thìn')) === 3, String(counts.get(norm('Phở Thìn'))));
const f = fameScore(pois[0], 3);
check('fameScore: wiki4+brand3+3 chi nhánh2+website2+giờ1+phone1+địa chỉ1+cuisine1 = 15', f.s === 15, f.s + ' | ' + f.why.join(', '));
const dedup = dedupByName(pois.map((p) => Object.assign({}, p, { dist: p.lat === 10.77 ? 100 : 500, fame: fameScore(p, 3).s })), counts);
check('dedupByName gộp 3 chi nhánh thành 1, giữ chi nhánh gần nhất', dedup.length === 1 && dedup[0].branches === 3 && dedup[0].dist === 100, JSON.stringify(dedup.map((p) => [p.name, p.dist, p.branches])));

// 8) fameLists: khớp món (≥4) và quanh đây (≥5) + lọc bán kính
const wide = [
  Object.assign({}, pois[0], { dist: 100 }),
  { name: 'Cà phê Xa', nname: norm('Cà phê Xa'), ncuisine: '', cuisine: '', brand: 'X', website: 'https://x.vn', open: '6-22', phone: '09', address: 'a', lat: 10.9, lng: 106.9, fame: 9 },
  { name: 'Quán Vô Danh', nname: norm('Quán Vô Danh'), ncuisine: '', cuisine: '', lat: 10.771, lng: 106.701 }
];
const lists = fameLists(wide, 10.7725, 106.698, 2500, 'Phở', '', '');
check('fameLists: khớp món có trong famousMatch', lists.famousMatch.some((p) => p.name === 'Phở Thìn'), JSON.stringify(lists.famousMatch.map((p) => p.name)));
check('fameLists: loại quán ngoài bán kính', !lists.famousNear.some((p) => p.name === 'Cà phê Xa'), JSON.stringify(lists.famousNear.map((p) => [p.name, p.dist])));
check('fameLists: quán không dấu hiệu nổi tiếng bị loại', !lists.famousNear.some((p) => p.name === 'Quán Vô Danh'));

// 9) packPoi + URL
const packed = packPoi(Object.assign({}, pois[0], { dist: 250 }), counts);
check('packPoi có fame/why/branches + link chỉ đường', packed.fame === 15 && packed.branches === 3 && packed.why.length === 8 && /google\.com\/maps\/dir/.test(packed.maps), JSON.stringify({ fame: packed.fame, branches: packed.branches }));
const urls = nearbyUrls(10.7725, 106.698, 'Phở bò');
check('nearbyUrls có 3 link', /google\.com\/maps\/search/.test(urls.mapsUrl) && /google\.com\/maps\/search/.test(urls.mapsKeywordUrl) && /openstreetmap\.org/.test(urls.osmUrl));

console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.length + ') ' + fails.join(', ') : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
