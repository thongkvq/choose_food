// tools/test-vercel-fn.mjs — gọi thẳng handler serverless như Vercel sẽ gọi
const makeRes = () => {
  const out = { code: 0, headers: {}, body: null };
  return {
    out,
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
    status(c) { out.code = c; return this; },
    json(o) { out.body = o; return this; }
  };
};
const call = async (mod, query) => {
  const fn = (await import('../api/' + mod + '.js')).default;
  const res = makeRes();
  await fn({ query: query }, res);
  return res.out;
};
const t0 = Date.now();
const w = await call('whereami', {});
console.log('1) /api/whereami:', w.code, JSON.stringify(w.body).slice(0, 130), '| cache:', w.headers['cache-control']);
const pos = w.body;
const wx = await call('weather', { lat: pos.lat, lng: pos.lng });
console.log('2) /api/weather:', wx.code, JSON.stringify(wx.body).slice(0, 150));
const t1 = Date.now();
const nb = await call('nearby', { lat: 10.7725, lng: 106.698, r: 2500, q: 'Phở', kw: 'Phở', cuisine: 'vietnamese' });
const t2 = Date.now();
console.log('3) /api/nearby (Bến Thành, tìm Phở):', nb.code, '| mất', (t2 - t1) + 'ms');
console.log('   khớp tên món:', (nb.body.matched || []).length, '| cùng ẩm thực:', (nb.body.sameCuisine || []).length, '| gần nhất:', (nb.body.nearest || []).length, '| lỗi Overpass:', nb.body.areaError || 'không');
(nb.body.matched || []).slice(0, 5).forEach(p => console.log('     *', p.name, (p.dist / 1000).toFixed(1) + 'km', p.address ? '· ' + p.address.slice(0, 40) : ''));
const gc = await call('geocode', { q: 'Chợ Bến Thành Hồ Chí Minh' });
console.log('4) /api/geocode:', gc.code, JSON.stringify(gc.body).slice(0, 140));
const bad = await call('nearby', {});
console.log('5) thiếu lat/lng ->', bad.code, JSON.stringify(bad.body));
console.log('tổng thời gian:', (Date.now() - t0) + 'ms');
