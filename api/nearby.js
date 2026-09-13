import { norm, distM, photonSearch, overpassNear, withTimeout } from './_lib.js';

export default async function handler(req, res) {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: 'thiếu lat/lng' });
  const TIERS = [2500, 5000, 10000, 15000];   // 4 mức người dùng chọn
  const MAX_RADIUS = 15000;
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
  const ovBudget = radius <= 2500 ? 4000 : radius <= 5000 ? 7000 : radius <= 10000 ? 12000 : 15000;   // bán kính càng lớn Overpass càng lâu
  const overpassJob = !wantOverpass
    ? Promise.resolve({ areaTotal: 0, nearest: [], sameCuisine: [] })
    : withTimeout(
    (async () => {
      const all = await overpassNear(lat, lng, Math.min(radius, MAX_RADIUS));
      const near = all.map((p) => Object.assign({}, p, { dist: distM(lat, lng, p.lat, p.lng) }))
        .filter((p) => p.dist <= Math.min(radius, MAX_RADIUS)).sort((a, b) => a.dist - b.dist);
      const cu = norm(cuisine);
      const counts = new Map();
      for (const p of all) counts.set(p.nname, (counts.get(p.nname) || 0) + 1);
      const fame = (p) => {
        let s = 0; const why = []; const br = counts.get(p.nname) || 1;
        if (p.wiki) { s += 4; why.push('có hồ sơ Wikipedia/Wikidata'); }
        if (p.brand) { s += 3; why.push('thương hiệu ' + p.brand); }
        if (br >= 3) { s += 2; why.push(br + ' chi nhánh trong vùng'); }
        if (p.website) { s += 2; why.push('có website'); }
        if (p.open) { s += 1; why.push('có giờ mở cửa'); }
        if (p.phone) { s += 1; why.push('có điện thoại'); }
        if (p.address) { s += 1; why.push('có địa chỉ'); }
        if (p.cuisine) { s += 1; why.push('có loại quán'); }
        return { s: s, why: why };
      };
      const pack = (p) => {
        const f = fame(p);
        return {
          name: p.name, dist: p.dist, type: p.type, cuisine: p.cuisine, address: p.address, phone: p.phone,
          open: p.open || '', brand: p.brand || '', website: p.website || '', fame: f.s, why: f.why,
          branches: counts.get(p.nname) || 1,
          maps: 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng + '&travelmode=driving'
        };
      };
      const dedup = (arr) => {
        const by = new Map();
        for (const p of arr) { const cur = by.get(p.nname); if (!cur || p.dist < cur.dist) by.set(p.nname, p); }
        return [...by.values()].map((p) => Object.assign({}, p, { branches: counts.get(p.nname) || 1 }));
      };
      const famMatch = dedup(near.map((p) => Object.assign({}, p, { fame: fame(p).s }))
        .filter((p) => p.fame >= 4 && (words.some((t) => p.nname.includes(t)) || (cu && p.ncuisine.includes(cu))))
        .sort((a, b) => (b.fame - a.fame) || (a.dist - b.dist))).slice(0, 8);
      const famNear = dedup(near.map((p) => Object.assign({}, p, { fame: fame(p).s }))
        .filter((p) => p.fame >= 5).sort((a, b) => (b.fame - a.fame) || (a.dist - b.dist))).slice(0, 10);
      return {
        areaTotal: all.length,
        nearest: near.slice(0, 12).map(pack),
        sameCuisine: (cu ? near.filter((p) => p.ncuisine.includes(cu)) : []).slice(0, 12).map(pack),
        famousMatch: famMatch.map(pack),
        famousNear: famNear.map(pack)
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
    famousMatch: ov.famousMatch || [], famousNear: ov.famousNear || [],
    areaTotal: ov.areaTotal || 0, areaError: ov.areaError || null,
    mapsUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(dish + ' gần đây') + '/@' + lat + ',' + lng + ',13z',
    mapsKeywordUrl: 'https://www.google.com/maps/search/' + encodeURIComponent(dish) + '/@' + lat + ',' + lng + ',13z',
    osmUrl: 'https://www.openstreetmap.org/#map=14/' + lat + '/' + lng
  });
}
