// tools/test-live.mjs — kiểm tra web sau khi deploy HOẶC trên server LAN / bản tĩnh:
//   node tools/test-live.mjs https://xxx.vercel.app
//   node tools/test-live.mjs http://127.0.0.1:4321
//   node tools/test-live.mjs http://127.0.0.1:4399     (bản tĩnh, không có /api)
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.log('Dùng: node tools/test-live.mjs <baseUrl>'); process.exit(1); }
const t0 = Date.now();
let fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  OK  ' : '  SAI ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };
const get = async (path, expectJson) => {
  const s = Date.now();
  const target = /^https?:\/\//.test(path) ? path : base + path;
  try {
    const r = await fetch(target, { headers: { 'accept-encoding': 'gzip' }, redirect: 'follow' });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    let body = buf.toString('utf8');
    let info = '';
    if (expectJson || ct.includes('json')) {
      try {
        const j = JSON.parse(body);
        info = j.error ? ('lỗi: ' + j.error) : JSON.stringify(j).slice(0, 110);
      } catch (e) { info = body.slice(0, 90); }
    } else info = Math.round(buf.length / 1024) + ' KB';
    console.log('  ' + String(r.status).padEnd(4) + path.padEnd(46) + (Date.now() - s + 'ms').padStart(7) + '  ' + info);
    return { status: r.status, size: buf.length, body: body };
  } catch (e) {
    console.log('  LỖI  ' + path.padEnd(46) + String(e.message).slice(0, 60));
    return { status: 0, size: 0, body: '' };
  }
};
console.log('KIỂM TRA ' + base);
const home = await get('/');
const js = await get('/app.js');
const css = await get('/styles.css');
const core = await get('/lib/nearby-core.js');   // app.js import tương đối — phải phục vụ được ở CẢ bản tĩnh
const lite = await get('/data/dishes-lite.json', true);   // lần tải đầu chỉ lấy phần nhẹ
const detail0 = await get('/data/dishes-detail-0.json', true);   // phần nặng: chỉ tải khi mở popup
const manifest = await get('/manifest.webmanifest', true);
const sw = await get('/sw.js');
check('trang chủ 200', home.status === 200, 'có tiêu đề Món Gì Đây = ' + /Món Gì Đây/.test(home.body) + ' | băng chuyền = ' + /rouletteTrack/.test(home.body) + ' | nút Hôm nay = ' + /btnToday/.test(home.body));
check('styles.css 200', css.status === 200);
check('/lib/nearby-core.js phục vụ được (bản tĩnh cũng phải có)', core.status === 200 && /export function fameLists/.test(core.body), core.status + ' · ' + core.size + 'B');
let dishCount = 0, liteJson = null;
try { liteJson = JSON.parse(lite.body); dishCount = liteJson.dishes.length; } catch (e) {}
check('/data/dishes-lite.json đọc được (dữ liệu lần tải đầu)', dishCount > 0, dishCount + ' món · ' + Math.round(lite.size / 1024) + 'KB');
const H = ['review', 'intro', 'introSource', 'wikiUrl', 'wikiTitle', 'introEn', 'facts', 'detail', 'tip'];
const leaked = liteJson ? H.filter(k => liteJson.dishes.some(d => d[k] !== undefined)) : H;
check('lite KHÔNG chứa trường nặng (intro/facts/detail/tip/review)', leaked.length === 0, leaked.join(', ') || 'sạch');
let detailCount = 0;
try { detailCount = Object.keys(JSON.parse(detail0.body).items).length; } catch (e) {}
check('/data/dishes-detail-0.json đọc được (tải khi mở popup)', detail0.status === 200 && detailCount > 0, detailCount + ' món · ' + Math.round(detail0.size / 1024) + 'KB');
check('PWA: manifest + sw.js phục vụ được', manifest.status === 200 && sw.status === 200 && /const VERSION/.test(sw.body), manifest.status + '/' + sw.status);

const w = await get('/api/whereami', true);
let pos = { lat: 10.7725, lng: 106.698 };
try { const j = JSON.parse(w.body); if (isFinite(j.lat)) pos = j; } catch (e) {}
if (w.status === 200) {
  await get('/api/weather?lat=' + pos.lat + '&lng=' + pos.lng, true);
  await get('/api/nearby?lat=' + pos.lat + '&lng=' + pos.lng + '&r=2500&q=Ph%E1%BB%9F&kw=Ph%E1%BB%9F&cuisine=vietnamese', true);
  await get('/api/geocode?q=Ch%E1%BB%A3%20B%E1%BA%BFn%20Th%C3%A0nh', true);
  await get('/api/reverse-geocode?lat=' + pos.lat + '&lng=' + pos.lng, true);
  check('server LAN: /api/* chạy', true);
} else {
  // bản tĩnh Vercel: /api/* trả 404 là ĐÚNG thiết kế, client tự gọi thẳng dịch vụ
  check('bản tĩnh: /api/* không tồn tại (đúng thiết kế)', w.status === 404, 'status ' + w.status);
  const direct = await get('https://photon.komoot.io/api/?q=Ph%E1%BB%9F&lat=10.77&lon=106.7&limit=1');
  if (direct.status === 0) console.log('  BỎ QUA: Photon (dịch vụ ngoài) không kết nối được — không phải lỗi bản tĩnh; xem tools/test-fame-mock.mjs cho đường gọi thẳng');
  else check('gọi thẳng Photon được (đường dự phòng bản tĩnh)', direct.status === 200, 'status ' + direct.status);
}
const total = (home.size + js.size + css.size + lite.size) / 1024;
console.log('  tổng tải lần đầu (không nén, gồm dữ liệu món): ' + total.toFixed(0) + ' KB | riêng dishes-lite.json: ' + (lite.size / 1024).toFixed(0) + ' KB | phần chi tiết (tải khi mở popup): ' + (detail0.size / 1024).toFixed(0) + ' KB/mảnh | hết ' + (Date.now() - t0) + 'ms');
console.log('---');
console.log(fails.length ? 'KẾT QUẢ: FAIL (' + fails.length + ') ' + fails.join(', ') : 'KẾT QUẢ: PASS');
process.exit(fails.length ? 1 : 0);
