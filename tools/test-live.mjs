// tools/test-live.mjs — kiểm tra web sau khi deploy: node tools/test-live.mjs https://xxx.vercel.app
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.log('Dùng: node tools/test-live.mjs https://<tên>.vercel.app'); process.exit(1); }
const t0 = Date.now();
const get = async (path, expectJson) => {
  const s = Date.now();
  try {
    const r = await fetch(base + path, { headers: { 'accept-encoding': 'gzip' }, redirect: 'follow' });
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
    return { status: 0 };
  }
};
console.log('KIỂM TRA ' + base);
const home = await get('/');
const js = await get('/app.js');
const css = await get('/styles.css');
const data = await get('/data/dishes.json', true);
const w = await get('/api/whereami', true);
let pos = { lat: 10.7725, lng: 106.698 };
try { const j = JSON.parse(w.body); if (isFinite(j.lat)) pos = j; } catch (e) {}
await get('/api/weather?lat=' + pos.lat + '&lng=' + pos.lng, true);
await get('/api/nearby?lat=' + pos.lat + '&lng=' + pos.lng + '&r=2500&q=Ph%E1%BB%9F&kw=Ph%E1%BB%9F&cuisine=vietnamese', true);
await get('/api/geocode?q=Ch%E1%BB%A3%20B%E1%BA%BFn%20Th%C3%A0nh', true);
const total = (home.size + js.size + css.size + data.size) / 1024;
console.log('  tổng tải trang chủ (không nén): ' + total.toFixed(0) + ' KB | riêng dữ liệu món: ' + (data.size / 1024).toFixed(0) + ' KB | hết ' + (Date.now() - t0) + 'ms');
const html = home.body;
console.log('  kiểm tra nhanh: có tiêu đề Món Gì Đây = ' + /Món Gì Đây/.test(html) + ' | có băng chuyền = ' + /rouletteTrack/.test(html) + ' | có nút Hôm nay = ' + /btnToday/.test(html));
