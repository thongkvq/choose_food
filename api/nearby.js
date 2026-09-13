import { norm, distM, photonSearch, overpassNear, withTimeout } from './_lib.js';

export default async function handler(req, res) {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: 'thiếu lat/lng' });
  const TIERS = [2500, 5000, 10000];   // 3 mức người dùng chọn
  const MAX_RADIUS = 10000;
  const want = Math.min(MAX_RADIUS, Math.max(300, Number(req.query.r) || 5000));
  const radius = TIERS.find((t) => t >= want) || MAX_RADIUS;
  const dish = String(req.query.q || '').slice(0, 60);
  const kw = String(req.query.kw || '').slice(0, 160);
  const cuisine = String(req.query.cuisine || '').slice(0, 60);

  const words = [...new Set((norm(dish) + ' ' + norm(kw)).split(' ').filter((t) => t.length >= 3))];
  const queries = [...new Set([dish, (kw || '').split('|')[0], words.slice(0, 2).join(' ')].filter((q) => q && q.trim().length >= 3))].slice(0, 3);

  // Photon (nguồn chính, nhanh ~0.2-1s) — mở rộng bán kính dần
  const photonJob = (async () => {
    for (const rad of [Math.min(radius, MAX_RADIUS)]) {   // đúng mức người dùng chọn, không tự nới
      const seen = new Map();
      const got = await Promise.all(queries.map((q) => photonSearch(q, lat, lng, rad, 20).catch(() => [])));
      for (const arr of got) for (const pl of arr) {
        const k = pl.name + '@' + pl.lat.toFixed(4) + ',' + pl.lng.toFixed(4);
        if (seen.has(k)) continue;
        const n = norm(pl.name), cu = norm(cuisine);
        const hitName = words.filter((t) => n.includes(t));
        const hitCuisine = cu ? (norm(pl.cuisine).includes(cu) ? [cu] : []) : [];
        if (!hitName.length && !hitCuisine.length) continue;
        seen.set(k, Object.assign({}, pl, {
          dist: distM(lat, lng, pl.lat, pl.lng), score: hitName.length * 3 + hitCuisine.length * 2,
          hitName: hitName, hitCuisine: hitCuisine,
          maps: 'https://www.google.com/maps/dir/?api=1&destination=' + pl.lat + ',' + pl.lng + '&travelmode=driving'
        }));
      }
      const matched = [...seen.values()].filter((p) => p.dist <= rad).sort((a, b) => (b.score - a.score) || (a.dist - b.dist));
      if (matched.length >= 3 || rad >= MAX_RADIUS) return { matched: matched.slice(0, 12), usedRadius: rad };
    }
    return { matched: [], usedRadius: radius };
  })();

  // Overpass chỉ chạy khi client yêu cầu (?ov=1) — dịch vụ này thường chậm, không nên chặn kết quả chính
  const wantOverpass = String(req.query.ov || '') === '1';
  const ovBudget = radius <= 2500 ? 4000 : radius <= 5000 ? 7000 : 12000;   // bán kính càng lớn Overpass càng lâu
  const overpassJob = !wantOverpass
    ? Promise.resolve({ areaTotal: 0, nearest: [], sameCuisine: [] })
    : withTimeout(
    (async () => {
      const all = await overpassNear(lat, lng, Math.min(radius, MAX_RADIUS));
      const near = all.map((p) => Object.assign({}, p, { dist: distM(lat, lng, p.lat, p.lng) }))
        .filter((p) => p.dist <= Math.min(radius, MAX_RADIUS)).sort((a, b) => a.dist - b.dist);
      const cu = norm(cuisine);
      const pack = (p) => ({
        name: p.name, dist: p.dist, type: p.type, cuisine: p.cuisine, address: p.address, phone: p.phone,
        maps: 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng + '&travelmode=driving'
      });
      return {
        areaTotal: all.length,
        nearest: near.slice(0, 12).map(pack),
        sameCuisine: (cu ? near.filter((p) => p.ncuisine.includes(cu)) : []).slice(0, 12).map(pack)
      };
    })(),
    ovBudget,   // Overpass chỉ là phần phụ — hết giờ thì trả kết quả Photon ngay
    { areaTotal: 0, nearest: [], sameCuisine: [], areaError: 'hết thời gian chờ Overpass' }
  ).catch((e) => ({ areaTotal: 0, nearest: [], sameCuisine: [], areaError: String((e && e.message) || e) }));

  const [ph, ov] = await Promise.all([photonJob, overpassJob]);
  res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=3600');
  res.status(200).json({
    center: { lat: lat, lng: lng }, radius: radius, usedRadius: ph.usedRadius,
    matched: ph.matched, nearest: ov.nearest || [], sameCuisine: ov.sameCuisine || [],
    areaTotal: ov.areaTotal || 0, areaError: ov.areaError || null,
    mapsUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(dish + ' gần đây') + '/@' + lat + ',' + lng + ',13z',
    mapsKeywordUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(dish) + '/@' + lat + ',' + lng + ',13z',
    osmUrl: 'https://www.openstreetmap.org/#map=14/' + lat + '/' + lng
  });
}
