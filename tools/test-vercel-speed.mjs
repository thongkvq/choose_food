const makeRes = () => { const out = { code: 0, headers: {}, body: null };
  return { out, setHeader(k,v){out.headers[k.toLowerCase()]=v;}, status(c){out.code=c;return this;}, json(o){out.body=o;return this;} }; };
const call = async (mod, query) => { const fn = (await import('../api/' + mod + '.js')).default; const res = makeRes(); await fn({ query: query }, res); return res.out; };
let t0 = Date.now();
const a = await call('nearby', { lat: 10.7725, lng: 106.698, r: 2500, q: 'Phở', kw: 'Phở', cuisine: 'vietnamese' });
console.log('KHÔNG ov (phổ biến):', (Date.now()-t0) + 'ms | khớp:', (a.body.matched||[]).length);
t0 = Date.now();
const c = await call('nearby', { lat: 10.822, lng: 106.6257, r: 2500, q: 'Bánh canh', kw: 'Bánh canh', cuisine: 'vietnamese', ov: '1' });
console.log('CÓ ov=1 (khi cần):', (Date.now()-t0) + 'ms | khớp:', (c.body.matched||[]).length, '| cùng ẩm thực:', (c.body.sameCuisine||[]).length, '| gần nhất:', (c.body.nearest||[]).length);
