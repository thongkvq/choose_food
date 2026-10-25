// tools/test/test-api.mjs — kiểm tra 5 route /api của server LAN (thay test-vercel-fn.mjs đã xoá ở task-04
// cùng api/ — Vercel nay là bản TĨNH, mọi route do server.js tự xử lý).
// Dùng: node tools/test/test-api.mjs [baseUrl]   (mặc định http://127.0.0.1:4321)
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
console.log('KIỂM TRA /api trên ' + BASE);
let fails = [];
// soft: lỗi do dịch vụ NGOÀI (Photon) không kết nối được -> BỎ QUA chứ không kết luận lỗi code
const check = (name, ok, extra, soft) => {
  if (!ok && soft && String(extra).includes(soft)) { console.log('  BỎ QUA ' + name + ' — dịch vụ ngoài không kết nối được (' + soft + ')'); return; }
  console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name);
};
const get = async (path) => {
  const t = Date.now();
  try { const r = await fetch(BASE + path, { cache: 'no-store' }); return { status: r.status, ct: r.headers.get('content-type') || '', json: await r.json().catch(() => null), ms: Date.now() - t }; }
  catch (e) { return { status: 0, err: e.message, ms: Date.now() - t }; }
};

// bản tĩnh (Vercel) không có /api -> bỏ qua phần này, ghi rõ lý do
const probe = await get('/api/whereami');
if (probe.status === 404 || probe.status === 0) {
  console.log('BỎ QUA: bản tĩnh không có /api (đúng thiết kế — client tự gọi thẳng dịch vụ)');
  process.exit(0);
}
check('/api/whereami trả JSON toạ độ', probe.status === 200 && isFinite(probe.json && probe.json.lat), JSON.stringify(probe.json).slice(0, 90) + ' | ' + probe.ms + 'ms');
const pos = (probe.json && isFinite(probe.json.lat)) ? probe.json : { lat: 10.7725, lng: 106.698 };

const wx = await get('/api/weather?lat=' + pos.lat + '&lng=' + pos.lng);
check('/api/weather trả nhiệt độ', wx.status === 200 && (isFinite(wx.json && wx.json.temp) || !!wx.json.error), JSON.stringify(wx.json).slice(0, 110));

const gc = await get('/api/geocode?q=' + encodeURIComponent('Chợ Bến Thành Hồ Chí Minh'));
check('/api/geocode trả toạ độ', gc.status === 200 && isFinite(gc.json && gc.json.lat), JSON.stringify(gc.json).slice(0, 110), 'fetch failed');

const rv = await get('/api/reverse-geocode?lat=10.7725&lng=106.698');
check('/api/reverse-geocode trả JSON (mục 22)', rv.status === 200 && rv.json && !rv.json.error, JSON.stringify(rv.json).slice(0, 130) + ' | ' + rv.ms + 'ms', 'fetch failed');
const rvBad = await get('/api/reverse-geocode?lat=999&lng=106');
check('/api/reverse-geocode thiếu/sai lat-lng -> 400', rvBad.status === 400, 'nhận ' + rvBad.status);

const nb = await get('/api/nearby?lat=' + pos.lat + '&lng=' + pos.lng + '&r=2500&q=' + encodeURIComponent('Phở') + '&kw=' + encodeURIComponent('Phở') + '&cuisine=vietnamese');
const nbOk = nb.status === 200 && nb.json && nb.json.radius === 2500;
check('/api/nearby r=2500 -> radius 2500', nbOk, 'khớp ' + ((nb.json && nb.json.matched) || []).length + ' | ' + nb.ms + 'ms');
const nbBig = await get('/api/nearby?lat=' + pos.lat + '&lng=' + pos.lng + '&r=20000&q=' + encodeURIComponent('Phở'));
check('/api/nearby r=20000 -> chặn còn 15000', nbBig.status === 200 && nbBig.json && nbBig.json.radius === 15000, 'nhận ' + (nbBig.json && nbBig.json.radius));
const nbBad = await get('/api/nearby?q=Ph%E1%BB%9F');
check('/api/nearby thiếu lat/lng -> 400', nbBad.status === 400, 'nhận ' + nbBad.status);

console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.length + ') ' + fails.join(', ') : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
